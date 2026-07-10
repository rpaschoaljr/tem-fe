import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuditLog } from '../models/audit-log.model';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private firestore = inject(Firestore);
  private logger = inject(LoggerService);
  private COL = 'audit_logs';

  getLogs(): Observable<AuditLog[]> {
    const colRef = FbUtils.collection(this.firestore, this.COL);
    const q = FbUtils.query(colRef, FbUtils.orderBy('timestamp', 'desc'));
    
    return (FbUtils.collectionData(q, { idField: 'id' }) as Observable<Record<string, unknown>[]>).pipe(
      map(data => data.map(d => this.fromFirestore(d['id'] as string, d))),
      catchError(err => {
        const errorCode = (err as any)?.code;
        const errorMessage = String((err as any)?.message || '');
        
        if (errorCode === 'permission-denied' || errorMessage.includes('admin is undefined')) {
          this.logger.debug('Acesso a logs bloqueado por segurança', err);
          return of([]);
        }

        this.logger.error('Erro ao ler logs de auditoria', err);
        return throwError(() => new Error('Não foi possível ler os logs de auditoria.'));
      })
    );
  }

  private fromFirestore(id: string, data: Record<string, unknown>): AuditLog {
    return {
      ...data,
      id,
      timestamp: this.fixDate(data['timestamp']) || new Date()
    } as AuditLog;
  }

  private fixDate(val: unknown): Date | null {
    if (!val) return null;
    const obj = val as { toDate?: () => Date };
    if (obj.toDate) return obj.toDate();
    const d = new Date(val as string | number | Date);
    return isNaN(d.getTime()) ? null : d;
  }
}
