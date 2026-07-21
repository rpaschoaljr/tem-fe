// Para rodar com emuladores locais: npm run dev:local
// Para produção: preencha as credenciais reais do Firebase Console
//
// IMPORTANTE: a lista de providers abaixo deve espelhar exatamente a de
// src/app/app.config.ts. Se um provider existir só no config real e faltar aqui,
// o build de produção (que parte deste exemplo / do secret PROD_APP_CONFIG_TS)
// quebra em runtime com NG0201 ("No provider for ...").

import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { MAT_DATE_LOCALE, DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { BrazilianDateAdapter, BR_DATE_FORMATS } from './shared/utils/brazilian-date-adapter';

// Firebase Imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';

// Em modo dev (isDevMode), o SDK se conecta aos emuladores locais.
// O projectId deve bater com o .firebaserc. As demais chaves podem ser fake para emulador.
// Para produção, substitua por credenciais reais do Firebase Console.
const firebaseConfig = {
  apiKey: 'fake-api-key-emulator',
  authDomain: 'sistematemfe.firebaseapp.com',
  projectId: 'demo-sistematemfe',
  storageBucket: 'sistematemfe.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
  measurementId: '',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(),

    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    provideAuth(() => {
      const auth = getAuth();
      if (isDevMode()) {
        connectAuthEmulator(auth, 'http://localhost:9099');
      }
      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();
      if (isDevMode()) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),

    provideStorage(() => {
      const storage = getStorage();
      if (isDevMode()) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    }),

    provideFunctions(() => {
      const functions = getFunctions(undefined, 'southamerica-east1');
      if (isDevMode()) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    }),

    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: DateAdapter, useClass: BrazilianDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: BR_DATE_FORMATS },
  ]
};
