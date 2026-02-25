import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { delay, tap, map, catchError } from 'rxjs/operators';
import { StockItem } from '../models/stock-item.model';
import {
    Firestore, collection, getDocs, doc, setDoc, updateDoc
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class StockService {
    private firestore = inject(Firestore);
    private COL = 'stock';

    // localStorage fallback
    private CACHE_KEY = 'stock_data';
    private TIME_KEY = 'stock_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    private initialMockData: StockItem[] = [
        { id: '1', name: 'Vela Branca Palito', category: 'Velas', quantity: 150, minStock: 50, unit: 'un', deleted: false, updatedAt: new Date() },
        { id: '2', name: 'Vela 7 Dias Vermelha', category: 'Velas', quantity: 5, minStock: 10, unit: 'un', deleted: false, updatedAt: new Date() }, // Baixo estoque (Laranja)
        { id: '3', name: 'Pemba Branca', category: 'Ritualística', quantity: 0, minStock: 5, unit: 'cx', deleted: false, updatedAt: new Date() }, // Zerado (Vermelho)
        { id: '4', name: 'Alfazema', category: 'Ervas', quantity: -2, minStock: 0, unit: 'pct', deleted: false, updatedAt: new Date() }, // Negativo (Vermelho)
        { id: '5', name: 'Charuto', category: 'Oferenda', quantity: 20, minStock: undefined, unit: 'cx', deleted: false, updatedAt: new Date() }, // Sem minimo definido
    ];

    getStock(forceRefresh = false): Observable<StockItem[]> {
        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            catchError(() => {
                const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
                const hasCache = localStorage.getItem(this.CACHE_KEY);
                if (!forceRefresh && hasCache && (Date.now() - lastFetch < this.CACHE_DURATION)) {
                    return of(JSON.parse(hasCache).map((i: any) => ({ ...i, updatedAt: new Date(i.updatedAt) })));
                }
                return of(this.getMockOrStoredData()).pipe(delay(500), tap(data => this.updateCache(data)));
            })
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const data = this.getMockOrStoredData();
                const item = data.find(i => i.id === id);
                if (item) { item.deleted = true; this.updateCache(data); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Item não encontrado.'));
            })
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const data = this.getMockOrStoredData();
                const item = data.find(i => i.id === id);
                if (item) { item.deleted = false; this.updateCache(data); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Erro ao restaurar.'));
            })
        );
    }

    save(item: StockItem): Observable<boolean> {
        const isNew = !item.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, item.id);
        const data = { ...JSON.parse(JSON.stringify(item)), id: docRef.id, updatedAt: new Date(), ...(isNew ? { deleted: false } : {}) };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            map(() => true),
            catchError(() => {
                const stored = this.getMockOrStoredData();
                const index = stored.findIndex(i => i.id === item.id);
                if (index >= 0) { item.updatedAt = new Date(); stored[index] = item; }
                else { item.id = Date.now().toString(); item.deleted = false; item.updatedAt = new Date(); stored.push(item); }
                this.updateCache(stored);
                return of(true).pipe(delay(300));
            })
        );
    }

    update(item: StockItem): Observable<any> {
        return this.save(item);
    }

    private updateCache(data: StockItem[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): StockItem[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) return JSON.parse(stored).map((i: any) => ({ ...i, updatedAt: new Date(i.updatedAt) }));
        return this.initialMockData;
    }

    private fromFirestore(id: string, data: any): StockItem {
        return {
            ...data,
            id,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        } as StockItem;
    }
}