import { Provider } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';

export function provideFirebaseMocks(): Provider[] {
  return [
    {
      provide: Auth,
      useValue: {
        currentUser: null,
        onAuthStateChanged: () => () => {},
        signOut: () => Promise.resolve(),
      },
    },
    { provide: Firestore, useValue: {} },
    { provide: Functions, useValue: {} },
  ];
}
