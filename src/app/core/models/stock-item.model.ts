import { FirestoreTimestamp } from './common';

export interface StockLot {
    id: string;
    quantity: number;
    purchasePrice: number;
    date: Date;
}

export interface StockItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    minStock?: number;
    unit: string;
    deleted: boolean;
    updatedAt: Date;

    // Vendas e Lotes
    isForSale?: boolean;
    salePrice?: number;
    allowBackorder?: boolean;
    lots?: StockLot[];

    // Fracionamento
    fractionable?: boolean;
    fractionFactor?: number;
    saleUnitName?: string;
}

export type FirestoreStockItem = Omit<StockItem, 'updatedAt' | 'lots'> & {
    updatedAt: FirestoreTimestamp;
    lots?: (Omit<StockLot, 'date'> & { date: FirestoreTimestamp })[];
};