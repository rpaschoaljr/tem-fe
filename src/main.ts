import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Filtro global para calar mensagens irritantes de bibliotecas de terceiros (AngularFire)
const originalWarn = console.warn;
const originalInfo = console.info;

const filterLogs = (args: any[], original: Function) => {
  const msg = args.join(' ');
  if (
    msg.includes('outside of an Injection context') ||
    msg.includes('You are using the Auth Emulator') ||
    msg.includes('Firebase API called outside injection context')
  ) {
    return;
  }
  original(...args);
};

console.warn = (...args) => filterLogs(args, originalWarn);
console.info = (...args) => filterLogs(args, originalInfo);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
