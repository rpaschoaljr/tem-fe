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

  permissions$ = this.member$.pipe(
    switchMap(member => {
      if (!member) {
        console.log('🔒 Permissions: Sem membro, sem permissões.');
        return of(null);
      }
      
      console.log(`🔍 Permissions: Buscando regras para ${member.email} (Cargo: ${member.role})`);
      
      // ID individual é exatamente o email
      const userPermRef = doc(this.firestore, `permissions/${member.email}`);
      // Sanitiza o nome do cargo para bater com o permissionId salvo no banco
      const roleId = `role_${member.role.replace(/\//g, '_')}`; 
      const rolePermRef = doc(this.firestore, `permissions/${roleId}`);

      return combineLatest([
        from(getDoc(userPermRef)).pipe(
          map(s => {
            const data = s.exists() ? s.data() as PermissionConfig : {} as PermissionConfig;
            console.log(`📄 User Perms (${member.email}):`, data);
            return data;
          }),
          catchError(err => {
            console.error('❌ Erro User Perm:', err);
            return of({} as PermissionConfig);
          })
        ),
        from(getDoc(rolePermRef)).pipe(
          map(s => {
            const data = s.exists() ? s.data() as PermissionConfig : {} as PermissionConfig;
            console.log(`📄 Role Perms (${roleId}):`, data);
            return data;
          }),
          catchError(err => {
            console.error('❌ Erro Role Perm:', err);
            return of({} as PermissionConfig);
          })
        )
      ]).pipe(
        map(([userPerm, rolePerm]) => {
          console.log(`✅ Permissões consolidadas geradas.`);
          return { userPerm, rolePerm };
        })
      );
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
      map(perms => {
        if (!perms) return false;

        // Cargo com nível máximo de hierarquia (10) tem acesso total
        if ((perms.rolePerm?.hierarchyLevel ?? 0) >= 10) return true;

        // Verifica individual primeiro
        if (perms.userPerm?.modules?.[module] && perms.userPerm.modules[module][action] !== undefined) {
          return perms.userPerm.modules[module][action];
        }

        // Depois verifica cargo
        if (perms.rolePerm?.modules?.[module] && perms.rolePerm.modules[module][action] !== undefined) {
          return perms.rolePerm.modules[module][action];
        }

        return false;
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
