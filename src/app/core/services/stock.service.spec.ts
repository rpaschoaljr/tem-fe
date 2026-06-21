import { TestBed } from '@angular/core/testing';
import { StockService } from './stock.service';
import { LoggerService } from './logger.service';
import { provideFirebaseMocks } from './firebase-testing';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { StockItem } from '../models/stock-item.model';

describe('StockService', () => {
    let service: StockService;
    let loggerMock: jasmine.SpyObj<LoggerService>;

    beforeEach(() => {
        loggerMock = jasmine.createSpyObj('LoggerService', ['error', 'info', 'warn', 'debug']);

        TestBed.configureTestingModule({
            providers: [
                StockService,
                provideFirebaseMocks(),
                { provide: LoggerService, useValue: loggerMock }
            ]
        });

        service = TestBed.inject(StockService);

        localStorage.removeItem('stock_data');
        localStorage.removeItem('stock_last_fetch');

        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.callFake((...args: any[]) => ({ id: args[2] || 'new-id' }));
        (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.deleteDoc as any)?.and ? FbUtils.deleteDoc : spyOn(FbUtils, 'deleteDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.query as any)?.and ? FbUtils.query : spyOn(FbUtils, 'query')) as any).and.returnValue({} as any);
        (((FbUtils.where as any)?.and ? FbUtils.where : spyOn(FbUtils, 'where')) as any).and.returnValue({} as any);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getStock', () => {
        it('should fetch stock from Firestore if cache is empty', (done) => {
            const mockDate = new Date();
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({
                docs: [
                    { id: '1', data: () => ({ name: 'Vela', quantity: 10, updatedAt: mockDate.toISOString() }) },
                    { id: '2', data: () => ({ name: 'Incenso', quantity: 5, updatedAt: { toDate: () => mockDate } }) }
                ]
            }));

            service.getStock().subscribe(data => {
                expect(data.length).toBe(2);
                expect(data[0].id).toBe('1');
                expect(data[0].name).toBe('Vela');
                expect(data[0].updatedAt instanceof Date).toBeTrue();
                expect(data[1].id).toBe('2');
                expect(data[1].updatedAt instanceof Date).toBeTrue();
                expect(localStorage.getItem('stock_data')).toBeTruthy();
                done();
            });
        });

        it('should return cached stock if available and not forced refresh', (done) => {
            const cachedData = [{ id: '1', name: 'Cached Item', updatedAt: new Date().toISOString() }];
            localStorage.setItem('stock_data', JSON.stringify(cachedData));
            localStorage.setItem('stock_last_fetch', Date.now().toString());

            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any); // Should not be called

            service.getStock().subscribe(data => {
                expect(data.length).toBe(1);
                expect(data[0].name).toBe('Cached Item');
                expect(data[0].updatedAt instanceof Date).toBeTrue();
                expect(FbUtils.getDocs).not.toHaveBeenCalled();
                done();
            });
        });

        it('should fetch stock from Firestore if forceRefresh is true', (done) => {
            const cachedData = [{ id: '1', name: 'Cached Item', updatedAt: new Date().toISOString() }];
            localStorage.setItem('stock_data', JSON.stringify(cachedData));
            localStorage.setItem('stock_last_fetch', Date.now().toString());

            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({
                docs: [
                    { id: '2', data: () => ({ name: 'Fresh Item', quantity: 10, updatedAt: new Date().toISOString() }) }
                ]
            }));

            service.getStock(true).subscribe(data => {
                expect(data.length).toBe(1);
                expect(data[0].name).toBe('Fresh Item');
                expect(FbUtils.getDocs).toHaveBeenCalled();
                done();
            });
        });

        it('should fallback to cache on error if cache exists', (done) => {
            const cachedData = [{ id: '1', name: 'Cached Item', updatedAt: new Date().toISOString() }];
            localStorage.setItem('stock_data', JSON.stringify(cachedData));
            
            // Set an old fetch time to force refresh
            localStorage.setItem('stock_last_fetch', (Date.now() - 30 * 60 * 1000).toString());

            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.reject('Network Error'));

            service.getStock().subscribe(data => {
                expect(data.length).toBe(1);
                expect(data[0].name).toBe('Cached Item');
                done();
            });
        });

        it('should throw an error on network error if no cache exists', (done) => {
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.reject('Network Error'));

            service.getStock().subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Não foi possível carregar o estoque. Sem conexão.');
                    done();
                }
            });
        });
    });

    describe('save', () => {
        it('should save a new item if no duplicate is found', (done) => {
            const item: any = { unit: 'un', deleted: false, updatedAt: new Date(), 
                id: '',
                name: 'New Item',
                category: 'Material',
                quantity: 10,
            };

            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({ empty: true }));

            service.save(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.getDocs).toHaveBeenCalled(); // queries duplicate
                expect(FbUtils.setDoc).toHaveBeenCalled();
                expect(localStorage.getItem('stock_last_fetch')).toBeNull(); // Cache invalidated
                done();
            });
        });

        it('should handle error when duplicate item exists', (done) => {
            const item: any = { unit: 'un', deleted: false, updatedAt: new Date(),  id: '', name: 'Existing Item', category: 'Material', quantity: 10 };
            
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({ empty: false }));

            service.save(item).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('JA EXISTE UM ITEM ATIVO COM ESTE NOME NO CATALOGO.');
                    done();
                }
            });
        });

        it('should update an existing item directly', (done) => {
            const item: any = { unit: 'un', deleted: false, updatedAt: new Date(), 
                id: '1',
                name: 'Existing Item',
                category: 'Material',
                quantity: 10,
            };

            service.save(item).subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.setDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should handle save error on existing item', (done) => {
            (FbUtils.setDoc as jasmine.Spy).and.returnValue(Promise.reject('Error'));
            const item: any = { unit: 'un', deleted: false, updatedAt: new Date(),  id: '1', name: 'Item', category: 'Material', quantity: 5 };

            service.save(item).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('FALHA AO ATUALIZAR ITEM NO SERVIDOR.');
                    done();
                }
            });
        });

        it('should handle save error on new item', (done) => {
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({ empty: true }));
            (FbUtils.setDoc as jasmine.Spy).and.returnValue(Promise.reject(new Error('Test Error')));
            const item: any = { unit: 'un', deleted: false, updatedAt: new Date(),  id: '', name: 'Item', category: 'Material', quantity: 5 };

            service.save(item).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Test Error');
                    done();
                }
            });
        });
    });

    describe('mergeItems', () => {
        it('should merge two items and update target while deleting source', (done) => {
            const transactionMock = {
                get: jasmine.createSpy('get').and.callFake((ref: any) => {
                    return Promise.resolve({
                        exists: () => true,
                        data: () => ({ quantity: 10 })
                    });
                }),
                update: jasmine.createSpy('update'),
                delete: jasmine.createSpy('delete')
            };

            (((FbUtils.runTransaction as any)?.and ? FbUtils.runTransaction : spyOn(FbUtils, 'runTransaction')) as any).and.callFake((fs: any, callback: any) => {
                return callback(transactionMock);
            });

            service.mergeItems('source', 'target').subscribe(() => {
                expect(transactionMock.get).toHaveBeenCalledTimes(2);
                expect(transactionMock.update).toHaveBeenCalled();
                const updateArgs = transactionMock.update.calls.mostRecent().args;
                expect(updateArgs[1].quantity).toBe(20); // 10 + 10
                expect(transactionMock.delete).toHaveBeenCalled();
                done();
            });
        });

        it('should handle missing item in merge', (done) => {
            const transactionMock = {
                get: jasmine.createSpy('get').and.callFake((ref: any) => {
                    return Promise.resolve({
                        exists: () => ref.id !== 'source', // source doesn't exist
                        data: () => ({ quantity: 10 })
                    });
                })
            };

            (((FbUtils.runTransaction as any)?.and ? FbUtils.runTransaction : spyOn(FbUtils, 'runTransaction')) as any).and.callFake(async (fs: any, callback: any) => {
                return callback(transactionMock);
            });

            service.mergeItems('source', 'target').subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Um dos itens não foi encontrado.');
                    done();
                }
            });
        });
    });

    describe('softDelete and restore', () => {
        it('should soft delete an item', (done) => {
            service.softDelete('1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should restore an item', (done) => {
            service.restore('1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });
    });
});
