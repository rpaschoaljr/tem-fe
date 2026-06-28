import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';

import { permissionGuard } from './permission.guard';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { LoggerService } from '../services/logger.service';

describe('PermissionGuard', () => {
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let routerMock: jasmine.SpyObj<Router>;
  let notifyMock: jasmine.SpyObj<NotificationService>;
  let loggerMock: jasmine.SpyObj<LoggerService>;

  function createRoute(module?: string, action?: string): ActivatedRouteSnapshot {
    return { data: { module, action } } as unknown as ActivatedRouteSnapshot;
  }

  const createState = {} as RouterStateSnapshot;

  beforeEach(() => {
    authServiceMock = jasmine.createSpyObj('AuthService', ['hasPermission']);
    routerMock = jasmine.createSpyObj('Router', ['navigate']);
    notifyMock = jasmine.createSpyObj('NotificationService', ['showError']);
    loggerMock = jasmine.createSpyObj('LoggerService', ['debug', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: NotificationService, useValue: notifyMock },
        { provide: LoggerService, useValue: loggerMock },
      ],
    });
  });

  it('should allow access when hasPermission returns true', fakeAsync(() => {
    authServiceMock.hasPermission.and.returnValue(of(true));
    const route = createRoute('members', 'read');

    let result: boolean | undefined;
    TestBed.runInInjectionContext(() => {
      const guardResult = permissionGuard(route, createState);
      (guardResult as any).subscribe((r: boolean) => (result = r));
    });
    tick();

    expect(result).toBeTrue();
    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(notifyMock.showError).not.toHaveBeenCalled();
  }));

  it('should redirect to dashboard when hasPermission returns false', fakeAsync(() => {
    authServiceMock.hasPermission.and.returnValue(of(false));
    const route = createRoute('finance', 'write');

    let result: boolean | undefined;
    TestBed.runInInjectionContext(() => {
      const guardResult = permissionGuard(route, createState);
      (guardResult as any).subscribe((r: boolean) => (result = r));
    });
    tick();

    expect(result).toBeFalse();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('should show error notification when access denied', fakeAsync(() => {
    authServiceMock.hasPermission.and.returnValue(of(false));
    const route = createRoute('stock', 'write');

    TestBed.runInInjectionContext(() => {
      const guardResult = permissionGuard(route, createState);
      (guardResult as any).subscribe();
    });
    tick();

    expect(notifyMock.showError).toHaveBeenCalledWith(
      'Acesso restrito. Você não possui as permissões necessárias.'
    );
  }));

  it('should show correct error message for read action', fakeAsync(() => {
    authServiceMock.hasPermission.and.returnValue(of(false));
    const route = createRoute('settings', 'read');

    TestBed.runInInjectionContext(() => {
      const guardResult = permissionGuard(route, createState);
      (guardResult as any).subscribe();
    });
    tick();

    expect(notifyMock.showError).toHaveBeenCalledWith(
      'Acesso restrito. Você não possui as permissões necessárias.'
    );
  }));

  it('should allow access when no module is specified (graceful degradation)', () => {
    const route = createRoute(undefined, undefined);

    let result: boolean | undefined;
    TestBed.runInInjectionContext(() => {
      result = permissionGuard(route, createState) as boolean;
    });

    expect(result).toBeTrue();
    expect(authServiceMock.hasPermission).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith('Módulo não definido na rota');
  });

  it('should use action "read" as default when not specified', fakeAsync(() => {
    authServiceMock.hasPermission.and.returnValue(of(true));
    const route = createRoute('members', undefined);

    TestBed.runInInjectionContext(() => {
      const guardResult = permissionGuard(route, createState);
      (guardResult as any).subscribe();
    });
    tick();

    expect(authServiceMock.hasPermission).toHaveBeenCalledWith('members', 'read');
  }));
});
