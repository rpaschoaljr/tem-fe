import { FirestoreTimestamp } from './common';

export interface Notice {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  type: 'event' | 'payment' | 'warning' | 'info';
  date: Date;
  expirationDate?: Date | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type FirestoreNotice = Omit<Notice, 'date' | 'expirationDate' | 'createdAt' | 'updatedAt'> & {
  date: FirestoreTimestamp;
  expirationDate?: FirestoreTimestamp | null;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};
