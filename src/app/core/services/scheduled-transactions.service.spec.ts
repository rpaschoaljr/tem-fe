import { TestBed } from '@angular/core/testing';
import { ScheduledTransactionsService } from './scheduled-transactions.service';
import { FinanceService } from './finance.service';
import { LoggerService } from './logger.service';
import { provideFirebaseMocks } from './firebase-testing';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { of, throwError } from 'rxjs';
import { ScheduledTransaction } from '../models/scheduled-transaction.model';

describe('ScheduledTransactionsService', () => {
    let service: ScheduledTransactionsService;
    let financeServiceMock: jasmine.SpyObj<FinanceService>;
    let loggerMock: jasmine.SpyObj<LoggerService>;

    beforeEach(() => {
        financeServiceMock = jasmine.createSpyObj('FinanceService', ['save']);
        loggerMock = jasmine.createSpyObj('LoggerService', ['error', 'info', 'warn', 'debug']);

        TestBed.configureTestingModule({
            providers: [
                ScheduledTransactionsService,
                provideFirebaseMocks(),
                { provide: FinanceService, useValue: financeServiceMock },
                { provide: LoggerService, useValue: loggerMock }
            ]
        });

        service = TestBed.inject(ScheduledTransactionsService);

        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.callFake((...args: any[]) => ({ id: args[2] || 'new-id' }));
        (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.collectionData as any)?.and ? FbUtils.collectionData : spyOn(FbUtils, 'collectionData')) as any).and.returnValue(of([]));
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getAll', () => {
        it('should return mapped scheduled transactions', (done) => {
            const mockData = [
                { id: '1', description: 'T1', nextDueDate: new Date('2023-01-01').toISOString(), lastAppliedDate: new Date('2022-12-01').toISOString() },
                { id: '2', description: 'T2', nextDueDate: null }
            ];
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(of(mockData));

            service.getAll().subscribe(data => {
                expect(data.length).toBe(2);
                expect(data[0].id).toBe('1');
                expect(data[0].nextDueDate instanceof Date).toBeTrue();
                expect(data[0].lastAppliedDate instanceof Date).toBeTrue();
                expect(data[1].id).toBe('2');
                expect(data[1].nextDueDate instanceof Date).toBeTrue();
                expect(data[1].lastAppliedDate).toBeUndefined();
                done();
            });
        });

        it('should handle errors when loading data', (done) => {
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(throwError(() => new Error('Network Error')));

            service.getAll().subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Não foi possível carregar agendamentos.');
                    expect(loggerMock.error).toHaveBeenCalled();
                    done();
                }
            });
        });
    });

    describe('getDue', () => {
        it('should return only active, non-deleted items that are due', (done) => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);
            
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const mockData = [
                { id: '1', active: true, deleted: false, nextDueDate: pastDate.toISOString() }, // due
                { id: '2', active: false, deleted: false, nextDueDate: pastDate.toISOString() }, // not active
                { id: '3', active: true, deleted: true, nextDueDate: pastDate.toISOString() }, // deleted
                { id: '4', active: true, deleted: false, nextDueDate: futureDate.toISOString() } // future
            ];
            
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(of(mockData));

            service.getDue().subscribe(data => {
                expect(data.length).toBe(1);
                expect(data[0].id).toBe('1');
                done();
            });
        });
    });

    describe('save', () => {
        it('should save a new scheduled transaction', (done) => {
            const item: any = { active: true, deleted: false, 
                id: '',
                description: 'Mensalidade',
                type: 'Entrada',
                category: 'Dízimo',
                value: 100,
                recurrence: 'monthly',
                nextDueDate: new Date(),
            };

            service.save(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.setDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should update an existing scheduled transaction', (done) => {
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Mensalidade',
                type: 'Entrada',
                category: 'Dízimo',
                value: 100,
                recurrence: 'monthly',
                nextDueDate: new Date()
            };

            service.save(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.setDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle save error', (done) => {
            (FbUtils.setDoc as jasmine.Spy).and.returnValue(Promise.reject('Error'));
            const item = { id: '', description: 'Test', value: 100, type: 'Entrada', category: 'Doação', recurrence: 'once', nextDueDate: new Date() } as ScheduledTransaction;

            service.save(item).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Falha ao salvar agendamento.');
                    done();
                }
            });
        });
    });

    describe('softDelete and restore', () => {
        it('should soft delete successfully', (done) => {
            service.softDelete('s1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle soft delete error', (done) => {
            (FbUtils.updateDoc as jasmine.Spy).and.returnValue(Promise.reject('Error'));
            service.softDelete('s1').subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Erro ao excluir agendamento.');
                    done();
                }
            });
        });

        it('should restore successfully', (done) => {
            service.restore('s1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle restore error', (done) => {
            (FbUtils.updateDoc as jasmine.Spy).and.returnValue(Promise.reject('Error'));
            service.restore('s1').subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Erro ao restaurar agendamento.');
                    done();
                }
            });
        });
    });

    describe('applySchedule', () => {
        it('should apply an output schedule, save transaction, and update schedule', (done) => {
            financeServiceMock.save.and.returnValue(of(true));

            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Conta de Luz',
                type: 'Saída',
                category: 'Contas',
                value: 150, // Should become -150
                recurrence: 'monthly',
                nextDueDate: new Date('2023-01-15T12:00:00Z'),
            };

            service.applySchedule(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(financeServiceMock.save).toHaveBeenCalled();
                const callArgs = financeServiceMock.save.calls.mostRecent().args[0];
                expect(callArgs.value).toBe(-150);
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should apply an input schedule and mark as inactive if recurrence is once', (done) => {
            financeServiceMock.save.and.returnValue(of(true));

            const item: any = { active: true, deleted: false, 
                id: 's2',
                description: 'Doação',
                type: 'Entrada',
                category: 'Doação',
                value: -200, // Should become 200
                recurrence: 'once',
                nextDueDate: new Date('2023-01-15T12:00:00Z'),
            };

            service.applySchedule(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(financeServiceMock.save).toHaveBeenCalled();
                const callArgs = financeServiceMock.save.calls.mostRecent().args[0];
                expect(callArgs.value).toBe(200);
                
                const updateArgs = (FbUtils.updateDoc as jasmine.Spy).calls.mostRecent().args[1];
                expect(updateArgs.active).toBeFalse();
                done();
            });
        });

        it('should handle error when applying schedule', (done) => {
            financeServiceMock.save.and.returnValue(throwError(() => new Error('Error saving transaction')));

            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Doação',
                value: 100,
                recurrence: 'monthly',
                nextDueDate: new Date()
            };

            service.applySchedule(item).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Erro ao lançar agendamento.');
                    done();
                }
            });
        });
    });

    describe('calculateNextDueDate', () => {
        it('should calculate next due date for monthly recurrence', () => {
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Test',
                value: 100,
                recurrence: 'monthly',
                nextDueDate: new Date(2023, 0, 15) // Jan 15, 2023
            };
            const nextDate = service.calculateNextDueDate(item);
            expect(nextDate.getMonth()).toBe(1); // Feb
            expect(nextDate.getDate()).toBe(15);
        });

        it('should calculate next due date for monthly recurrence with dayOfMonth exceeding month length', () => {
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Test',
                value: 100,
                recurrence: 'monthly',
                dayOfMonth: 31,
                nextDueDate: new Date(2023, 0, 31) // Jan 31, 2023
            };
            const nextDate = service.calculateNextDueDate(item);
            expect(nextDate.getMonth()).toBe(1); // Feb
            expect(nextDate.getDate()).toBe(28); // Feb 28, 2023
        });

        it('should calculate next due date for weekly recurrence', () => {
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Test',
                value: 100,
                recurrence: 'weekly',
                nextDueDate: new Date(2023, 0, 1) // Jan 1
            };
            const nextDate = service.calculateNextDueDate(item);
            expect(nextDate.getDate()).toBe(8); // Jan 8
        });

        it('should calculate next due date for yearly recurrence', () => {
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Test',
                value: 100,
                recurrence: 'yearly',
                nextDueDate: new Date(2023, 5, 1)
            };
            const nextDate = service.calculateNextDueDate(item);
            expect(nextDate.getFullYear()).toBe(2024);
        });

        it('should return the same date for other recurrences (like once)', () => {
            const baseDate = new Date(2023, 5, 1);
            const item: any = { active: true, deleted: false, 
                id: 's1',
                description: 'Test',
                type: 'Entrada',
                category: 'Test',
                value: 100,
                recurrence: 'once',
                nextDueDate: baseDate
            };
            const nextDate = service.calculateNextDueDate(item);
            expect(nextDate.getTime()).toBe(baseDate.getTime());
        });
    });
});
