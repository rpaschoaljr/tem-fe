import { Injectable } from '@angular/core';
import { of, Observable, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { StockItem } from '../models/stock-item.model';

@Injectable({ providedIn: 'root' })
export class StockService {
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
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const now = Date.now();
        const hasCache = localStorage.getItem(this.CACHE_KEY);

        if (!forceRefresh && hasCache && (now - lastFetch < this.CACHE_DURATION)) {
            const cachedData = JSON.parse(hasCache);
            const fixedData = cachedData.map((i: any) => ({ ...i, updatedAt: new Date(i.updatedAt) }));
            return of(fixedData);
        }

        return of(this.getMockOrStoredData()).pipe(delay(500), tap(data => this.updateCache(data)));
    }

    softDelete(id: string): Observable<boolean> {
        const data = this.getMockOrStoredData();
        const item = data.find(i => i.id === id);
        if (item) {
            item.deleted = true;
            this.updateCache(data);
            return of(true).pipe(delay(300));
        }
        return throwError(() => new Error('Item não encontrado.'));
    }

    restore(id: string): Observable<boolean> {
        const data = this.getMockOrStoredData();
        const item = data.find(i => i.id === id);
        if (item) {
            item.deleted = false;
            this.updateCache(data);
            return of(true).pipe(delay(300));
        }
        return throwError(() => new Error('Erro ao restaurar.'));
    }

    update(item: StockItem): Observable<any> {
        return throwError(() => new Error('Edição de estoque ainda não implementada.'));
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
}