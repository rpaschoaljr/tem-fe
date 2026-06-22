import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, forkJoin, of } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { Firestore } from '@angular/fire/firestore';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { ScheduledTransaction, RecurrenceType } from '../models/scheduled-transaction.model';
import { Transaction } from '../models/transaction.model';
import { FinanceService } from './finance.service';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class ScheduledTransactionsService {
    private firestore = inject(Firestore);
    private financeService = inject(FinanceService);
    private logger = inject(LoggerService);
    private COL = 'scheduled_transactions';

    getAll(): Observable<ScheduledTransaction[]> {
        const colRef = FbUtils.collection(this.firestore, this.COL);
        return (FbUtils.collectionData(FbUtils.query(colRef), { idField: 'id' }) as Observable<Record<string, unknown>[]>).pipe(
            map(snap => snap.map(d => this.fromFirestore(d['id'] as string, d))),
            catchError(err => {
                const errorCode = (err as any)?.code;
                const errorMessage = String((err as any)?.message || '');
                if (errorCode === 'permission-denied' || errorMessage.includes('admin is undefined')) {
                    this.logger.debug('Acesso negado silenciado em agendamentos.', err);
                    return of([]);
                }
                this.logger.error('Erro ao buscar agendamentos', err);
                return throwError(() => new Error('Não foi possível carregar agendamentos.'));
            })
        );
    }

    getDue(): Observable<ScheduledTransaction[]> {
        return this.getAll().pipe(
            map(all => {
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                return all.filter(s =>
                    s.active &&
                    !s.deleted &&
                    new Date(s.nextDueDate) <= today
                );
            })
        );
    }

    save(scheduled: ScheduledTransaction): Observable<boolean> {
        const isNew = !scheduled.id;
        const colRef = FbUtils.collection(this.firestore, this.COL);
        const docRef = isNew ? FbUtils.doc(colRef) : FbUtils.doc(this.firestore, this.COL, scheduled.id);
        const data = {
            ...JSON.parse(JSON.stringify(scheduled)),
            id: docRef.id,
            deleted: scheduled.deleted ?? false,
            active: scheduled.active ?? true
        };

        return from(FbUtils.setDoc(docRef, data, { merge: true })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('Falha ao salvar agendamento.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: true })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao excluir agendamento.')))
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: false })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao restaurar agendamento.')))
        );
    }

    applySchedule(scheduled: ScheduledTransaction): Observable<boolean> {
        const signedValue = scheduled.type === 'Saída'
            ? -Math.abs(scheduled.value)
            : Math.abs(scheduled.value);

        const transaction: Transaction = {
            id: '',
            description: scheduled.description,
            type: scheduled.type,
            category: scheduled.category,
            date: new Date(scheduled.nextDueDate),
            value: signedValue,
            deleted: false,
            memberId: scheduled.memberId,
            memberName: scheduled.memberName
        };

        return this.financeService.save(transaction).pipe(
            switchMap(() => {
                const nextDue = this.calculateNextDueDate(scheduled);
                const isOnce = scheduled.recurrence === 'once';
                const docRef = FbUtils.doc(this.firestore, this.COL, scheduled.id);
                return from(FbUtils.updateDoc(docRef, {
                    lastAppliedDate: new Date().toISOString(),
                    nextDueDate: nextDue.toISOString(),
                    active: !isOnce
                })).pipe(
                    map(() => true)
                );
            }),
            catchError(() => throwError(() => new Error('Erro ao lançar agendamento.')))
        );
    }

    calculateNextDueDate(scheduled: ScheduledTransaction): Date {
        const base = new Date(scheduled.nextDueDate);
        switch (scheduled.recurrence) {
            case 'monthly': {
                const next = new Date(base);
                next.setDate(1); // Prevent month overflow
                next.setMonth(base.getMonth() + 1);
                const targetDay = scheduled.dayOfMonth || base.getDate();
                next.setDate(Math.min(targetDay, this.daysInMonth(next.getFullYear(), next.getMonth())));
                return next;
            }
            case 'weekly': {
                const next = new Date(base);
                next.setDate(next.getDate() + 7);
                return next;
            }
            case 'yearly': {
                const next = new Date(base);
                next.setFullYear(next.getFullYear() + 1);
                return next;
            }
            default:
                return base;
        }
    }

    private daysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate();
    }

    private fromFirestore(id: string, data: Record<string, unknown>): ScheduledTransaction {
        return { ...this.fixDates({ ...data, id }) };
    }

    private fixDates(s: Record<string, unknown>): ScheduledTransaction {
        return {
            ...s,
            nextDueDate: s['nextDueDate'] ? new Date(s['nextDueDate'] as string) : new Date(),
            lastAppliedDate: s['lastAppliedDate'] ? new Date(s['lastAppliedDate'] as string) : undefined
        } as unknown as ScheduledTransaction;
    }
}
