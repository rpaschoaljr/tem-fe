import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { Observable, of, from, combineLatest } from 'rxjs';
import { switchMap, map, shareReplay, catchError } from 'rxjs/operators';
import { Member } from '../models/member.model';
import { PermissionConfig } from '../models/system-config.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  user$ = authState(this.auth);

  member$ = this.user$.pipe(
    switchMap(user => {
      if (!user) {
        console.log('🔒 Auth: Nenhum usuário logado.');
        return of(null);
      }
      console.log(`👤 Auth: Usuário logado detectado: ${user.email}`);
      return this.getMemberByEmail(user.email!).pipe(
        catchError(err => {
          console.error('❌ Erro ao buscar membro por email:', err);
          return of(null);
        })
      );
    }),
    shareReplay(1)
  );

  permissions$ = this.user$.pipe(
    switchMap(async user => {
      if (!user) {
        console.log('🚪 [AuthService] Sem usuário para carregar claims.');
        return null;
      }
      
      console.log('🔑 [AuthService] Buscando Claims do Token...');
      let tokenResult = await user.getIdTokenResult();
      let claims = tokenResult.claims as any;

      console.log('📊 [AuthService] Claims atuais no Token:', JSON.stringify(claims, null, 2));

      if (!claims.perms && claims.hierarchyLevel === undefined) {
        console.warn('⚠️ [AuthService] Claims NÃO encontrados no token atual. Forçando Refresh (pode demorar 1-2s)...');
        tokenResult = await user.getIdTokenResult(true);
        claims = tokenResult.claims as any;
        console.log('🔄 [AuthService] Claims após Refresh:', JSON.stringify(claims, null, 2));
      }

      return claims;
    }),
    shareReplay(1)
  );

  private getMemberByEmail(email: string): Observable<Member | null> {
    const colRef = collection(this.firestore, 'members');
    const q = query(colRef, where('email', '==', email), limit(1));
    return from(getDocs(q)).pipe(
      map(snap => {
        if (snap.empty) {
          console.warn(`⚠️ Membro não encontrado na coleção 'members' para o email: ${email}`);
          return null;
        }
        const d = snap.docs[0];
        console.log(`✅ Membro carregado do banco:`, d.data());
        return { ...d.data(), id: d.id } as Member;
      })
    );
  }

  hasPermission(module: string, action: 'read' | 'write'): Observable<boolean> {
    return this.permissions$.pipe(
      map(claims => {
        if (!claims) return false;

        const hierarchyLevel = claims.hierarchyLevel ?? 0;
        if (hierarchyLevel >= 10) return true;

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
}
