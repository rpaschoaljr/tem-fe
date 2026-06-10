import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { Observable, of, from } from 'rxjs';
import { switchMap, map, shareReplay, catchError } from 'rxjs/operators';
import { Member } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private functions = inject(Functions);

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

  /**
   * permissions$ com retry + fallback Firestore.
   * 1. Tenta sync via callable Function (rápido se Functions estiverem rodando).
   * 2. Tenta claims do token com exponential backoff (até 3 tentativas, ~7s).
   * 3. Se claims não chegarem, faz fallback lendo direto do Firestore.
   */
  permissions$ = this.user$.pipe(
    switchMap(user => {
      if (!user) {
        return of(null);
      }
      return from(this.loadPermissions(user));
    }),
    shareReplay(1)
  );

  private async loadPermissions(user: any): Promise<any> {
    // 1. Tenta sync via callable (se Functions emulador estiver rodando)
    try {
      const syncFn = httpsCallable(this.functions, 'syncUserClaims');
      await syncFn();
    } catch (e) {
      // Silencioso: Functions podem não estar disponíveis no emulador
    }

    // 2. Retry com exponential backoff
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const forceRefresh = attempt > 0;
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      const claims = tokenResult.claims as any;

      const hasPerms = claims?.perms && Object.keys(claims.perms).length > 0;
      const hasHierarchyLevel = claims?.hierarchyLevel !== undefined && claims?.hierarchyLevel !== null;

      if (hasPerms || hasHierarchyLevel) {
        return claims;
      }

      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 3. Fallback: ler permissões direto do Firestore
    const email = user.email;
    if (email) {
      try {
        return await this.loadPermissionsFromFirestore(email);
      } catch (err) {
        console.error('❌ [AuthService] Fallback Firestore falhou:', err);
      }
    }

    return (await user.getIdTokenResult(true)).claims as any;
  }

  /**
   * Lê permissões direto do Firestore (fallback quando Cloud Function não disponível).
   */
  private async loadPermissionsFromFirestore(email: string): Promise<any> {
    // 1. Busca permissão individual do usuário
    const userPermDoc = await getDoc(doc(this.firestore, 'permissions', email));
    const userPerm = userPermDoc.exists() ? userPermDoc.data() : null;

    // 2. Busca role do membro
    const memberSnap = await getDocs(
      query(collection(this.firestore, 'members'), where('email', '==', email), limit(1))
    );

    let rolePerm = null;
    let hierarchyLevel = (userPerm as any)?.['hierarchyLevel'] || 0;

    if (!memberSnap.empty) {
      const member = memberSnap.docs[0].data();
      const role = member['role'];
      if (role) {
        const normalized = role.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const roleId = `role_${normalized.replace(/[^A-Z0-9]/g, '')}`;
        const roleDoc = await getDoc(doc(this.firestore, 'permissions', roleId));
        if (roleDoc.exists()) {
          rolePerm = roleDoc.data();
          hierarchyLevel = Math.max(hierarchyLevel, (rolePerm as any)?.['hierarchyLevel'] || 0);
        }
      }
    }

    // 3. Consolida permissões (user override role)
    const perms: any = {};
    const modules = ['members', 'finance', 'stock', 'settings', 'notices', 'dashboard'];
    for (const mod of modules) {
      const rM = (rolePerm as any)?.['modules']?.[mod] || { read: false, write: false };
      const uM = (userPerm as any)?.['modules']?.[mod];
      perms[mod] = {
        read: uM?.read !== undefined ? uM.read : rM.read,
        write: uM?.write !== undefined ? uM.write : rM.write,
      };
    }

    return { hierarchyLevel, perms };
  }

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
}
