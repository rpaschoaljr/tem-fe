import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private readonly dev = isDevMode();

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
    console.error(`[ERROR] ${message}`, errorMessage);
  }
}
