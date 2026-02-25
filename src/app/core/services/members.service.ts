import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, from, throwError } from 'rxjs';
import { delay, tap, catchError, map } from 'rxjs/operators';
import { Member } from '../models/member.model';
import {
    Firestore, collection, collectionData, doc, getDoc, setDoc, updateDoc, getDocs
} from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root'
})
export class MembersService {
    private http = inject(HttpClient);
    private firestore = inject(Firestore);

    private COL = 'members';

    // --- localStorage fallback (mantido para quando Firestore não estiver disponível) ---
    private CACHE_KEY = 'members_data';
    private TIME_KEY = 'members_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000;

    // MOCK ATUALIZADO (Compatível com a nova interface completa)
    private initialMockData: Member[] = Array.from({ length: 10 }, (_, k) => ({
        id: k.toString(),
        name: `Membro Teste ${k + 1}`,
        cpf: '000.000.000-00',
        email: `membro${k}@temfe.com`,
        phone: '(11) 99999-9999',
        photoUrl: '',
        address: {
            cep: '00000-000',
            street: 'Rua Exemplo',
            number: '123',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP'
        },
        role: 'MÉDIUM',
        status: 'Ativo',
        deleted: false,
        entryDate: new Date(),
        rituals: {
            initiation: null, baptism: null, baptism1Year: null, coronation: null, crownWashing: null
        },
        consecrations: {},
        createdAt: new Date(),
        updatedAt: new Date()
    }));

    constructor() { }

    // --- LEITURA ---
    getMembers(forceRefresh = false): Observable<Member[]> {
        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            catchError(() => {
                // Fallback para localStorage se Firestore não disponível
                const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
                const hasCache = localStorage.getItem(this.CACHE_KEY);
                if (!forceRefresh && hasCache && (Date.now() - lastFetch < this.CACHE_DURATION)) {
                    return of(JSON.parse(hasCache).map((m: any) => this.fixDates(m)));
                }
                return of(this.getMockOrStoredData()).pipe(
                    delay(500),
                    tap(data => this.updateCache(data))
                );
            })
        );
    }

    // Buscar UM membro por ID (Para edição)
    getById(id: string): Observable<Member | undefined> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(getDoc(docRef)).pipe(
            map(d => d.exists() ? this.fromFirestore(d.id, d.data()!) : undefined),
            catchError(() => {
                const data = this.getMockOrStoredData();
                const member = data.find(m => m.id === id);
                return of(member ? this.fixDates(member) : undefined);
            })
        );
    }

    // --- ESCRITA (CREATE / UPDATE) ---
    save(member: Member): Observable<boolean> {
        const isNew = !member.id;
        const colRef = collection(this.firestore, this.COL);
        const docRef = isNew ? doc(colRef) : doc(this.firestore, this.COL, member.id);

        const data = {
            ...this.toFirestore(member),
            id: docRef.id,
            updatedAt: new Date(),
            ...(isNew ? { createdAt: new Date(), deleted: false } : {})
        };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            map(() => true),
            catchError(() => {
                // Fallback localStorage
                const currentData = this.getMockOrStoredData();
                const index = currentData.findIndex(m => m.id === member.id);
                if (index >= 0) {
                    member.updatedAt = new Date();
                    currentData[index] = member;
                } else {
                    member.id = Date.now().toString();
                    member.createdAt = new Date();
                    member.updatedAt = new Date();
                    member.deleted = false;
                    currentData.push(member);
                }
                this.updateCache(currentData);
                return of(true).pipe(delay(300));
            })
        );
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: true, status: 'Inativo', updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const item = currentData.find(m => m.id === id);
                if (item) { item.deleted = true; item.status = 'Inativo'; this.updateCache(currentData); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Membro não encontrado.'));
            })
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL, id);
        return from(updateDoc(docRef, { deleted: false, status: 'Ativo', updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => {
                const currentData = this.getMockOrStoredData();
                const item = currentData.find(m => m.id === id);
                if (item) { item.deleted = false; item.status = 'Ativo'; this.updateCache(currentData); return of(true).pipe(delay(300)); }
                return throwError(() => new Error('Erro ao restaurar.'));
            })
        );
    }

    // --- EXTERNO (API VIA CEP) ---
    getAddressByCep(cep: string): Observable<any> {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return of({ erro: true });

        return this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`).pipe(
            catchError(() => of({ erro: true }))
        );
    }

    // --- HELPERS ---
    private updateCache(data: Member[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): Member[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
            return JSON.parse(stored).map((m: any) => this.fixDates(m));
        }
        return this.initialMockData;
    }

    // Converte strings de data do JSON de volta para objetos Date
    private fixDates(m: any): Member {
        return {
            ...m,
            entryDate: m.entryDate ? new Date(m.entryDate) : new Date(),
            createdAt: new Date(m.createdAt),
            updatedAt: new Date(m.updatedAt)
        };
    }

    // Converte doc Firestore → Member (Timestamps → Date)
    private fromFirestore(id: string, data: any): Member {
        const toDate = (v: any) => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
        return {
            ...data,
            id,
            entryDate: toDate(data.entryDate) ?? new Date(),
            exitDate: toDate(data.exitDate),
            createdAt: toDate(data.createdAt) ?? new Date(),
            updatedAt: toDate(data.updatedAt) ?? new Date(),
        } as Member;
    }

    // Remove campos undefined que o Firestore rejeita
    private toFirestore(member: Member): any {
        return JSON.parse(JSON.stringify(member));
    }
}