import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, from, throwError, forkJoin, catchError, map, tap } from 'rxjs';
import { Member } from '../models/member.model';
import { 
    Firestore, 
    collection, 
    collectionData, 
    doc, 
    docData, 
    writeBatch, 
    query, 
    where, 
    getDocs,
    updateDoc,
    getDoc,
    limit
} from '@angular/fire/firestore';
import { Normalizer } from '../../shared/utils/normalizer';

@Injectable({ providedIn: 'root' })
export class MembersService {
    private firestore = inject(Firestore);
    private http = inject(HttpClient);
    
    private COL_BASE = 'members';
    private COL_PRIVATE = 'members_private';
    private COL_SPIRITUAL = 'members_spiritual';

    // --- LEITURA EM TEMPO REAL (Fatia Básica) ---
    getMembers(): Observable<Member[]> {
        console.log('🔥 MembersService: Chamando getMembers()...');
        const colRef = collection(this.firestore, this.COL_BASE);
        // O collectionData já usa onSnapshot internamente. 
        // É tempo real e economiza leituras (Delta updates).
        return (collectionData(colRef, { idField: 'id' }) as Observable<any[]>).pipe(
            tap((data: any[]) => console.log('🔥 MembersService: Dados brutos do collectionData:', data)),
            map((data: any[]) => data.map((m: any) => this.fixDates(m))),
            tap((data: Member[]) => console.log('🔥 MembersService: Membros processados:', data))
        );
    }

    // --- LEITURA DETALHADA (Junta as fatias) ---
    getById(id: string): Observable<Member | undefined> {
        const docBase = doc(this.firestore, this.COL_BASE, id);
        const docPrivate = doc(this.firestore, this.COL_PRIVATE, id);
        const docSpiritual = doc(this.firestore, this.COL_SPIRITUAL, id);

        return forkJoin({
            base: from(getDoc(docBase)).pipe(map(s => s.data())),
            private: from(getDoc(docPrivate)).pipe(map(s => s.data()), catchError(() => of(undefined))),
            spiritual: from(getDoc(docSpiritual)).pipe(map(s => s.data()), catchError(() => of(undefined)))
        }).pipe(
            map(res => {
                if (!res.base) return undefined;
                // Mescla as 3 fatias em um único objeto Member para a UI
                return this.fixDates({
                    ...res.base,
                    ...res.private,
                    ...res.spiritual,
                    id
                } as any);
            })
        );
    }

    // --- ESCRITA ATÔMICA (Fatiada) ---
    save(member: Member): Observable<boolean> {
        const isNew = !member.id;
        const batch = writeBatch(this.firestore);
        
        // Se for novo, gera o ID primeiro
        const id = isNew ? doc(collection(this.firestore, this.COL_BASE)).id : member.id;
        
        const docBase = doc(this.firestore, this.COL_BASE, id);
        const docPrivate = doc(this.firestore, this.COL_PRIVATE, id);
        const docSpiritual = doc(this.firestore, this.COL_SPIRITUAL, id);

        // Prepara as 3 fatias de dados
        const { base, priv, spir } = this.splitMemberData(member, id);

        // Se for novo, faz validações de duplicidade ANTES de rodar o batch
        if (isNew) {
            return this.checkDuplicates(member).pipe(
                map(() => {
                    batch.set(docBase, { ...base, createdAt: new Date(), deleted: false });
                    batch.set(docPrivate, priv);
                    batch.set(docSpiritual, spir);
                    from(batch.commit());
                    return true;
                }),
                catchError(err => throwError(() => new Error(err.message || 'ERRO AO SALVAR MEMBRO.')))
            );
        }

        // Edição (Usa merge: true para não apagar campos existentes nas fatias)
        batch.set(docBase, { ...base, updatedAt: new Date() }, { merge: true });
        batch.set(docPrivate, { ...priv, updatedAt: new Date() }, { merge: true });
        batch.set(docSpiritual, { ...spir, updatedAt: new Date() }, { merge: true });

        return from(batch.commit()).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('FALHA AO ATUALIZAR MEMBRO NO SERVIDOR.')))
        );
    }

    private checkDuplicates(member: Member): Observable<void> {
        const colPriv = collection(this.firestore, this.COL_PRIVATE);
        const cpf_search = Normalizer.numbers(member.cpf);
        const email_search = member.email.toLowerCase();

        const cpfQuery = query(colPriv, where('cpf_search', '==', cpf_search), limit(1));
        const emailQuery = query(colPriv, where('email_search', '==', email_search), limit(1));

        return forkJoin({
            cpfExists: from(getDocs(cpfQuery)).pipe(map(s => !s.empty)),
            emailExists: from(getDocs(emailQuery)).pipe(map(s => !s.empty))
        }).pipe(
            map(res => {
                if (res.cpfExists) throw new Error('ESTE CPF JÁ ESTÁ CADASTRADO.');
                if (res.emailExists) throw new Error('ESTE E-MAIL JÁ ESTÁ EM USO.');
            })
        );
    }

    private splitMemberData(member: Member, id: string) {
        // FATIA 1: BÁSICA
        const base = {
            id,
            name: member.name,
            name_search: Normalizer.search(member.name),
            email: member.email.toLowerCase(),
            role: member.role,
            status: member.status,
            isExempt: member.isExempt ?? false,
            entryDate: member.entryDate,
            updatedAt: new Date()
        };

        // FATIA 2: PRIVADA
        const priv = {
            id,
            email: member.email.toLowerCase(),
            cpf: member.cpf,
            cpf_search: Normalizer.numbers(member.cpf),
            phone: member.phone,
            phone_search: Normalizer.numbers(member.phone),
            address: member.address,
            cep_search: Normalizer.numbers(member.address.cep),
            updatedAt: new Date()
        };

        // FATIA 3: ESPIRITUAL
        const spir = {
            id,
            email: member.email.toLowerCase(),
            showSpiritualData: member.showSpiritualData ?? false,
            rituals: member.rituals || {},
            consecrations: member.consecrations || {},
            observations: member.observations || '',
            updatedAt: new Date()
        };

        return { base, priv, spir };
    }

    softDelete(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL_BASE, id);
        return from(updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            map(() => true)
        );
    }

    restore(id: string): Observable<boolean> {
        const docRef = doc(this.firestore, this.COL_BASE, id);
        return from(updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            map(() => true)
        );
    }

    private fixDates(m: any): Member {
        return {
            ...m,
            createdAt: this.fixDate(m.createdAt),
            updatedAt: this.fixDate(m.updatedAt),
            entryDate: this.fixDate(m.entryDate),
            exitDate: this.fixDate(m.exitDate),
            rituals: m.rituals ? this.fixObjectDates(m.rituals) : {},
            consecrations: m.consecrations ? this.fixObjectDates(m.consecrations) : {}
        } as Member;
    }

    private fixObjectDates(obj: any) {
        const newObj = { ...obj };
        Object.keys(newObj).forEach(k => {
            newObj[k] = this.fixDate(newObj[k]);
        });
        return newObj;
    }

    private fixDate(val: any): Date | null {
        if (!val) return null;
        if (val.toDate) return val.toDate(); // Firebase Timestamp
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    getAddressByCep(cep: string): Observable<any> {
        const cleanCep = cep.replace(/\D/g, '');
        return this.http.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
    }
}
