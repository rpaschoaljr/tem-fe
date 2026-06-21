import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.permissions$.pipe(
    take(1),
    map(perms => {
      if (perms) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
