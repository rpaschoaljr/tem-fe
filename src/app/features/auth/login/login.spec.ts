import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as fireAuth from '@angular/fire/auth';
import { FbUtils } from '../../../shared/utils/firebase-utils';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let notifySpy: jasmine.SpyObj<NotificationService>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let memberSubject: BehaviorSubject<any>;
  let permissionsSubject: BehaviorSubject<any>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    notifySpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    memberSubject = new BehaviorSubject<any>(null);
    permissionsSubject = new BehaviorSubject<any>(null);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['login']);
    Object.defineProperty(authServiceSpy, 'member$', { get: () => memberSubject.asObservable() });
    Object.defineProperty(authServiceSpy, 'permissions$', { get: () => permissionsSubject.asObservable() });

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notifySpy },
        { provide: LoggerService, useValue: loggerSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: AuthService, useValue: authServiceSpy }
      ]
    })
    .overrideProvider(MatDialog, { useValue: dialogSpy })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit if form is invalid', async () => {
    component.loginForm.controls.email.setValue('');
    await component.onSubmit();
    expect(notifySpy.showSuccess).not.toHaveBeenCalled();
    expect(notifySpy.showError).not.toHaveBeenCalled();
  });

  it('should open forgot password dialog', () => {
    component.openForgotPassword();
    expect(dialogSpy.open).toHaveBeenCalled();
  });

  describe('onSubmit success', () => {
    beforeEach(() => {
      authServiceSpy.login.and.returnValue(of(undefined));
    });

    afterEach(() => {
      authServiceSpy.login.calls.reset();
    });

    it('should navigate to first-access if isFirstAccess is true', fakeAsync(() => {
      component.loginForm.controls.email.setValue('test@test.com');
      component.loginForm.controls.password.setValue('123456');
      
      memberSubject.next({ isFirstAccess: true });
      permissionsSubject.next({ modules: {} });
      
      component.onSubmit();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith('Bem-vindo! Por favor, defina sua senha.');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/first-access']);
    }));

    it('should navigate to dashboard if isFirstAccess is false', fakeAsync(() => {
      component.loginForm.controls.email.setValue('test@test.com');
      component.loginForm.controls.password.setValue('123456');
      
      memberSubject.next({ isFirstAccess: false });
      permissionsSubject.next({ modules: {} });
      
      component.onSubmit();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith('Axé! Login realizado com sucesso.');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    }));
  });

  describe('onSubmit errors', () => {
    it('should handle generic error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => new Error('Generic Error')));

      component.loginForm.controls.email.setValue('test@test.com');
      component.loginForm.controls.password.setValue('123456');
      
      component.onSubmit();
      tick();

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(notifySpy.showError).toHaveBeenCalledWith('Erro ao acessar.');
    }));

    it('should handle invalid-credential error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => ({ code: 'auth/invalid-credential' })));

      component.loginForm.controls.email.setValue('test@test.com');
      component.loginForm.controls.password.setValue('123456');
      
      component.onSubmit();
      tick();

      expect(notifySpy.showError).toHaveBeenCalledWith('E-mail ou senha incorretos.');
    }));

    it('should handle user-not-found error', fakeAsync(() => {
      authServiceSpy.login.and.returnValue(throwError(() => ({ code: 'auth/user-not-found' })));

      component.loginForm.controls.email.setValue('test@test.com');
      component.loginForm.controls.password.setValue('123456');
      
      component.onSubmit();
      tick();

      expect(notifySpy.showError).toHaveBeenCalledWith('Usuário não cadastrado.');
    }));
  });
});
