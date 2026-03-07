import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Normalizer } from '../../shared/utils/normalizer';

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private firestore = inject(Firestore);
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
            return of(JSON.parse(hasCache).map((t: any) => ({ ...t, date: new Date(t.date) })));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError(() => {
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((t: any) => ({ ...t, date: new Date(t.date) })));
                }
                return throwError(() => new Error('Não foi possível conectar ao servidor financeiro.'));
            })
        );
    }

    save(transaction: Transaction): Observable<boolean> {
        const isNew = !transaction.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, transaction.id);

        // NORMALIZAÇÃO RIGOROSA
        transaction.description = Normalizer.text(transaction.description);
        transaction.category = Normalizer.text(transaction.category);
        transaction.memberName = Normalizer.text(transaction.memberName);

        const data = { 
            ...JSON.parse(JSON.stringify(transaction)), 
            id: docRef.id, 
            deleted: transaction.deleted ?? false,
            updatedAt: new Date()
        };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Falha ao registrar lançamento no servidor.')))
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

    private fromFirestore(id: string, data: any): Transaction {
        return {
            ...data,
            id,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        } as Transaction;
    }
}
