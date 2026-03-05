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
    value: number; // sempre positivo; sinal aplicado pelo type
    recurrence: RecurrenceType;
    dayOfMonth?: number; // 1–31, se o dia não existir no mês o sistema usa o último dia (ex: 31/jan -> 28/fev)
    nextDueDate: Date;
    active: boolean;
    deleted: boolean;
    memberId?: string;
    memberName?: string;
    lastAppliedDate?: Date;
}
