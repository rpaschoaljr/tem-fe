import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of, Observable, throwError } from 'rxjs';
import { delay, tap, catchError } from 'rxjs/operators';
import { Member } from '../models/member.model';

@Injectable({
    providedIn: 'root'
})
export class MembersService {
    private http = inject(HttpClient); // Injeção do HttpClient

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
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const now = Date.now();
        const hasCache = localStorage.getItem(this.CACHE_KEY);

        if (!forceRefresh && hasCache && (now - lastFetch < this.CACHE_DURATION)) {
            const cachedData = JSON.parse(hasCache);
            // Reconstrói as datas (JSON vira string)
            const fixedData = cachedData.map((m: any) => this.fixDates(m));
            return of(fixedData);
        }

        return of(this.getMockOrStoredData()).pipe(
            delay(500),
            tap(data => this.updateCache(data))
        );
    }

    // Buscar UM membro por ID (Para edição)
    getById(id: string): Observable<Member | undefined> {
        const data = this.getMockOrStoredData();
        const member = data.find(m => m.id === id);
        return of(member ? this.fixDates(member) : undefined);
    }

    // --- ESCRITA (CREATE / UPDATE) ---
    save(member: Member): Observable<boolean> {
        const currentData = this.getMockOrStoredData();
        const index = currentData.findIndex(m => m.id === member.id);

        if (index >= 0) {
            // UPDATE
            member.updatedAt = new Date();
            currentData[index] = member;
        } else {
            // CREATE
            member.id = Date.now().toString();
            member.createdAt = new Date();
            member.updatedAt = new Date();
            member.deleted = false;
            currentData.push(member);
        }

        this.updateCache(currentData);
        return of(true).pipe(delay(500));
    }

    softDelete(id: string): Observable<boolean> {
        const currentData = this.getMockOrStoredData();
        const item = currentData.find(m => m.id === id);

        if (item) {
            item.deleted = true;
            item.status = 'Inativo';
            this.updateCache(currentData);
            return of(true).pipe(delay(300));
        }
        return throwError(() => new Error('Membro não encontrado.'));
    }

    restore(id: string): Observable<boolean> {
        const currentData = this.getMockOrStoredData();
        const item = currentData.find(m => m.id === id);

        if (item) {
            item.deleted = false;
            item.status = 'Ativo';
            this.updateCache(currentData);
            return of(true).pipe(delay(300));
        }
        return throwError(() => new Error('Erro ao restaurar.'));
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
            // Adicione outros campos de data se necessário aqui
        };
    }
}