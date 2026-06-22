import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private readonly dev = false; // Desligado a pedido para limpar o console

  debug(message: string, ...data: unknown[]): void {
    if (this.dev) {
      console.log(`[DEBUG] ${message}`, ...data);
    }
  }

  info(message: string, ...data: unknown[]): void {
    console.info(`[INFO] ${message}`, ...data);
  }

  warn(message: string, ...data: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...data);
  }

  error(message: string, err?: unknown): void {
    const errorMessage = err instanceof Error ? err.message : String(err ?? '');
    const errorCode = (err as any)?.code;

    // Se for um erro esperado de permissão negada ou de login falho, apenas logamos como debug silencioso (ou ignoramos)
    if (
      errorCode === 'permission-denied' || 
      errorCode === 'auth/user-not-found' ||
      errorCode === 'auth/wrong-password' ||
      errorCode === 'auth/invalid-credential' ||
      errorMessage.includes('Missing or insufficient permissions') ||
      errorMessage.includes('Property admin is undefined') ||
      errorMessage.includes('false for \'list\'')
    ) {
      this.debug(`[Erro Esperado Silenciado] ${message}`, errorMessage);
      return;
    }

    console.error(`[ERROR] ${message}`, errorMessage);
  }
}
