import { Injectable } from '@angular/core';
import { of, Observable, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private CACHE_KEY = 'finance_data';
    private TIME_KEY = 'finance_last_fetch';
    private CACHE_DURATION = 15 * 60 * 1000; // 15 Minutos em milissegundos

    // Mock Inicial (Caso não tenha nada no cache)
    private initialMockData: Transaction[] = [
        { id: '1', description: 'Doação Gira de Esquerda', value: 350.00, type: 'Entrada', category: 'Doação', date: new Date(), deleted: false },
        { id: '2', description: 'Compra de Velas', value: -120.50, type: 'Saída', category: 'Liturgia', date: new Date(), deleted: false },
        { id: '3', description: 'Mensalidade - Pai João', value: 50.00, type: 'Entrada', category: 'Mensalidade', date: new Date('2025-11-30'), deleted: false },
        { id: '4', description: 'Conta de Luz', value: -280.00, type: 'Saída', category: 'Contas', date: new Date('2025-12-05'), deleted: false },
        { id: '5', description: 'Reforma do Telhado', value: -1500.00, type: 'Saída', category: 'Manutenção', date: new Date('2025-11-20'), deleted: false },
    ];

    constructor() { }

    /**
     * Busca Inteligente:
     * 1. Verifica se tem cache válido (< 15 min).
     * 2. Se tiver, retorna do LocalStorage (Economiza leitura).
     * 3. Se não, busca do "Banco" (Simulado aqui) e atualiza o cache.
     */
    getTransactions(forceRefresh = false): Observable<Transaction[]> {
        const lastFetch = parseInt(localStorage.getItem(this.TIME_KEY) || '0');
        const now = Date.now();
        const hasCache = localStorage.getItem(this.CACHE_KEY);

        // LÓGICA DO CACHE (Se não forçar atualização e o tempo for válido)
        if (!forceRefresh && hasCache && (now - lastFetch < this.CACHE_DURATION)) {
            // console.log('Lendo do Cache Local (Economia de Recurso)');
            const cachedData = JSON.parse(hasCache);
            // Precisamos converter as strings de data de volta para Objetos Date
            const fixedData = cachedData.map((t: any) => ({ ...t, date: new Date(t.date) }));
            return of(fixedData);
        }

        // SIMULAÇÃO DE LEITURA DO BANCO DE DADOS
        // console.log('Cache expirado ou inexistente. Lendo do Banco de Dados...');
        return of(this.getMockOrStoredData()).pipe(
            delay(500), // Simula delay da rede
            tap(data => this.updateCache(data)) // Atualiza o cache ao receber
        );
    }

    // --- Lógica de Escrita (Sempre tenta ir pro banco primeiro) ---

    softDelete(id: string): Observable<boolean> {
        const currentData = this.getMockOrStoredData();
        const item = currentData.find(t => t.id === id);

        if (item) {
            item.deleted = true;
            this.updateCache(currentData); // Atualiza cache local imediatamente
            return of(true).pipe(delay(300)); // Simula sucesso do banco
        }

        return throwError(() => new Error('Item não encontrado para exclusão.'));
    }

    restore(id: string): Observable<boolean> {
        const currentData = this.getMockOrStoredData();
        const item = currentData.find(t => t.id === id);

        if (item) {
            item.deleted = false;
            this.updateCache(currentData);
            return of(true).pipe(delay(300));
        }
        return throwError(() => new Error('Erro ao restaurar item.'));
    }

    // Simula o erro de edição (já que não temos tela ainda)
    update(transaction: Transaction): Observable<any> {
        // Aqui forçamos um erro para testar o try/catch do componente
        return throwError(() => new Error('Funcionalidade de Edição ainda não implementada no Banco de Dados.'));
    }

    // --- Helpers Privados ---

    private updateCache(data: Transaction[]) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(this.TIME_KEY, Date.now().toString());
    }

    private getMockOrStoredData(): Transaction[] {
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
            return JSON.parse(stored).map((t: any) => ({ ...t, date: new Date(t.date) }));
        }
        return this.initialMockData;
    }
}