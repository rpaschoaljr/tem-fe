import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { delay, tap, catchError, map } from 'rxjs/operators';
import { Notice } from '../models/notice.model';
import { Firestore } from '@angular/fire/firestore';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { LoggerService } from './logger.service';

@Injectable({
    providedIn: 'root'
})
export class NoticesService {
    private firestore = inject(Firestore);
    private logger = inject(LoggerService);
    private COL = 'notices';

    private CACHE_KEY = 'notices_data';
    private TIME_KEY = 'notices_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    private initialMockData: Notice[] = [];

    getNotices(forceRefresh = false): Observable<Notice[]> {
        const colRef = FbUtils.collection(this.firestore, this.COL);
        
        return from(FbUtils.getDocs(colRef)).pipe(
            map(snap => {
                const list = snap.docs.map(d => this.fromFirestore(d.id, d.data()));
                return list.sort((a, b) => b.date.getTime() - a.date.getTime());
            }),
            catchError(() => {
                const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
                const hasCache = localStorage.getItem(this.CACHE_KEY);
                if (!forceRefresh && hasCache && (Date.now() - lastFetch < this.CACHE_DURATION)) {
                    return of(JSON.parse(hasCache).map((n: Record<string, unknown>) => this.fixDates(n)));
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

    getDeletedNotices(): Observable<Notice[]> {
        return this.getNotices().pipe(
            map(notices => notices.filter(n => n.deleted === true))
        );
    }

    save(notice: Notice): Observable<boolean> {
        const isNew = !notice.id;
        const colRef = FbUtils.collection(this.firestore, this.COL);
        const docRef = isNew ? FbUtils.doc(colRef) : FbUtils.doc(this.firestore, this.COL, notice.id);

        const data = {
            ...this.toFirestore(notice),
            id: docRef.id,
            updatedAt: new Date(),
            ...(isNew ? { createdAt: new Date(), deleted: false } : {})
        };

        return from(FbUtils.setDoc(docRef, data, { merge: true })).pipe(
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
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
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

    restore(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const item = currentData.find(n => n.id === id);
                if (item) { 
                  item.deleted = false; 
                  this.updateCache(currentData); 
                  return of(true).pipe(delay(300)); 
                }
                return throwError(() => new Error('Aviso não encontrado.'));
            })
        );
    }

    hardDelete(id: string): Observable<boolean> {
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.deleteDoc(docRef)).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const index = currentData.findIndex(n => n.id === id);
                if (index >= 0) {
                    currentData.splice(index, 1);
                    this.updateCache(currentData);
                    return of(true).pipe(delay(300));
                }
                return throwError(() => new Error('Aviso não encontrado.'));
            })
        );
    }

    private updateCache(data: Notice[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): Notice[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
            return JSON.parse(stored).map((n: Record<string, unknown>) => this.fixDates(n));
        }
        return this.initialMockData;
    }

    private fixDates(n: Record<string, unknown>): Notice {
        return {
            ...n,
            date: n['date'] ? new Date(n['date'] as string) : new Date(),
            expirationDate: n['expirationDate'] ? new Date(n['expirationDate'] as string) : null,
            createdAt: n['createdAt'] ? new Date(n['createdAt'] as string) : new Date(),
            updatedAt: n['updatedAt'] ? new Date(n['updatedAt'] as string) : new Date()
        } as unknown as Notice;
    }

    private fromFirestore(id: string, data: Record<string, unknown>): Notice {
        const toDate = (v: unknown) => (v as { toDate?: () => Date })?.toDate ? (v as { toDate: () => Date }).toDate() : (v ? new Date(v as string) : null);
        return {
            ...data,
            id,
            date: toDate(data['date']) ?? new Date(),
            expirationDate: toDate(data['expirationDate']),
            createdAt: toDate(data['createdAt']) ?? new Date(),
            updatedAt: toDate(data['updatedAt']) ?? new Date(),
        } as Notice;
    }

    private toFirestore(notice: Notice): Record<string, unknown> {
        return JSON.parse(JSON.stringify(notice));
    }
}
