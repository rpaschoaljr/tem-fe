import { TestBed } from '@angular/core/testing';
import { FinanceService } from './finance.service';
import { LoggerService } from './logger.service';
import { provideFirebaseMocks } from './firebase-testing';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { of, throwError } from 'rxjs';
import { Transaction } from '../models/transaction.model';

describe('FinanceService', () => {
    let service: FinanceService;
    let loggerMock: jasmine.SpyObj<LoggerService>;

    beforeEach(() => {
        loggerMock = jasmine.createSpyObj('LoggerService', ['error', 'info', 'warn', 'debug']);

        TestBed.configureTestingModule({
            providers: [
                FinanceService,
                provideFirebaseMocks(),
                { provide: LoggerService, useValue: loggerMock }
            ]
        });

        service = TestBed.inject(FinanceService);

        // Spy on firestore methods
        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.callFake((...args: any[]) => ({ id: args[2] || 'new-id' }));
        (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.collectionData as any)?.and ? FbUtils.collectionData : spyOn(FbUtils, 'collectionData')) as any).and.returnValue(of([]));
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getTransactions', () => {
        it('should return mapped transactions', (done) => {
            const mockData = [
                { id: '1', date: new Date('2023-01-01T10:00:00Z').toISOString(), value: 100 },
                { id: '2', date: { toDate: () => new Date('2023-01-02T10:00:00Z') }, value: 200 }
            ];
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(of(mockData));

            service.getTransactions().subscribe(transactions => {
                expect(transactions.length).toBe(2);
                expect(transactions[0].id).toBe('1');
                expect(transactions[0].date instanceof Date).toBeTrue();
                expect(transactions[1].id).toBe('2');
                expect(transactions[1].date instanceof Date).toBeTrue();
                done();
            });
        });

        it('should handle errors and return a custom error', (done) => {
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(throwError(() => new Error('Network error')));

            service.getTransactions().subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Não foi possível conectar ao servidor financeiro.');
                    expect(loggerMock.error).toHaveBeenCalled();
                    done();
                }
            });
        });
    });

    describe('save', () => {
        it('should save a new transaction successfully', (done) => {
            const newTransaction: Transaction = {
                id: '',
                description: 'Test Income',
                type: 'Entrada',
                category: 'Dízimo',
                date: new Date(),
                value: 100,
                memberId: 'm1',
                memberName: 'John',
                deleted: false
            };

            service.save(newTransaction).subscribe(result => {
                expect(result).toBeTrue();
                expect(FbUtils.setDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should update an existing transaction successfully', (done) => {
            const existingTransaction: Transaction = {
                id: 't1',
                description: 'Test Income',
                type: 'Entrada',
                category: 'Dízimo',
                date: new Date(),
                value: 100,
                memberId: 'm1',
                memberName: 'John',
                deleted: true
            };

            service.save(existingTransaction).subscribe(result => {
                expect(result).toBeTrue();
                expect(FbUtils.setDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle save error', (done) => {
            (FbUtils.setDoc as jasmine.Spy).and.returnValue(Promise.reject('Firestore error'));

            const transaction: Transaction = {
                id: '',
                description: 'Test',
                type: 'Entrada',
                category: 'Doação',
                date: new Date(),
                value: 50,
                memberId: 'm1',
                memberName: 'John',
                deleted: false
            };

            service.save(transaction).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('FALHA AO REGISTRAR LANÇAMENTO NO SERVIDOR.');
                    done();
                }
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject if transaction is null or undefined', (done) => {
                service.save(null as any).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Dados da transação inválidos.');
                        done();
                    }
                });
            });

            it('should reject if description is empty or invalid', (done) => {
                const tx = { description: '  ', type: 'Entrada', category: 'x', value: 10 } as any;
                service.save(tx).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Descrição é obrigatória.');
                        done();
                    }
                });
            });

            it('should reject if value is invalid', (done) => {
                const tx = { description: 'Valid', type: 'Entrada', category: 'x', value: '10' } as any;
                service.save(tx).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Valor inválido.');
                        done();
                    }
                });
            });

            it('should reject if type is invalid', (done) => {
                const tx = { description: 'Valid', type: 'Other', category: 'x', value: 10 } as any;
                service.save(tx).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Tipo de transação inválido. Deve ser Entrada ou Saída.');
                        done();
                    }
                });
            });

            it('should reject if category is missing', (done) => {
                const tx = { description: 'Valid', type: 'Entrada', category: '', value: 10 } as any;
                service.save(tx).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Categoria é obrigatória.');
                        done();
                    }
                });
            });
        });
    });

    describe('softDelete', () => {
        it('should soft delete a transaction successfully', (done) => {
            service.softDelete('t1').subscribe(result => {
                expect(result).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle soft delete error', (done) => {
            (FbUtils.updateDoc as jasmine.Spy).and.returnValue(Promise.reject('Firestore error'));

            service.softDelete('t1').subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Erro ao excluir lançamento.');
                    done();
                }
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject invalid id for softDelete', (done) => {
                service.softDelete('').subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('ID inválido.');
                        done();
                    }
                });
            });
        });
    });

    describe('restore', () => {
        it('should restore a transaction successfully', (done) => {
            service.restore('t1').subscribe(result => {
                expect(result).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle restore error', (done) => {
            (FbUtils.updateDoc as jasmine.Spy).and.returnValue(Promise.reject('Firestore error'));

            service.restore('t1').subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Erro ao restaurar lançamento.');
                    done();
                }
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject invalid id for restore', (done) => {
                service.restore(' ').subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('ID inválido.');
                        done();
                    }
                });
            });
        });
    });
});
