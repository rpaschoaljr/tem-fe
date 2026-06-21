import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FirstAccessComponent } from './first-access';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as fireAuth from '@angular/fire/auth';
import * as firestore from 'firebase/firestore';
import { FbUtils } from '../../../shared/utils/firebase-utils';

describe('FirstAccessComponent', () => {
  let component: FirstAccessComponent;
  let fixture: ComponentFixture<FirstAccessComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let notifySpy: jasmine.SpyObj<NotificationService>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let memberSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    notifySpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['completeFirstAccess', 'logout']);
    memberSubject = new BehaviorSubject<any>(null);
    Object.defineProperty(authServiceSpy, 'member$', { get: () => memberSubject.asObservable() });

    await TestBed.configureTestingModule({
      imports: [FirstAccessComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notifySpy },
        { provide: LoggerService, useValue: loggerSpy },
        { provide: AuthService, useValue: authServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FirstAccessComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should navigate to login if member is null on init', fakeAsync(() => {
    memberSubject.next(null);
    fixture.detectChanges();
    tick();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('should navigate to dashboard if member is not first access', fakeAsync(() => {
    memberSubject.next({ id: '123', name: 'Test', isFirstAccess: false });
    fixture.detectChanges();
    tick();
    expect(component.memberName).toBe('Test');
    expect(component.memberId).toBe('123');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('should stay on page if member is first access', fakeAsync(() => {
    memberSubject.next({ id: '123', name: 'Test', isFirstAccess: true });
    fixture.detectChanges();
    tick();
    expect(component.memberName).toBe('Test');
    expect(component.memberId).toBe('123');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  }));

  it('passwordMatchValidator should return mismatch if passwords do not match', () => {
    fixture.detectChanges();
    component.form.controls['password'].setValue('123456');
    component.form.controls['confirmPassword'].setValue('654321');
    expect(component.form.errors).toEqual({ mismatch: true });
    expect(component.form.valid).toBeFalse();
  });

  it('should not submit if form is invalid', async () => {
    fixture.detectChanges();
    component.form.controls['password'].setValue('');
    await component.onSubmit();
    expect(component.loading).toBeFalse();
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      memberSubject.next({ id: '123', name: 'Test', isFirstAccess: true });
      fixture.detectChanges();
      
      // We must provide a fake current user on Auth
      const auth = TestBed.inject(fireAuth.Auth);
      (auth as any).currentUser = { uid: '123' };

      component.form.controls['password'].setValue('123456');
      component.form.controls['confirmPassword'].setValue('123456');
    });

    it('should submit successfully and update document', fakeAsync(() => {

      authServiceSpy.completeFirstAccess.and.returnValue(of(undefined));

      component.onSubmit();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith('Senha definida com sucesso! Bem-vindo.');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
      expect(component.loading).toBeFalse();
    }));

    it('should handle generic error', fakeAsync(() => {
      authServiceSpy.completeFirstAccess.and.returnValue(throwError(() => new Error('Generic Error')));
      
      component.onSubmit();
      tick();

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(notifySpy.showError).toHaveBeenCalledWith('Erro ao definir senha.');
      expect(component.loading).toBeFalse();
    }));

    it('should handle requires-recent-login error', fakeAsync(() => {
      authServiceSpy.logout.and.returnValue(of(undefined));
      authServiceSpy.completeFirstAccess.and.returnValue(throwError(() => ({ code: 'auth/requires-recent-login' })));
      
      component.onSubmit();
      tick();

      expect(authServiceSpy.logout).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
      expect(notifySpy.showError).toHaveBeenCalledWith('Por segurança, faça login novamente para trocar a senha.');
      expect(component.loading).toBeFalse();
    }));
  });
});
