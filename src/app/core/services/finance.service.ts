import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Normalizer } from '../../shared/utils/normalizer';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private firestore = inject(Firestore);
    private logger = inject(LoggerService);
    private COL = 'transactions';

    private CACHE_KEY = 'finance_data';
    private TIME_KEY = 'finance_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    constructor() { }

    getTransactions(forceRefresh = false): Observable<Transaction[]> {
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const hasCache = localStorage.getItem(this.CACHE_KEY);
        const isCacheFresh = (Date.now() - lastFetch < this.CACHE_DURATION);

        if (!forceRefresh && hasCache && isCacheFresh) {
            return of(JSON.parse(hasCache).map((t: Record<string, unknown>) => ({ ...t, date: new Date(t['date'] as string) })));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError(() => {
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((t: Record<string, unknown>) => ({ ...t, date: new Date(t['date'] as string) })));
                }
                return throwError(() => new Error('Não foi possível conectar ao servidor financeiro.'));
            })
        );
    }

    save(transaction: Transaction): Observable<boolean> {
        const isNew = !transaction.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, transaction.id);

        const description_search = Normalizer.search(transaction.description);
        const category_search = Normalizer.search(transaction.category);

        const firestoreData: Record<string, unknown> = { 
            ...JSON.parse(JSON.stringify(transaction)), 
            id: docRef.id, 
            description_search,
            category_search,
            deleted: transaction.deleted ?? false,
            updatedAt: new Date()
        };

        return from(setDoc(docRef, firestoreData, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('FALHA AO REGISTRAR LANÇAMENTO NO SERVIDOR.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao excluir lançamento.')))
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao restaurar lançamento.')))
        );
    }

    private updateCache(data: Transaction[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private fromFirestore(id: string, data: Record<string, unknown>): Transaction {
        return {
            ...data,
            id,
            date: (data['date'] as { toDate?: () => Date })?.toDate ? (data['date'] as { toDate: () => Date }).toDate() : new Date(data['date'] as string),
        } as Transaction;
    }
}
