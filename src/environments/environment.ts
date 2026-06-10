// Portas lidas dinamicamente do .env via VITE_* (Vite expõe automaticamente)
// Fallback para os defaults se não definidas no .env
const authPort = Number((import.meta as any).env?.['VITE_AUTH_PORT']) || 9099;
const firestorePort = Number((import.meta as any).env?.['VITE_FIRESTORE_PORT']) || 8080;
const storagePort = Number((import.meta as any).env?.['VITE_STORAGE_PORT']) || 9199;
const functionsPort = Number((import.meta as any).env?.['VITE_FUNCTIONS_PORT']) || 5001;

export const environment = {
  production: false,
  firebase: {
    projectId: 'demo-sistematemfe',
    apiKey: 'fake-api-key-emulator',
    authDomain: 'sistematemfe.firebaseapp.com',
    storageBucket: 'sistematemfe.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  },
  emulators: {
    auth: ['http://localhost', authPort] as [string, number],
    firestore: ['localhost', firestorePort] as [string, number],
    storage: ['localhost', storagePort] as [string, number],
    functions: ['localhost', functionsPort] as [string, number],
  },
};
