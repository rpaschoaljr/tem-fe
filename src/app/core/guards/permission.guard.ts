import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { LoggerService } from '../services/logger.service';
import { take, tap } from 'rxjs/operators';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);
  const logger = inject(LoggerService);

  const module = route.data['module'] as string;
  const action = (route.data['action'] as 'read' | 'write') || 'read';
  logger.debug('Verificando permissão', { module, action });
  if (!module) {
    logger.error('Módulo não definido na rota');
    return true;
  }

  return authService.hasPermission(module, action).pipe(
    take(1),
    tap(hasPermission => {
      if (!hasPermission) {
        logger.warn('Acesso negado', { module, action });
        notify.showError(`Você não tem permissão de ${action === 'read' ? 'acesso' : 'escrita'} para o módulo ${module}.`);
        router.navigate(['/dashboard']);
      } else {
        logger.debug('Acesso permitido', { module, action });
      }
    })
  );
};
