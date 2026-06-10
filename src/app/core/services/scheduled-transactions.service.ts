import { Injectable, inject } from '@angular/core';
import { Observable, from, of, throwError, forkJoin } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
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

    private CACHE_KEY = 'scheduled_transactions_data';
    private TIME_KEY = 'scheduled_transactions_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    getAll(forceRefresh = false): Observable<ScheduledTransaction[]> {
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const hasCache = localStorage.getItem(this.CACHE_KEY);
        const isCacheFresh = (Date.now() - lastFetch < this.CACHE_DURATION);

        if (!forceRefresh && hasCache && isCacheFresh) {
            return of(JSON.parse(hasCache).map((s: Record<string, unknown>) => this.fixDates(s)));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError(() => {
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((s: Record<string, unknown>) => this.fixDates(s)));
                }
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
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, scheduled.id);
        const data = {
            ...JSON.parse(JSON.stringify(scheduled)),
            id: docRef.id,
            deleted: scheduled.deleted ?? false,
            active: scheduled.active ?? true
        };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Falha ao salvar agendamento.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao excluir agendamento.')))
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
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
                const docRef = doc(this.firestore, this.COL, scheduled.id);
                return from(updateDoc(docRef, {
                    lastAppliedDate: new Date().toISOString(),
                    nextDueDate: nextDue.toISOString(),
                    active: !isOnce
                })).pipe(
                    tap(() => localStorage.removeItem(this.TIME_KEY)),
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
                next.setMonth(next.getMonth() + 1);
                if (scheduled.dayOfMonth) {
                    next.setDate(Math.min(scheduled.dayOfMonth, this.daysInMonth(next.getFullYear(), next.getMonth())));
                }
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

    private updateCache(data: ScheduledTransaction[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
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
