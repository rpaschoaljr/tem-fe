import { Injectable } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { delay, tap, map, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { inject } from '@angular/core';
import {
    Firestore, collection, getDocs, doc, setDoc, updateDoc
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private firestore = inject(Firestore);
    private COL = 'transactions';

    // localStorage fallback
    private CACHE_KEY = 'finance_data';
    private TIME_KEY = 'finance_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    // Mock Inicial (Caso não tenha nada no cache)
    private initialMockData: Transaction[] = [
        { id: '1', description: 'Doação Gira de Esquerda', value: 350.00, type: 'Entrada', category: 'Doação', date: new Date(), deleted: false },
        { id: '2', description: 'Compra de Velas', value: -120.50, type: 'Saída', category: 'Liturgia', date: new Date(), deleted: false },
        { id: '3', description: 'Mensalidade - Pai João', value: 50.00, type: 'Entrada', category: 'Mensalidade', date: new Date('2025-11-30'), deleted: false },
        { id: '4', description: 'Conta de Luz', value: -280.00, type: 'Saída', category: 'Contas', date: new Date('2025-12-05'), deleted: false },
        { id: '5', description: 'Reforma do Telhado', value: -1500.00, type: 'Saída', category: 'Manutenção', date: new Date('2025-11-20'), deleted: false },
    ];

    constructor() { }

    getTransactions(forceRefresh = false): Observable<Transaction[]> {
        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            catchError(() => {
                const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
                const hasCache = localStorage.getItem(this.CACHE_KEY);
                if (!forceRefresh && hasCache && (Date.now() - lastFetch < this.CACHE_DURATION)) {
                    return of(JSON.parse(hasCache).map((t: any) => ({ ...t, date: new Date(t.date) })));
                }
                return of(this.getMockOrStoredData()).pipe(delay(500), tap(data => this.updateCache(data)));
            })
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true })).pipe(
            map(() => true),
            catchError(() => {
                const data = this.getMockOrStoredData();
                const item = data.find(t => t.id === id);
                if (item) { item.deleted = true; this.updateCache(data); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Item não encontrado para exclusão.'));
            })
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false })).pipe(
            map(() => true),
            catchError(() => {
                const data = this.getMockOrStoredData();
                const item = data.find(t => t.id === id);
                if (item) { item.deleted = false; this.updateCache(data); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Erro ao restaurar item.'));
            })
        );
    }

    save(transaction: Transaction): Observable<boolean> {
        const isNew = !transaction.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, transaction.id);
        const data = { ...JSON.parse(JSON.stringify(transaction)), id: docRef.id, deleted: transaction.deleted ?? false };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const index = currentData.findIndex(t => t.id === transaction.id);
                if (index >= 0) { currentData[index] = transaction; }
                else { transaction.id = Date.now().toString(); transaction.deleted = false; currentData.push(transaction); }
                this.updateCache(currentData);
                return of(true).pipe(delay(300));
            })
        );
    }

    update(transaction: Transaction): Observable<any> {
        return this.save(transaction);
    }

    // --- Helpers Privados ---

    private updateCache(data: Transaction[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): Transaction[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
            return JSON.parse(stored).map((t: any) => ({ ...t, date: new Date(t.date) }));
        }
        return this.initialMockData;
    }

    private fromFirestore(id: string, data: any): Transaction {
        return {
            ...data,
            id,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        } as Transaction;
    }
}