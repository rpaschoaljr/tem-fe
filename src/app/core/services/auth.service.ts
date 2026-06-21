import { Injectable, inject } from '@angular/core';
import { Auth, authState, User } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, of, from, throwError } from 'rxjs';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { switchMap, map, shareReplay, catchError } from 'rxjs/operators';
import { Member } from '../models/member.model';
import { UserClaims } from '../models/common';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private functions = inject(Functions);
  private logger = inject(LoggerService);

  user$ = authState(this.auth);

  member$ = this.user$.pipe(
    switchMap(user => {
      if (!user) {
        this.logger.debug('Auth: Nenhum usuário logado.');
        return of(null);
      }
      this.logger.debug(`Auth: Usuário logado detectado: ${this.maskEmail(user.email!)}`);
      return this.getMemberByEmail(user.email!).pipe(
        catchError(err => {
          this.logger.error('Erro ao buscar membro por email:', err);
          return of(null);
        })
      );
    }),
    shareReplay(1)
  );

  permissions$ = this.user$.pipe(
    switchMap(user => {
      if (!user) {
        return of(null);
      }
      return from(this.loadPermissions(user));
    }),
    shareReplay(1)
  );

  private async loadPermissions(user: User): Promise<UserClaims | null> {
    try {
      const syncFn = httpsCallable(this.functions, 'syncUserClaims');
      await syncFn();
    } catch (e) {
      // Silencioso: Functions podem não estar disponíveis no emulador
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const forceRefresh = attempt > 0;
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      const claims = tokenResult.claims as unknown as UserClaims;

      const hasPerms = claims?.perms && Object.keys(claims.perms).length > 0;
      const hasHierarchyLevel = claims?.hierarchyLevel !== undefined && claims?.hierarchyLevel !== null;

      if (hasPerms || hasHierarchyLevel) {
        return claims;
      }

      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const email = user.email;
    if (email) {
      try {
        return await this.loadPermissionsFromFirestore(email);
      } catch (err) {
        this.logger.error('[AuthService] Fallback Firestore falhou:', err);
      }
    }

    return (await user.getIdTokenResult(true)).claims as unknown as UserClaims;
  }

  private async loadPermissionsFromFirestore(email: string): Promise<UserClaims> {
    const userPermDoc = await FbUtils.getDoc(FbUtils.doc(this.firestore, 'permissions', email));
    const userPerm = userPermDoc.exists() ? userPermDoc.data() : null;

    const memberSnap = await FbUtils.getDocs(
      FbUtils.query(FbUtils.collection(this.firestore, 'members'), FbUtils.where('email', '==', email), FbUtils.limit(1))
    );

    let rolePerm = null;
    let hierarchyLevel = (userPerm as Record<string, unknown>)?.['hierarchyLevel'] as number || 0;

    if (!memberSnap.empty) {
      const member = memberSnap.docs[0].data();
      const role = member['role'];
      if (role) {
        const normalized = role.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const roleId = `role_${normalized.replace(/[^A-Z0-9]/g, '')}`;
        const roleDoc = await FbUtils.getDoc(FbUtils.doc(this.firestore, 'permissions', roleId));
        if (roleDoc.exists()) {
          rolePerm = roleDoc.data();
          hierarchyLevel = Math.max(hierarchyLevel, (rolePerm as Record<string, unknown>)?.['hierarchyLevel'] as number || 0);
        }
      }
    }

    const perms: Record<string, { read: boolean; write: boolean }> = {};
    const modules = ['members', 'finance', 'stock', 'settings', 'notices', 'dashboard'];
    for (const mod of modules) {
      const rM = ((rolePerm as Record<string, unknown>)?.['modules'] as Record<string, { read: boolean; write: boolean }>)?.[mod] || { read: false, write: false };
      const uM = ((userPerm as Record<string, unknown>)?.['modules'] as Record<string, { read: boolean; write: boolean }>)?.[mod];
      perms[mod] = {
        read: uM?.read !== undefined ? uM.read : rM.read,
        write: uM?.write !== undefined ? uM.write : rM.write,
      };
    }

    return { hierarchyLevel, perms };
  }

  private getMemberByEmail(email: string): Observable<Member | null> {
    const colRef = FbUtils.collection(this.firestore, 'members');
    const q = FbUtils.query(colRef, FbUtils.where('email', '==', email), FbUtils.limit(1));
    return from(FbUtils.getDocs(q)).pipe(
      map(snap => {
        if (snap.empty) {
          this.logger.warn(`Membro não encontrado na coleção 'members' para o email: ${this.maskEmail(email)}`);
          return null;
        }
        const d = snap.docs[0];
        return { ...d.data(), id: d.id } as Member;
      })
    );
  }

  hasPermission(module: string, action: 'read' | 'write'): Observable<boolean> {
    return this.permissions$.pipe(
      map(claims => {
        if (!claims) return false;

        const hierarchyLevel = claims.hierarchyLevel ?? 0;
        if (hierarchyLevel >= 10) {
          return true;
        }

        const perms = claims.perms || {};
        return !!perms[module]?.[action];
      })
    );
  }

  canManageNotices(): Observable<boolean> {
    return this.hasPermission('notices', 'write');
  }

  isAdmin$(): Observable<boolean> {
    return this.hasPermission('settings', 'read');
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal = local.length > 1 ? local[0] + '***' : '***';
    const domainParts = domain.split('.');
    const maskedDomain = domainParts.length > 1
      ? domainParts[0][0] + '***.' + domainParts[domainParts.length - 1]
      : domain[0] + '***';
    return `${maskedLocal}@${maskedDomain}`;
  }

  // Ações de Autenticação
  login(email: string, pass: string): Observable<any> {
    return from(FbUtils.signInWithEmailAndPassword(this.auth, email, pass));
  }

  logout(): Observable<void> {
    return from(FbUtils.signOut(this.auth));
  }

  updateUserPassword(newPass: string): Observable<void> {
    if (!this.auth.currentUser) return throwError(() => new Error('Nenhum usuário logado.'));
    return from(FbUtils.updatePassword(this.auth.currentUser, newPass));
  }

  resetPassword(email: string): Observable<void> {
    return from(FbUtils.sendPasswordResetEmail(this.auth, email));
  }

  createUser(email: string, pass: string): Observable<any> {
    return from(FbUtils.createUserWithEmailAndPassword(this.auth, email, pass));
  }

  completeFirstAccess(memberId: string, newPass: string): Observable<void> {
    if (!this.auth.currentUser) return throwError(() => new Error('Nenhum usuário logado.'));
    
    return from(
      FbUtils.updatePassword(this.auth.currentUser, newPass).then(() => {
        const docRef = FbUtils.doc(this.firestore, `members/${memberId}`);
        return FbUtils.updateDoc(docRef, { 
          isFirstAccess: false, 
          updatedAt: new Date() 
        });
      })
    );
  }
}
