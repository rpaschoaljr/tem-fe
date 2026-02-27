import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { delay, tap, catchError, map } from 'rxjs/operators';
import { Notice } from '../models/notice.model';
import {
    Firestore, collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where, orderBy
} from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root'
})
export class NoticesService {
    private firestore = inject(Firestore);
    private COL = 'notices';

    // --- localStorage fallback ---
    private CACHE_KEY = 'notices_data';
    private TIME_KEY = 'notices_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    private initialMockData: Notice[] = [
        {
            id: '1',
            title: 'Próxima Gira: Caboclos',
            subtitle: 'Sexta-feira, 20:00h',
            content: 'Avisar a todos os médiuns para chegarem 1h antes para a firmeza da porteira. Trazer guia verde e cocar quem tiver.',
            type: 'event',
            date: new Date(),
            deleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: '2',
            title: 'Mensalidade do Terreiro',
            subtitle: 'Vencimento dia 10',
            content: 'Lembrete da tesouraria: Ajudem a manter a casa aberta. O aluguel vence na próxima semana.',
            type: 'payment',
            date: new Date(),
            deleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    // --- LEITURA ---
    getNotices(forceRefresh = false): Observable<Notice[]> {
        const colRef = collection(this.firestore, this.COL);
        
        return from(getDocs(colRef)).pipe(
            map(snap => {
                const list = snap.docs.map(d => this.fromFirestore(d.id, d.data()));
                // Ordenação manual no client-side para evitar problemas de índice no emulador
                return list.sort((a, b) => b.date.getTime() - a.date.getTime());
            }),
            catchError(() => {
                const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
                const hasCache = localStorage.getItem(this.CACHE_KEY);
                if (!forceRefresh && hasCache && (Date.now() - lastFetch < this.CACHE_DURATION)) {
                    return of(JSON.parse(hasCache).map((n: any) => this.fixDates(n)));
                }
                return of(this.getMockOrStoredData()).pipe(
                    delay(500),
                    tap(data => this.updateCache(data))
                );
            })
        );
    }

    getActiveNotices(): Observable<Notice[]> {
        return this.getNotices().pipe(
            map(notices => notices.filter(n => {
                if (n.deleted) return false;
                if (!n.expirationDate) return true;
                return new Date(n.expirationDate) >= new Date();
            }))
        );
    }

    getArchivedNotices(): Observable<Notice[]> {
        return this.getNotices().pipe(
            map(notices => notices.filter(n => {
                if (n.deleted) return false;
                if (!n.expirationDate) return false;
                return new Date(n.expirationDate) < new Date();
            }))
        );
    }

    // --- ESCRITA ---
    save(notice: Notice): Observable<boolean> {
        const isNew = !notice.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, notice.id);

        const data = {
            ...this.toFirestore(notice),
            id: docRef.id,
            updatedAt: new Date(),
            ...(isNew ? { createdAt: new Date(), deleted: false } : {})
        };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const index = currentData.findIndex(n => n.id === notice.id);
                if (index >= 0) {
                    notice.updatedAt = new Date();
                    currentData[index] = notice;
                } else {
                    notice.id = Date.now().toString();
                    notice.createdAt = new Date();
                    notice.updatedAt = new Date();
                    notice.deleted = false;
                    currentData.push(notice);
                }
                this.updateCache(currentData);
                return of(true).pipe(delay(300));
            })
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const item = currentData.find(n => n.id === id);
                if (item) { 
                  item.deleted = true; 
                  this.updateCache(currentData); 
                  return of(true).pipe(delay(300)); 
                }
                return throwError(() => new Error('Aviso não encontrado.'));
            })
        );
    }

    // --- HELPERS ---
    private updateCache(data: Notice[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): Notice[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
            return JSON.parse(stored).map((n: any) => this.fixDates(n));
        }
        return this.initialMockData;
    }

    private fixDates(n: any): Notice {
        return {
            ...n,
            date: n.date ? new Date(n.date) : new Date(),
            expirationDate: n.expirationDate ? new Date(n.expirationDate) : null,
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt)
        };
    }

    private fromFirestore(id: string, data: any): Notice {
        const toDate = (v: any) => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
        return {
            ...data,
            id,
            date: toDate(data.date) ?? new Date(),
            expirationDate: toDate(data.expirationDate),
            createdAt: toDate(data.createdAt) ?? new Date(),
            updatedAt: toDate(data.updatedAt) ?? new Date(),
        } as Notice;
    }

    private toFirestore(notice: Notice): any {
        return JSON.parse(JSON.stringify(notice));
    }
}
