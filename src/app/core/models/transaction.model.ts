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
}

export type FirestoreTransaction = Omit<Transaction, 'date'> & {
    date: FirestoreTimestamp;
};
