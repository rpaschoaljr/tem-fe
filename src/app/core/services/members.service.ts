import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, from, throwError, forkJoin } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { Member } from '../models/member.model';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { Normalizer } from '../../shared/utils/normalizer';

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

        if (!forceRefresh && hasCache && isCacheFresh) {
            return of(JSON.parse(hasCache).map((m: any) => this.fixDates(m)));
        }

        const colRef = collection(this.firestore, this.COL);
        return from(getDocs(colRef)).pipe(
            map(snap => snap.docs.map(d => this.fromFirestore(d.id, d.data()))),
            tap(data => this.updateCache(data)),
            catchError((err) => {
                if (hasCache) {
                    return of(JSON.parse(hasCache).map((m: any) => this.fixDates(m)));
                }
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

        // NORMALIZAÇÃO RIGOROSA
        member.name = Normalizer.text(member.name);
        member.email = Normalizer.email(member.email);
        member.cpf = Normalizer.numbers(member.cpf);
        member.phone = Normalizer.numbers(member.phone);
        
        if (member.address) {
            member.address.cep = Normalizer.numbers(member.address.cep);
            member.address.street = Normalizer.text(member.address.street);
            member.address.neighborhood = Normalizer.text(member.address.neighborhood);
            member.address.city = Normalizer.text(member.address.city);
            member.address.state = Normalizer.text(member.address.state);
        }

        // Se for novo membro, verifica duplicidade usando os dados normalizados
        if (isNew) {
            const cpfQuery = query(colRef, where('cpf', '==', member.cpf), where('deleted', '==', false));
            const emailQuery = query(colRef, where('email', '==', member.email), where('deleted', '==', false));

            return forkJoin({
                cpfExists: from(getDocs(cpfQuery)).pipe(map(s => !s.empty)),
                emailExists: from(getDocs(emailQuery)).pipe(map(s => !s.empty))
            }).pipe(
                switchMap(res => {
                    if (res.cpfExists) return throwError(() => new Error('ESTE CPF JA ESTA CADASTRADO PARA OUTRO MEMBRO ATIVO.'));
                    if (res.emailExists) return throwError(() => new Error('ESTE E-MAIL JA ESTA EM USO POR OUTRO MEMBRO ATIVO.'));

                    const docRef = doc(colRef);
                    const data = {
                        ...this.toFirestore(member),
                        id: docRef.id,
                        updatedAt: new Date(),
                        createdAt: new Date(),
                        deleted: false
                    };
                    return from(setDoc(docRef, data));
                }),
                tap(() => localStorage.removeItem(this.TIME_KEY)),
                map(() => true),
                catchError(err => throwError(() => new Error(err.message || 'ERRO AO SALVAR MEMBRO.')))
            );
        }

        // Edição
        const docRef = doc(this.firestore, this.COL, member.id);
        const data = {
            ...this.toFirestore(member),
            updatedAt: new Date()
        };

        return from(setDoc(docRef, data, { merge: true })).pipe(
            tap(() => localStorage.removeItem(this.TIME_KEY)),
            map(() => true),
            catchError(() => throwError(() => new Error('FALHA AO ATUALIZAR MEMBRO NO SERVIDOR.')))
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
        const member = {
            ...data,
            id,
            createdAt: this.fixDate(data.createdAt),
            updatedAt: this.fixDate(data.updatedAt),
            entryDate: this.fixDate(data.entryDate),
            exitDate: this.fixDate(data.exitDate),
        } as Member;

        if (member.rituals) {
            Object.keys(member.rituals).forEach(k => {
                (member.rituals as any)[k] = this.fixDate((member.rituals as any)[k]);
            });
        }

        if (member.consecrations) {
            Object.keys(member.consecrations).forEach(k => {
                (member.consecrations as any)[k] = this.fixDate((member.consecrations as any)[k]);
            });
        }

        if ((member as any).customFields) {
            Object.keys((member as any).customFields).forEach(k => {
                (member as any).customFields[k] = this.fixDate((member as any).customFields[k]);
            });
        }

        return member;
    }

    private fixDates(m: any): Member {
        return this.fromFirestore(m.id, m);
    }

    private fixDate(val: any): Date | null {
        if (!val) return null;
        if (typeof val === 'string' && val.includes('-') && val.includes('T')) {
            return new Date(val);
        }
        if (val instanceof Date) return val;
        if (val && typeof val === 'object' && 'seconds' in val) {
            return new Date(val.seconds * 1000);
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    private toFirestore(member: Member): any {
        const data = { ...member };
        delete (data as any).id;
        return data;
    }

    getAddressByCep(cep: string): Observable<any> {
        const cleanCep = cep.replace(/\D/g, '');
        return this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
    }
}
