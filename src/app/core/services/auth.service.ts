import { Injectable, inject } from '@angular/core';
import { Auth, authState, User } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, limit } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { switchMap, map, shareReplay } from 'rxjs/operators';
import { Member } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  user$ = authState(this.auth);

  member$ = this.user$.pipe(
    switchMap(user => {
      if (!user) return of(null);
      return this.getMemberByEmail(user.email!);
    }),
    shareReplay(1)
  );

  private getMemberByEmail(email: string): Observable<Member | null> {
    const colRef = collection(this.firestore, 'members');
    const q = query(colRef, where('email', '==', email), limit(1));
    return from(getDocs(q)).pipe(
      map(snap => {
        if (snap.empty) return null;
        const d = snap.docs[0];
        return { ...d.data(), id: d.id } as Member;
      })
    );
  }

  canManageNotices(): Observable<boolean> {
    return this.member$.pipe(
      map(m => m?.role === 'DIRETORIA' || m?.role === 'PAI/MÃE PEQUENO')
    );
  }

  isAdmin$(): Observable<boolean> {
    return this.member$.pipe(
      map(m => m?.role === 'DIRETORIA')
    );
  }
}
