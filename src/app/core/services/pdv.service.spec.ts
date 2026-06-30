import { TestBed } from '@angular/core/testing';
import { PdvService } from './pdv.service';
import { provideFirebaseMocks } from './firebase-testing';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { Auth } from '@angular/fire/auth';
import { Sale, SaleItem } from '../models/sale.model';
import { StockItem } from '../models/stock-item.model';

describe('PdvService', () => {
    let service: PdvService;
    let authMock: any;
    let transactionMock: any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PdvService,
                provideFirebaseMocks()
            ]
        });

        service = TestBed.inject(PdvService);
        authMock = TestBed.inject(Auth);

        transactionMock = {
            get: jasmine.createSpy('get').and.returnValue(Promise.resolve({ exists: () => false })),
            update: jasmine.createSpy('update').and.returnValue(Promise.resolve()),
            set: jasmine.createSpy('set').and.returnValue(Promise.resolve()),
            delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve())
        };

        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.callFake((...args: any[]) => ({ id: args[2] || 'new-id' }));
        (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.deleteDoc as any)?.and ? FbUtils.deleteDoc : spyOn(FbUtils, 'deleteDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.query as any)?.and ? FbUtils.query : spyOn(FbUtils, 'query')) as any).and.returnValue({} as any);
        (((FbUtils.where as any)?.and ? FbUtils.where : spyOn(FbUtils, 'where')) as any).and.returnValue({} as any);

        (((FbUtils.runTransaction as any)?.and ? FbUtils.runTransaction : spyOn(FbUtils, 'runTransaction')) as any).and.callFake((fs: any, callback: any) => {
            return callback(transactionMock);
        });
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getSales', () => {
        it('should return sales where deleted is false', (done) => {
            const mockSales = [
                { id: 'sale-1', totalAmount: 100, deleted: false, items: [] },
                { id: 'sale-2', totalAmount: 200, deleted: false, items: [] }
            ];

            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({
                docs: mockSales.map(s => ({
                    id: s.id,
                    data: () => s
                }))
            }));

            service.getSales().subscribe(sales => {
                expect(sales.length).toBe(2);
                expect(sales[0].id).toBe('sale-1');
                expect(sales[1].id).toBe('sale-2');
                expect(FbUtils.getDocs).toHaveBeenCalled();
                done();
            });
        });
    });

    describe('checkout', () => {
        it('should throw error if user is not authenticated', (done) => {
            authMock.currentUser = null;

            const saleData = {
                totalAmount: 100,
                paymentMethod: 'PIX',
                items: []
            };

            service.checkout(saleData).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Usuário não autenticado.');
                    done();
                }
            });
        });

        it('should throw error if stock item does not exist', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => false
            }));

            const saleData = {
                totalAmount: 100,
                paymentMethod: 'PIX',
                items: [{ itemId: 'item-1', name: 'Product 1', quantity: 2, unitPrice: 50, totalPrice: 100, totalCost: 0, fractionFactor: 1, lotsDeducted: [] }]
            };

            service.checkout(saleData).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Item Product 1 não encontrado no estoque.');
                    done();
                }
            });
        });

        it('should throw error if stock is insufficient and allowBackorder is false', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const stockItem: StockItem = {
                id: 'item-1',
                name: 'Product 1',
                category: 'Outros',
                quantity: 1,
                unit: 'un',
                deleted: false,
                updatedAt: new Date(),
                isForSale: true,
                salePrice: 50,
                allowBackorder: false,
                lots: [{ id: 'lot-1', quantity: 1, purchasePrice: 20, date: new Date() }]
            };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => true,
                data: () => stockItem
            }));

            const saleData = {
                totalAmount: 100,
                paymentMethod: 'PIX',
                items: [{ itemId: 'item-1', name: 'Product 1', quantity: 2, unitPrice: 50, totalPrice: 100, totalCost: 0, fractionFactor: 1, lotsDeducted: [] }]
            };

            service.checkout(saleData).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Estoque insuficiente para Product 1.');
                    done();
                }
            });
        });

        it('should deduct stock using FIFO and write transactions/sales', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const stockItem: StockItem = {
                id: 'item-1',
                name: 'Product 1',
                category: 'Outros',
                quantity: 10,
                unit: 'un',
                deleted: false,
                updatedAt: new Date(),
                isForSale: true,
                salePrice: 50,
                allowBackorder: false,
                lots: [
                    { id: 'lot-1', quantity: 3, purchasePrice: 15, date: new Date(2026, 1, 1) },
                    { id: 'lot-2', quantity: 7, purchasePrice: 20, date: new Date(2026, 1, 10) }
                ]
            };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => true,
                data: () => stockItem
            }));

            const saleData = {
                totalAmount: 250,
                paymentMethod: 'PIX',
                items: [{ itemId: 'item-1', name: 'Product 1', quantity: 5, unitPrice: 50, totalPrice: 250, totalCost: 0, fractionFactor: 1, lotsDeducted: [] }]
            };

            service.checkout(saleData).subscribe(() => {
                expect(transactionMock.get).toHaveBeenCalled();
                expect(transactionMock.update).toHaveBeenCalled();
                expect(transactionMock.set).toHaveBeenCalledTimes(2); // One for financial transaction, one for sale

                // Verify transaction category is 'DOAÇÃO'
                const txData = transactionMock.set.calls.first().args[1];
                expect(txData.category).toBe('DOAÇÃO');

                // Verify FIFO: deducted 3 from lot-1, and 2 from lot-2.
                // Remaining: lot-1 should have 0, lot-2 should have 5. Total stock quantity should be 5.
                const updateArgs = transactionMock.update.calls.first().args;
                expect(updateArgs[1].quantity).toBe(5);
                expect(updateArgs[1].lots[0].quantity).toBe(0);
                expect(updateArgs[1].lots[1].quantity).toBe(5);
                done();
            });
        });

        it('should allow backorder by creating negative phantom lot when stock is insufficient and allowBackorder is true', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const stockItem: StockItem = {
                id: 'item-1',
                name: 'Product 1',
                category: 'Outros',
                quantity: 1,
                unit: 'un',
                deleted: false,
                updatedAt: new Date(),
                isForSale: true,
                salePrice: 50,
                allowBackorder: true,
                lots: [{ id: 'lot-1', quantity: 1, purchasePrice: 20, date: new Date() }]
            };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => true,
                data: () => stockItem
            }));

            const saleData = {
                totalAmount: 150,
                paymentMethod: 'PIX',
                items: [{ itemId: 'item-1', name: 'Product 1', quantity: 3, unitPrice: 50, totalPrice: 150, totalCost: 0, fractionFactor: 1, lotsDeducted: [] }]
            };

            service.checkout(saleData).subscribe(() => {
                expect(transactionMock.update).toHaveBeenCalled();
                const updateArgs = transactionMock.update.calls.first().args;
                expect(updateArgs[1].quantity).toBe(-2);
                // Should have 2 lots: lot-1 (0 qty), and backorder lot (-2 qty)
                expect(updateArgs[1].lots.length).toBe(2);
                expect(updateArgs[1].lots[1].quantity).toBe(-2);
                done();
            });
        });
    });

    describe('cancelSale', () => {
        it('should revert stock lots, soft-delete transaction, and soft-delete sale', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const mockSale: Sale = {
                id: 'sale-123',
                date: new Date(),
                totalAmount: 100,
                totalCost: 40,
                paymentMethod: 'PIX',
                createdBy: 'user-123',
                deleted: false,
                financeTransactionId: 'tx-123',
                items: [{
                    itemId: 'item-1',
                    name: 'Product 1',
                    quantity: 2,
                    unitPrice: 50,
                    totalPrice: 100,
                    totalCost: 40,
                    fractionFactor: 1,
                    lotsDeducted: [{ lotId: 'lot-1', quantity: 2, costPrice: 20 }]
                }]
            };

            const mockStockItem: StockItem = {
                id: 'item-1',
                name: 'Product 1',
                category: 'Outros',
                quantity: 5,
                unit: 'un',
                deleted: false,
                updatedAt: new Date(),
                isForSale: true,
                lots: [{ id: 'lot-1', quantity: 3, purchasePrice: 20, date: new Date() }]
            };

            transactionMock.get.and.callFake((ref: any) => {
                if (ref.id === 'sale-123') {
                    return Promise.resolve({ exists: () => true, data: () => mockSale });
                }
                if (ref.id === 'item-1') {
                    return Promise.resolve({ exists: () => true, data: () => mockStockItem });
                }
                if (ref.id === 'tx-123') {
                    return Promise.resolve({ exists: () => true, data: () => ({ id: 'tx-123' }) });
                }
                return Promise.resolve({ exists: () => false });
            });

            service.cancelSale('sale-123').subscribe(() => {
                expect(transactionMock.get).toHaveBeenCalledTimes(3); // sale, stock, tx
                expect(transactionMock.update).toHaveBeenCalledTimes(3); // stock, tx, sale

                // Verify stock refund: original lot-1 was 3, we refunded 2. Total quantity is 5 + 2 = 7.
                const stockUpdate = transactionMock.update.calls.argsFor(0);
                expect(stockUpdate[1].quantity).toBe(7);
                expect(stockUpdate[1].lots[0].quantity).toBe(5);

                // Verify tx soft-delete
                const txUpdate = transactionMock.update.calls.argsFor(1);
                expect(txUpdate[1].deleted).toBeTrue();

                // Verify sale soft-delete
                const saleUpdate = transactionMock.update.calls.argsFor(2);
                expect(saleUpdate[1].deleted).toBeTrue();
                expect(saleUpdate[1].deletedBy).toBe('user-123');
                done();
            });
        });
    });

    describe('updateSale', () => {
        it('should throw error if non-admin tries to edit after 1 week', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

            const mockSale: Sale = {
                id: 'sale-123',
                date: oldDate,
                totalAmount: 100,
                totalCost: 40,
                paymentMethod: 'PIX',
                createdBy: 'user-123',
                deleted: false,
                items: []
            };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => true,
                data: () => mockSale
            }));

            service.updateSale('sale-123', [], 'PIX', 100, false).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Tempo limite de 1 semana para edição excedido. Solicite a um administrador.');
                    done();
                }
            });
        });

        it('should permit admin to edit even after 1 week', (done) => {
            authMock.currentUser = { uid: 'user-123' };

            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);

            const mockSale: Sale = {
                id: 'sale-123',
                date: oldDate,
                totalAmount: 100,
                totalCost: 40,
                paymentMethod: 'PIX',
                createdBy: 'user-123',
                deleted: false,
                items: []
            };

            transactionMock.get.and.returnValue(Promise.resolve({
                exists: () => true,
                data: () => mockSale
            }));

            service.updateSale('sale-123', [], 'Dinheiro', 80, true).subscribe(() => {
                expect(transactionMock.update).toHaveBeenCalled();
                done();
            });
        });
    });
});
