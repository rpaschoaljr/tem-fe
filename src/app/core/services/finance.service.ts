import { Injectable, inject } from '@angular/core';
import { of, Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { Firestore } from '@angular/fire/firestore';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { Normalizer } from '../../shared/utils/normalizer';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class FinanceService {
    private firestore = inject(Firestore);
    private logger = inject(LoggerService);
    private COL = 'transactions';

    constructor() { }

    getTransactions(): Observable<Transaction[]> {
        const colRef = FbUtils.collection(this.firestore, this.COL);
        return (FbUtils.collectionData(FbUtils.query(colRef), { idField: 'id' }) as Observable<Record<string, unknown>[]>).pipe(
            map(data => data.map(d => this.fromFirestore(d['id'] as string, d))),
            catchError(err => {
                const errorCode = (err as any)?.code;
                const errorMessage = String((err as any)?.message || '');
                
                if (errorCode === 'permission-denied' || errorMessage.includes('admin is undefined')) {
                    this.logger.debug('Acesso bloqueado por segurança', err);
                    return of([]); // Retorna array vazio em vez de quebrar a tela com um erro vermelho
                }

                this.logger.error('Erro ao escutar transações', err);
                return throwError(() => new Error('Não foi possível conectar ao servidor financeiro.'));
            })
        );
    }

    save(transaction: Transaction): Observable<boolean> {
        if (!transaction) {
            return throwError(() => new Error('Dados da transação inválidos.'));
        }
        if (!transaction.description || typeof transaction.description !== 'string' || transaction.description.trim() === '') {
            return throwError(() => new Error('Descrição é obrigatória.'));
        }
        if (typeof transaction.value !== 'number' || isNaN(transaction.value)) {
            return throwError(() => new Error('Valor inválido.'));
        }
        if (transaction.type !== 'Entrada' && transaction.type !== 'Saída') {
            return throwError(() => new Error('Tipo de transação inválido. Deve ser Entrada ou Saída.'));
        }
        if (!transaction.category || typeof transaction.category !== 'string' || transaction.category.trim() === '') {
            return throwError(() => new Error('Categoria é obrigatória.'));
        }

        const isNew = !transaction.id;
        const colRef = FbUtils.collection(this.firestore, this.COL);
        const docRef = isNew ? FbUtils.doc(colRef) : FbUtils.doc(this.firestore, this.COL, transaction.id);

        const description_search = Normalizer.search(transaction.description);
        const category_search = Normalizer.search(transaction.category);

        const firestoreData: Record<string, unknown> = { 
            ...JSON.parse(JSON.stringify(transaction)), 
            id: docRef.id, 
            description_search,
            category_search,
            deleted: transaction.deleted ?? false,
            updatedAt: new Date()
        };

        return from(FbUtils.setDoc(docRef, firestoreData, { merge: true })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('FALHA AO REGISTRAR LANÇAMENTO NO SERVIDOR.')))
        );
    }

    softDelete(id: string): Observable<boolean> {
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return throwError(() => new Error('ID inválido.'));
        }
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: true, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao excluir lançamento.')))
        );
    }

    restore(id: string): Observable<boolean> {
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return throwError(() => new Error('ID inválido.'));
        }
        const docRef = FbUtils.doc(this.firestore, this.COL, id);
        return from(FbUtils.updateDoc(docRef, { deleted: false, updatedAt: new Date() })).pipe(
            map(() => true),
            catchError(() => throwError(() => new Error('Erro ao restaurar lançamento.')))
        );
    }

    private fromFirestore(id: string, data: Record<string, unknown>): Transaction {
        return {
            ...data,
            id,
            date: (data['date'] as { toDate?: () => Date })?.toDate ? (data['date'] as { toDate: () => Date }).toDate() : new Date(data['date'] as string),
        } as Transaction;
    }
}
