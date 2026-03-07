import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, from, throwError, forkJoin } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { Member } from '../models/member.model';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, query, where } from 'firebase/firestore';

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

        if (member.name) {
            member.name = member.name.trim().toUpperCase();
        }

        // Se for novo membro, verifica duplicidade de CPF e Email
        if (isNew) {
            const cpfQuery = query(colRef, where('cpf', '==', member.cpf), where('deleted', '==', false));
            const emailQuery = query(colRef, where('email', '==', member.email), where('deleted', '==', false));

            return forkJoin({
                cpfExists: from(getDocs(cpfQuery)).pipe(map(s => !s.empty)),
                emailExists: from(getDocs(emailQuery)).pipe(map(s => !s.empty))
            }).pipe(
                switchMap(res => {
                    if (res.cpfExists) return throwError(() => new Error('Este CPF já está cadastrado para outro membro ativo.'));
                    if (res.emailExists) return throwError(() => new Error('Este E-mail já está em uso por outro membro ativo.'));

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
                catchError(err => throwError(() => new Error(err.message || 'Erro ao salvar membro.')))
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
            catchError(() => throwError(() => new Error('Falha ao atualizar membro no servidor.')))
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
        // Se for string de data (ISO), converte
        if (typeof val === 'string' && val.includes('-') && val.includes('T')) {
            return new Date(val);
        }
        // Se for objeto de data nativo
        if (val instanceof Date) return val;
        // Se for timestamp do Firebase
        if (val && typeof val === 'object' && 'seconds' in val) {
            return new Date(val.seconds * 1000);
        }
        // Fallback
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    private toFirestore(member: Member): any {
        // Remove circular references if any (not expected here) and prepare for Firestore
        // We use a simple shallow clone or recursive one if needed.
        // For now, let's just make sure we don't use JSON.stringify if possible.
        const data = { ...member };
        delete (data as any).id;
        return data;
    }

    getAddressByCep(cep: string): Observable<any> {
        const cleanCep = cep.replace(/\D/g, '');
        return this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
    }
}
