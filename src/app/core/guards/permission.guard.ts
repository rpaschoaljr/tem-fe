import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { map, take, tap } from 'rxjs/operators';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  // O módulo e a ação (read/write) virão da configuração da rota
  const module = route.data['module'] as string;
  const action = (route.data['action'] as 'read' | 'write') || 'read';
  console.log("PermissionGuard: Verificando permissão");
  console.log({module, action});
  if (!module) {
    
    console.error('PermissionGuard: Módulo não definido na rota.');
    return true; // Deixa passar se esqueceu de configurar, mas loga erro
  }

  return authService.hasPermission(module, action).pipe(
    take(1),
    tap(hasPermission => {
      if (!hasPermission) {
        notify.showError(`Você não tem permissão de ${action === 'read' ? 'acesso' : 'escrita'} para o módulo ${module}.`);
        router.navigate(['/dashboard']);
      }
    })
  );
};
