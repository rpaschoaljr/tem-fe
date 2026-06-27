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
  if (!module) {
    logger.error('Módulo não definido na rota');
    return true;
  }

  return authService.hasPermission(module, action).pipe(
    take(1),
    tap(hasPermission => {
      if (!hasPermission) {
        notify.showError('Acesso restrito. Você não possui as permissões necessárias.');
        router.navigate(['/dashboard']);
      }
    })
  );
};
