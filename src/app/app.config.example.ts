// Para rodar com emuladores locais: npm run dev:local
// Para produção: preencha as credenciais reais do Firebase Console

import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { MAT_DATE_LOCALE } from '@angular/material/core';

// Firebase Imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';

// Em modo dev (isDevMode), o SDK se conecta aos emuladores locais.
// O projectId deve bater com o .firebaserc. As demais chaves podem ser fake para emulador.
// Para produção, substitua por credenciais reais do Firebase Console.
const firebaseConfig = {
  apiKey: 'fake-api-key-emulator',
  authDomain: 'sistematemfe.firebaseapp.com',
  projectId: "demo-sistematemfe",
  storageBucket: 'sistematemfe.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
  measurementId: ''
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withXhr()),
    // Inicialização do Firebase
    provideFirebaseApp(() => initializeApp(firebaseConfig)),

    // Configuração do Auth com Emulador
    provideAuth(() => {
      const auth = getAuth();
      if (isDevMode()) {
        connectAuthEmulator(auth, 'http://localhost:9099');
      }
      return auth;
    }),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },

    // Configuração do Firestore com Emulador
    provideFirestore(() => {
      const firestore = getFirestore();
      if (isDevMode()) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),

    // Configuração do Storage com Emulador
    provideStorage(() => {
      const storage = getStorage();
      if (isDevMode()) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    })
  ]
};
