import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { StockItem } from '../models/stock-item.model';
import {
    Firestore, collection, getDocs, doc, setDoc, updateDoc
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class StockService {
    private firestore = inject(Firestore);
    private COL = 'stock';

    private CACHE_KEY = 'stock_data';
    private TIME_KEY = 'stock_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    constructor() { }

    getStock(forceRefresh = false): Observable<StockItem[]> {
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const hasCache = localStorage.getItem(this.CACHE_KEY);
        const isCacheFresh = (Date.now() - lastFetch < this.CACHE_DURATION);

        if (!forceRefresh && hasCache && isCacheFresh) {
            return of(JSON.parse(hasCache).map((i: any) => ({ ...i, updatedAt: new Date(i.updatedAt) })));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError(() => {
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((i: any) => ({ ...i, updatedAt: new Date(i.updatedAt) })));
                }
                return throwError(() => new Error('Não foi possível carregar o estoque. Sem conexão.'));
            })
        );
    }

    save(item: StockItem): Observable<boolean> {
        const isNew = !item.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, item.id);
        const data = { ...JSON.parse(JSON.stringify(item)), id: docRef.id, updatedAt: new Date(), ...(isNew ? { deleted: false } : {}) };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Falha ao salvar item no servidor.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao excluir item do estoque.')))
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao restaurar item do estoque.')))
        );
    }

    private updateCache(data: StockItem[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private fromFirestore(id: string, data: any): StockItem {
        return {
            ...data,
            id,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        } as StockItem;
    }
}
