import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const GENERIC_MSG = 'Se o e-mail estiver cadastrado, enviamos um link de acesso. Verifique sua caixa de entrada e o spam.';

describe('ForgotPasswordDialogComponent', () => {
  let component: ForgotPasswordDialogComponent;
  let fixture: ComponentFixture<ForgotPasswordDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<ForgotPasswordDialogComponent>>;
  let notifySpy: jasmine.SpyObj<NotificationService>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    notifySpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    authSpy = jasmine.createSpyObj('AuthService', ['ensureFirstAccessAccount', 'resetPassword']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: NotificationService, useValue: notifySpy },
        { provide: LoggerService, useValue: loggerSpy },
        { provide: AuthService, useValue: authSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });

  it('should not proceed if email is empty', async () => {
    component.email = '';
    await component.onConfirm();
    expect(authSpy.ensureFirstAccessAccount).not.toHaveBeenCalled();
  });

  describe('onConfirm', () => {
    it('ensures the account then sends the link and shows the generic message', fakeAsync(() => {
      component.email = 'found@test.com';
      authSpy.ensureFirstAccessAccount.and.returnValue(of({ ok: true }));
      authSpy.resetPassword.and.returnValue(of(undefined));

      component.onConfirm();
      tick();

      expect(authSpy.ensureFirstAccessAccount).toHaveBeenCalledWith('found@test.com');
      expect(authSpy.resetPassword).toHaveBeenCalledWith('found@test.com');
      expect(notifySpy.showSuccess).toHaveBeenCalledWith(GENERIC_MSG);
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.loading).toBeFalse();
    }));

    it('still shows the generic message if sending the link fails', fakeAsync(() => {
      component.email = 'found@test.com';
      authSpy.ensureFirstAccessAccount.and.returnValue(of({ ok: true }));
      authSpy.resetPassword.and.returnValue(throwError(() => ({ code: 'auth/invalid-email' })));

      component.onConfirm();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith(GENERIC_MSG);
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.loading).toBeFalse();
    }));

    it('falls back to sending the link (and logs) if ensuring the account fails', fakeAsync(() => {
      component.email = 'found@test.com';
      authSpy.ensureFirstAccessAccount.and.returnValue(throwError(() => new Error('backend down')));
      authSpy.resetPassword.and.returnValue(of(undefined));

      component.onConfirm();
      tick();

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(authSpy.resetPassword).toHaveBeenCalledWith('found@test.com');
      expect(notifySpy.showSuccess).toHaveBeenCalledWith(GENERIC_MSG);
      expect(component.loading).toBeFalse();
    }));
  });
});
