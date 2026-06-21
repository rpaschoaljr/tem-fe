import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Filtro global para calar mensagens irritantes de bibliotecas de terceiros (AngularFire)
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args.join(' ');
  if (msg.includes('Firebase API called outside injection context')) return;
  originalWarn(...args);
};

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
