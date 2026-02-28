import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Member } from '../models/member.model';
import {
    Firestore, collection, getDocs, doc, setDoc, updateDoc, getDoc
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class MembersService {
    private firestore = inject(Firestore);
    private http = inject(HttpClient);
    private COL = 'members';

    private CACHE_KEY = 'members_data';
    private TIME_KEY = 'members_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    constructor() { }

    // --- LEITURA ---
    getMembers(forceRefresh = false): Observable<Member[]> {
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const hasCache = localStorage.getItem(this.CACHE_KEY);
        const isCacheFresh = (Date.now() - lastFetch < this.CACHE_DURATION);

        // Retorna cache apenas se estiver fresco e não for refresh forçado
        if (!forceRefresh && hasCache && isCacheFresh) {
            return of(JSON.parse(hasCache).map((m: any) => this.fixDates(m)));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError((err) => {
                // Se falhar a rede mas tiver cache (mesmo velho), usamos como último recurso
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((m: any) => this.fixDates(m)));
                }
                // Se não tem nada, retorna erro real para a UI tratar
                return throwError(() => new Error('Sem comunicação com o servidor e sem dados em cache.'));
            })
        );
    }

    getById(id: string): Observable<Member | undefined> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(getDoc(docRef)).pipe(
            map(d => d.exists() ? this.fromFirestore(d.id, d.data()!) : undefined),
            catchError(() => throwError(() => new Error('Não foi possível carregar o membro. Verifique sua conexão.')))
        );
    }

    // --- ESCRITA (SEGURA: Só confirma se gravar no Firestore) ---
    save(member: Member): Observable<boolean> {
        const isNew = !member.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, member.id);

        if (member.name) {
            member.name = member.name.trim().toUpperCase();
        }

        const data = {
            ...this.toFirestore(member),
            id: docRef.id,
            updatedAt: new Date(),
            ...(isNew ? { createdAt: new Date(), deleted: false } : {})
        };

        // REMOVIDO FALLBACK LOCAL: Se der erro no setDoc, o erro sobe para a UI
        return from(setDoc(docRef, data, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)), // Invalida cache para forçar recarga
            map(() => true),
            catchError((err) => throwError(() => new Error('Erro ao salvar no servidor. Verifique sua internet.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Não foi possível excluir. Erro de conexão.')))
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('Não foi possível restaurar. Erro de conexão.')))
        );
    }

    private updateCache(data: Member[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private fromFirestore(id: string, data: any): Member {
        return {
            ...data,
            id,
            createdAt: this.fixDate(data.createdAt),
            updatedAt: this.fixDate(data.updatedAt),
            birthDate: this.fixDate(data.birthDate),
            entryDate: this.fixDate(data.entryDate),
            exitDate: this.fixDate(data.exitDate),
            baptismDate: this.fixDate(data.baptismDate),
            coronationDate: this.fixDate(data.coronationDate),
        } as Member;
    }

    private fixDates(m: any): Member {
        return {
            ...m,
            createdAt: this.fixDate(m.createdAt),
            updatedAt: this.fixDate(m.updatedAt),
            birthDate: this.fixDate(m.birthDate),
            entryDate: this.fixDate(m.entryDate),
            exitDate: this.fixDate(m.exitDate),
            baptismDate: this.fixDate(m.baptismDate),
            coronationDate: this.fixDate(m.coronationDate),
        };
    }

    private fixDate(val: any): Date | null {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        return new Date(val);
    }

    private toFirestore(member: Member): any {
        return JSON.parse(JSON.stringify(member));
    }

    getAddressByCep(cep: string): Observable<any> {
        const cleanCep = cep.replace(/\D/g, '');
        return this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
    }
}
