import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { Storage } from '@angular/fire/storage';

export function provideFirebaseMocks(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withXhr()),
    provideHttpClientTesting(),
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
    { provide: Storage, useValue: {} },
  ];
}
