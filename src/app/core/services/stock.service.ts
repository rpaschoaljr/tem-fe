import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { StockItem } from '../models/stock-item.model';
import { Firestore } from '@angular/fire/firestore';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { switchMap } from 'rxjs/operators';
import { Normalizer } from '../../shared/utils/normalizer';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class StockService {
    private firestore = inject(Firestore);
    private logger = inject(LoggerService);
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
            return of(JSON.parse(hasCache).map((i: Record<string, unknown>) => ({ ...i, updatedAt: new Date(i['updatedAt'] as string) })));
        }

        const colRef = FbUtils.collection(this.firestore, this.COL);
        return from(FbUtils.getDocs(FbUtils.query(colRef))).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError((err) => {
                const errorCode = (err as any)?.code;
                const errorMessage = String((err as any)?.message || '');
                if (errorCode === 'permission-denied' || errorMessage.includes('admin is undefined')) {
                    this.logger.debug('Acesso negado silenciado no estoque.', err);
                    return of([]);
                }
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((i: Record<string, unknown>) => ({ ...i, updatedAt: new Date(i['updatedAt'] as string) })));
                }
                return throwError(() => new Error('Não foi possível carregar o estoque. Sem conexão.'));
            })
        );
    }

    save(item: StockItem): Observable<boolean> {
        const isNew = !item.id;
        const colRef = FbUtils.collection(this.firestore, this.COL);

        const name_search = Normalizer.search(item.name);
        const category_search = Normalizer.search(item.category);

        const firestoreData: Record<string, unknown> = {
            ...JSON.parse(JSON.stringify(item)),
            name_search,
            category_search,
            updatedAt: new Date()
        };

        if (isNew) {
            const q = FbUtils.query(colRef, FbUtils.where('name_search', '==', name_search), FbUtils.where('deleted', '==', false));
            return from(FbUtils.getDocs(q)).pipe(
                switchMap(snap => {
                    if (!snap.empty) {
                        return throwError(() => new Error('JA EXISTE UM ITEM ATIVO COM ESTE NOME NO CATALOGO.'));
                    }
                    const docRef = FbUtils.doc(colRef);
                    firestoreData['id'] = docRef.id;
                    firestoreData['deleted'] = false;
                    firestoreData['quantity'] = item.quantity || 0;
                    
                    return from(FbUtils.setDoc(docRef, firestoreData));
                }),
                tap(() => localStorage.removeItem(this.TIME_KEY)),
                map(() => true),
                catchError(err => throwError(() => new Error(err.message || 'ERRO AO SALVAR ITEM.')))
            );
        }

        const docRef = FbUtils.doc(this.firestore, this.COL, item.id);
        return from(FbUtils.setDoc(docRef, firestoreData, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('FALHA AO ATUALIZAR ITEM NO SERVIDOR.')))
        );
    }

    mergeItems(sourceId: string, targetId: string): Observable<void> {
        const sourceRef = FbUtils.doc(this.firestore, this.COL, sourceId);
        const targetRef = FbUtils.doc(this.firestore, this.COL, targetId);

        return from(FbUtils.runTransaction(this.firestore, async (transaction) => {
            const sourceDoc = await transaction.get(sourceRef);
            const targetDoc = await transaction.get(targetRef);

            if (!sourceDoc.exists() || !targetDoc.exists()) {
                throw new Error("Um dos itens não foi encontrado.");
            }

            const sourceQty = sourceDoc.data()?.['quantity'] || 0;
            const targetQty = targetDoc.data()?.['quantity'] || 0;

            transaction.update(targetRef, { 
                quantity: targetQty + sourceQty,
                updatedAt: new Date()
            });

            transaction.delete(sourceRef);
        })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true)
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true)
        );
    }

    private updateCache(data: StockItem[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private fromFirestore(id: string, data: Record<string, unknown>): StockItem {
        return {
            ...data,
            id,
            updatedAt: (data['updatedAt'] as { toDate?: () => Date })?.toDate ? (data['updatedAt'] as { toDate: () => Date }).toDate() : new Date(data['updatedAt'] as string),
        } as StockItem;
    }
}
