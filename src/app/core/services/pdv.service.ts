import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable, from, throwError, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { Sale, SaleItem } from '../models/sale.model';
import { Auth } from '@angular/fire/auth';
import { StockItem, StockLot } from '../models/stock-item.model';
import { Transaction } from '../models/transaction.model';
import { AuthService } from './auth.service';

function parseDate(date: any): number {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (typeof date.toMillis === 'function') return date.toMillis();
    if (date.seconds !== undefined) return date.seconds * 1000 + (date.nanoseconds || 0) / 1000000;
    if (typeof date === 'string') return new Date(date).getTime();
    if (typeof date === 'number') return date;
    return 0;
}

@Injectable({ providedIn: 'root' })
export class PdvService {
    private firestore = inject(Firestore);
    private firebaseAuth = inject(Auth);
    private auth = inject(AuthService);

    private SALES_COL = 'sales';
    private STOCK_COL = 'stock';
    private TX_COL = 'transactions';

    public salesUpdated$ = new Subject<void>();

    /**
     * Lista as vendas não deletadas.
     */
    getSales(): Observable<Sale[]> {
        const colRef = FbUtils.collection(this.firestore, this.SALES_COL);
        const q = FbUtils.query(colRef, FbUtils.where('deleted', '==', false));
        return from(FbUtils.getDocs(q)).pipe(
            map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)))
        );
    }

    /**
     * Finaliza uma venda:
     * - Cria documento em 'sales'
     * - Abate quantidades dos lotes no 'stock'
     * - Cria transação financeira em 'transactions'
     * Tudo feito em uma transação do Firestore para garantir integridade.
     */
    checkout(saleData: Omit<Sale, 'id' | 'date' | 'financeTransactionId' | 'createdBy' | 'updatedAt' | 'deleted' | 'totalCost'>): Observable<void> {
        return from(FbUtils.runTransaction(this.firestore, async (transaction) => {
            const user = this.firebaseAuth.currentUser;
            if (!user) throw new Error('Usuário não autenticado.');

            // 1. Validar e ler os itens do estoque primeiro (todas as leituras DEVEM vir antes de escritas)
            const stockRefs = saleData.items.map(item => FbUtils.doc(this.firestore, this.STOCK_COL, item.itemId));
            const stockDocs = await Promise.all(stockRefs.map(ref => transaction.get(ref)));

            const stockUpdates: { ref: any, data: any }[] = [];
            let totalComputedCost = 0;
            const updatedSaleItems: SaleItem[] = [];

            // 2. Abater estoques lote a lote
            for (let i = 0; i < saleData.items.length; i++) {
                const saleItem = saleData.items[i];
                const stockDoc = stockDocs[i];

                if (!stockDoc.exists()) throw new Error(`Item ${saleItem.name} não encontrado no estoque.`);
                
                const stockData = stockDoc.data() as StockItem;
                const currentStockQty = Number(stockData.quantity || 0);
                const requestedQty = saleItem.quantity * (saleItem.fractionFactor || 1);
                const allowBackorder = stockData.allowBackorder === true;
                
                if (currentStockQty < requestedQty && !allowBackorder) {
                    throw new Error(`Estoque insuficiente para ${saleItem.name}.`);
                }

                let remainingToDeduct = requestedQty;
                let itemTotalCost = 0;
                const deductedLots: { lotId: string; quantity: number; costPrice: number }[] = [];

                // Deduct from oldest lots first (FIFO)
                const sortedLots = (stockData.lots || []).sort((a: StockLot, b: StockLot) => {
                    return parseDate(a.date) - parseDate(b.date);
                });

                for (const lot of sortedLots) {
                    if (remainingToDeduct <= 0) break;
                    if (lot.quantity > 0) {
                        const amountToTake = Math.min(lot.quantity, remainingToDeduct);
                        lot.quantity -= amountToTake;
                        remainingToDeduct -= amountToTake;
                        itemTotalCost += amountToTake * lot.purchasePrice;
                        deductedLots.push({ lotId: lot.id, quantity: amountToTake, costPrice: lot.purchasePrice });
                    }
                }

                // If allowBackorder is true and we still need to deduct, we create a "negative" phantom lot or just deduct from general stock quantity 
                // but for strict accounting we can deduct from the most recent lot or create a backorder lot.
                if (remainingToDeduct > 0) {
                     if (!allowBackorder) {
                         throw new Error(`Estoque de lotes inconsistente para ${saleItem.name}.`);
                     }
                     // Create a backorder lot (negative) to balance the equation
                     const lastCostPrice = sortedLots.length > 0 ? sortedLots[sortedLots.length - 1].purchasePrice : (stockData.salePrice || 0);
                     const backorderLotId = `backorder_${new Date().getTime()}`;
                     sortedLots.push({
                         id: backorderLotId,
                         quantity: -remainingToDeduct,
                         purchasePrice: lastCostPrice,
                         date: new Date()
                     });
                     itemTotalCost += remainingToDeduct * lastCostPrice;
                     deductedLots.push({ lotId: backorderLotId, quantity: remainingToDeduct, costPrice: lastCostPrice });
                     remainingToDeduct = 0;
                }

                stockData.quantity -= saleItem.quantity * (saleItem.fractionFactor || 1);
                stockData.lots = sortedLots;

                stockUpdates.push({ ref: stockRefs[i], data: { quantity: stockData.quantity, lots: stockData.lots } });
                
                totalComputedCost += itemTotalCost;
                updatedSaleItems.push({
                    ...saleItem,
                    totalCost: itemTotalCost,
                    lotsDeducted: deductedLots
                });
            }

            // 3. Preparar refs de escrita
            const saleRef = FbUtils.doc(FbUtils.collection(this.firestore, this.SALES_COL));
            const txRef = FbUtils.doc(FbUtils.collection(this.firestore, this.TX_COL));

            // 4. Executar as 7. Atualizar estoque
            stockUpdates.forEach(update => transaction.update(update.ref, update.data));

            const txData: Omit<Transaction, 'id'> = {
                description: `Venda PDV - ${saleRef.id.substring(0, 8).toUpperCase()}`,
                value: saleData.totalAmount,
                netValue: saleData.totalAmount, // Assuming no fee calculation for now, could be added later
                type: 'Entrada',
                category: 'DOAÇÃO', // Changed to 'DOAÇÃO' for religious center reasons
                paymentMethod: saleData.paymentMethod,
                costCenter: 'RECEITAS OPERACIONAIS',
                deleted: false,
                date: new Date(),
                memberId: user.uid,
                pdvDetails: {
                    saleId: saleRef.id,
                    totalCost: totalComputedCost
                }
            };
            transaction.set(txRef, txData);

            const finalSale: Sale = {
                ...saleData,
                date: new Date(),
                totalCost: totalComputedCost,
                items: updatedSaleItems,
                financeTransactionId: txRef.id,
                createdBy: user.uid,
                deleted: false
            };
            transaction.set(saleRef, finalSale);
        })).pipe(
            map(() => {
                this.salesUpdated$.next();
            })
        );
    }

    /**
     * Estorna (cancela) uma venda finalizada.
     * Devolve os itens aos seus lotes exatos no estoque e faz soft-delete da transação financeira.
     */
    cancelSale(saleId: string): Observable<void> {
        return from(FbUtils.runTransaction(this.firestore, async (transaction) => {
            const user = this.firebaseAuth.currentUser;
            if (!user) throw new Error('Usuário não autenticado.');

            // 1. Ler Venda
            const saleRef = FbUtils.doc(this.firestore, this.SALES_COL, saleId);
            const saleDoc = await transaction.get(saleRef);
            if (!saleDoc.exists()) throw new Error('Venda não encontrada.');
            const sale = saleDoc.data() as Sale;

            if (sale.deleted) throw new Error('Venda já está cancelada.');

            // 2. Ler Estoques (Para devolver os itens)
            const stockRefs = sale.items.map(item => FbUtils.doc(this.firestore, this.STOCK_COL, item.itemId));
            const stockDocs = await Promise.all(stockRefs.map(ref => transaction.get(ref)));

            // 3. Ler Transação Financeira
            let txDoc: any = null;
            let txRef: any = null;
            if (sale.financeTransactionId) {
                 txRef = FbUtils.doc(this.firestore, this.TX_COL, sale.financeTransactionId);
                 txDoc = await transaction.get(txRef);
            }

            // --- Fim das leituras, início das escritas ---

            // 4. Devolver lotes ao estoque
            for (let i = 0; i < sale.items.length; i++) {
                const saleItem = sale.items[i];
                const stockDoc = stockDocs[i];
                if (stockDoc.exists()) {
                    const stockData = stockDoc.data() as StockItem;
                    stockData.quantity += saleItem.quantity * (saleItem.fractionFactor || 1);
                    
                    // Reembolsar os lotes exatos
                    for (const deductedLot of saleItem.lotsDeducted) {
                        const existingLot = stockData.lots?.find((l: StockLot) => l.id === deductedLot.lotId);
                        if (existingLot) {
                            existingLot.quantity += deductedLot.quantity;
                        } else {
                            // Se o lote não existe mais (o que é raro, mas possível se foi removido), recriamos
                            if (!stockData.lots) stockData.lots = [];
                            stockData.lots.push({
                                id: deductedLot.lotId,
                                quantity: deductedLot.quantity,
                                purchasePrice: deductedLot.costPrice,
                                date: new Date() // Fallback
                            });
                        }
                    }
                    transaction.update(stockRefs[i], { quantity: stockData.quantity, lots: stockData.lots });
                }
            }

            // 5. Deletar (Soft) transação financeira
            if (txRef && txDoc && txDoc.exists()) {
                transaction.update(txRef, { deleted: true, updatedAt: new Date() });
            }

            // 6. Deletar (Soft) a venda
            transaction.update(saleRef, {
                deleted: true,
                deletedAt: new Date(),
                deletedBy: user.uid
            });
        })).pipe(
            map(() => {
                this.salesUpdated$.next();
            })
        );
    }

    /**
     * Edita uma venda finalizada.
     * Cancela a venda anterior (devolve estoque, reverte DRE), e lança uma nova venda com os novos itens/pagamento,
     * usando as mesmas IDs originais.
     */
    updateSale(saleId: string, updatedItems: SaleItem[], newPaymentMethod: string, newTotalAmount: number, isAdmin: boolean = false): Observable<void> {
        return from(FbUtils.runTransaction(this.firestore, async (transaction) => {
            const user = this.firebaseAuth.currentUser;
            if (!user) throw new Error('Usuário não autenticado.');

            // 1. Ler a Venda atual
            const saleRef = FbUtils.doc(this.firestore, this.SALES_COL, saleId);
            const saleDoc = await transaction.get(saleRef);
            if (!saleDoc.exists()) throw new Error('Venda não encontrada.');
            const sale = saleDoc.data() as Sale;

            if (sale.deleted) throw new Error('Não é possível editar uma venda deletada.');

            // Regra de Tempo: 1 Semana para o Caixa
            if (!isAdmin) {
                const saleDate = new Date(parseDate(sale.date));
                const diffTime = Math.abs(new Date().getTime() - saleDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 7) {
                    throw new Error('Tempo limite de 1 semana para edição excedido. Solicite a um administrador.');
                }
            }

            // 2. Ler Estoques (Itens antigos E itens novos)
            const oldStockIds = sale.items.map(i => i.itemId);
            const newStockIds = updatedItems.map(i => i.itemId);
            const allStockIds = Array.from(new Set([...oldStockIds, ...newStockIds]));
            
            const stockRefs = allStockIds.map(id => FbUtils.doc(this.firestore, this.STOCK_COL, id));
            const stockDocs = await Promise.all(stockRefs.map(ref => transaction.get(ref)));
            const stockMap = new Map<string, StockItem>();
            stockDocs.forEach(doc => {
                if (doc.exists()) stockMap.set(doc.id, doc.data() as StockItem);
            });

            // 3. Ler Transação Financeira
            let txRef: any = null;
            if (sale.financeTransactionId) {
                 txRef = FbUtils.doc(this.firestore, this.TX_COL, sale.financeTransactionId);
            }

            // --- DEVOLVER ITENS ANTIGOS ---
            for (const oldItem of sale.items) {
                const stockData = stockMap.get(oldItem.itemId);
                if (stockData) {
                    stockData.quantity += oldItem.quantity * (oldItem.fractionFactor || 1);
                    for (const deductedLot of oldItem.lotsDeducted) {
                        const existingLot = stockData.lots?.find((l: StockLot) => l.id === deductedLot.lotId);
                        if (existingLot) {
                            existingLot.quantity += deductedLot.quantity;
                        } else {
                            if (!stockData.lots) stockData.lots = [];
                            stockData.lots.push({ id: deductedLot.lotId, quantity: deductedLot.quantity, purchasePrice: deductedLot.costPrice, date: new Date() });
                        }
                    }
                }
            }

            // --- ABATER NOVOS ITENS ---
            let totalComputedCost = 0;
            const finalSaleItems: SaleItem[] = [];

            for (const newItem of updatedItems) {
                const stockData = stockMap.get(newItem.itemId);
                if (!stockData) throw new Error(`Item ${newItem.name} não encontrado no estoque.`);
                
                const currentStockQty = Number(stockData.quantity || 0);
                const requestedQty = newItem.quantity * (newItem.fractionFactor || 1);
                const allowBackorder = stockData.allowBackorder === true;

                if (currentStockQty < requestedQty && !allowBackorder) {
                    throw new Error(`Estoque insuficiente para ${newItem.name}.`);
                }

                let remainingToDeduct = requestedQty;
                let itemTotalCost = 0;
                const deductedLots: { lotId: string; quantity: number; costPrice: number }[] = [];

                const sortedLots = (stockData.lots || []).sort((a: StockLot, b: StockLot) => {
                    return parseDate(a.date) - parseDate(b.date);
                });

                for (const lot of sortedLots) {
                    if (remainingToDeduct <= 0) break;
                    if (lot.quantity > 0) {
                        const amountToTake = Math.min(lot.quantity, remainingToDeduct);
                        lot.quantity -= amountToTake;
                        remainingToDeduct -= amountToTake;
                        itemTotalCost += amountToTake * lot.purchasePrice;
                        deductedLots.push({ lotId: lot.id, quantity: amountToTake, costPrice: lot.purchasePrice });
                    }
                }

                if (remainingToDeduct > 0) {
                     if (!allowBackorder) throw new Error(`Estoque de lotes inconsistente para ${newItem.name}.`);
                     const lastCostPrice = sortedLots.length > 0 ? sortedLots[sortedLots.length - 1].purchasePrice : (stockData.salePrice || 0);
                     const backorderLotId = `backorder_${new Date().getTime()}`;
                     sortedLots.push({ id: backorderLotId, quantity: -remainingToDeduct, purchasePrice: lastCostPrice, date: new Date() });
                     itemTotalCost += remainingToDeduct * lastCostPrice;
                     deductedLots.push({ lotId: backorderLotId, quantity: remainingToDeduct, costPrice: lastCostPrice });
                }

                stockData.quantity -= newItem.quantity * (newItem.fractionFactor || 1);
                stockData.lots = sortedLots;

                totalComputedCost += itemTotalCost;
                finalSaleItems.push({
                    ...newItem,
                    totalCost: itemTotalCost,
                    lotsDeducted: deductedLots
                });
            }

            // --- ESCRITAS ---
            allStockIds.forEach((id, idx) => {
                const stockData = stockMap.get(id);
                if (stockData) {
                    transaction.update(stockRefs[idx], { quantity: stockData.quantity, lots: stockData.lots });
                }
            });

            if (txRef) {
                transaction.update(txRef, {
                    value: newTotalAmount,
                    netValue: newTotalAmount,
                    paymentMethod: newPaymentMethod,
                    updatedAt: new Date(),
                    pdvDetails: { saleId: saleRef.id, totalCost: totalComputedCost }
                });
            }

            transaction.update(saleRef, {
                totalAmount: newTotalAmount,
                totalCost: totalComputedCost,
                paymentMethod: newPaymentMethod,
                items: finalSaleItems,
                updatedAt: new Date(),
                updatedBy: user.uid
            });
        })).pipe(
            map(() => {
                this.salesUpdated$.next();
            })
        );
    }
}
