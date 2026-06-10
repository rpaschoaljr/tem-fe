import { FirestoreTimestamp } from './common';

export interface StockItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    minStock?: number;
    unit: string;
    deleted: boolean;
    updatedAt: Date;
}

export type FirestoreStockItem = Omit<StockItem, 'updatedAt'> & {
    updatedAt: FirestoreTimestamp;
};