import { FirestoreTimestamp } from './common';

export interface AuditLog {
  id: string;
  timestamp: Date;
  collection: string;
  documentId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  userId: string;
  userEmail?: string;
  userName?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  diff?: Record<string, { old: any; new: any }> | null;
}

export type FirestoreAuditLog = Omit<AuditLog, 'timestamp'> & {
  timestamp: FirestoreTimestamp;
};
