import { FirestoreTimestamp } from './common';

export type RecurrenceType = 'once' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
    once: 'Única vez',
    weekly: 'Semanal',
    monthly: 'Mensal',
    yearly: 'Anual'
};

export interface ScheduledTransaction {
    id: string;
    description: string;
    type: 'Entrada' | 'Saída';
    category: string;
    value: number;
    recurrence: RecurrenceType;
    dayOfMonth?: number;
    nextDueDate: Date;
    active: boolean;
    deleted: boolean;
    memberId?: string;
    memberName?: string;
    lastAppliedDate?: Date;
    paymentMethod?: string;
    bankAccount?: string;
    costCenter?: string;
}

export type FirestoreScheduledTransaction = Omit<ScheduledTransaction, 'nextDueDate' | 'lastAppliedDate'> & {
    nextDueDate: FirestoreTimestamp;
    lastAppliedDate?: FirestoreTimestamp;
};
