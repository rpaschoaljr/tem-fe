import { FirestoreTimestamp } from './common';

export interface Transaction {
    id: string;
    description: string;
    value: number;
    type: 'Entrada' | 'Saída';
    category: string;
    date: Date;
    deleted: boolean;

    memberId?: string;
    memberName?: string;

    refMonth?: number;
    refYear?: number;

    fee?: number;
    netValue?: number;
    paymentMethod?: string;
    bankAccount?: string;
    costCenter?: string;
    receiptUrl?: string;
}

export type FirestoreTransaction = Omit<Transaction, 'date'> & {
    date: FirestoreTimestamp;
};
