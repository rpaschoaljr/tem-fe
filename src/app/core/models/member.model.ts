import { FirestoreTimestamp } from './common';

export interface Member {
    id: string;
    name: string;
    cpf: string;
    email: string;
    phone: string;
    photoUrl?: string;

    address: {
        cep: string;
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
    };

    status: 'Ativo' | 'Inativo';
    deleted: boolean;
    isFirstAccess?: boolean;
    showSpiritualData?: boolean;
    isExempt?: boolean;

    role: string;
    entryDate: Date;
    exitDate?: Date | null;
    observations?: string;

    rituals: Record<string, Date | null | undefined>;
    consecrations: Record<string, Date | null | undefined>;

    createdAt: Date;
    updatedAt: Date;
    updatedBy?: string;

    customFields?: Record<string, unknown>;
}

export type FirestoreMember = Omit<Member, 'createdAt' | 'updatedAt' | 'entryDate' | 'exitDate' | 'rituals' | 'consecrations'> & {
    createdAt: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
    entryDate: FirestoreTimestamp;
    exitDate?: FirestoreTimestamp | null;
    rituals?: Record<string, FirestoreTimestamp | null>;
    consecrations?: Record<string, FirestoreTimestamp | null>;
};