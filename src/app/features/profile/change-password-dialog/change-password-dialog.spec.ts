import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ChangePasswordDialogComponent } from './change-password-dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Auth } from '@angular/fire/auth';

import { MatDialogRef } from '@angular/material/dialog';

describe('ChangePasswordDialogComponent', () => {
  let component: ChangePasswordDialogComponent;
  let fixture: ComponentFixture<ChangePasswordDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<ChangePasswordDialogComponent>>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let auth: Auth;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['error']);

    mockAuthService = jasmine.createSpyObj('AuthService', ['updateUserPassword']);

    await TestBed.configureTestingModule({
      imports: [ChangePasswordDialogComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: NotificationService, useValue: mockNotification },
        { provide: LoggerService, useValue: mockLogger }
      ]
    }).overrideProvider(AuthService, { useValue: mockAuthService })
      .compileComponents();

    auth = TestBed.inject(Auth);
    Object.defineProperty(auth, 'currentUser', { get: () => ({ email: 'test@test.com' }) });

    fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and initialize form', () => {
    expect(component).toBeTruthy();
    expect(component.form.get('password')).toBeTruthy();
    expect(component.form.get('confirmPassword')).toBeTruthy();
  });

  it('should have invalid form when passwords do not match', () => {
    component.form.patchValue({
      password: 'password123',
      confirmPassword: 'password456'
    });
    expect(component.form.valid).toBeFalse();
    expect(component.form.hasError('mismatch')).toBeTrue();
  });

  it('should have invalid form when password is too short', () => {
    component.form.patchValue({
      password: '123',
      confirmPassword: '123'
    });
    expect(component.form.valid).toBeFalse();
    expect(component.form.get('password')?.hasError('minlength')).toBeTrue();
  });

  it('should have valid form when passwords match and are long enough', () => {
    component.form.patchValue({
      password: 'password123',
      confirmPassword: 'password123'
    });
    expect(component.form.valid).toBeTrue();
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should not update password if form is invalid', fakeAsync(() => {
    component.form.patchValue({ password: '123', confirmPassword: '456' });
    
    component.onConfirm();
    tick();

    expect(mockAuthService.updateUserPassword).not.toHaveBeenCalled();
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  }));

  it('should update password and close dialog on success', fakeAsync(() => {

    component.form.patchValue({
      password: 'newpassword123',
      confirmPassword: 'newpassword123'
    });
    mockAuthService.updateUserPassword.and.returnValue(of(undefined));

    component.onConfirm();
    tick();

    expect(mockAuthService.updateUserPassword).toHaveBeenCalledWith('newpassword123');
    expect(mockNotification.showSuccess).toHaveBeenCalledWith('Senha alterada com sucesso!');
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    expect(component.loading).toBeFalse();
  }));

  it('should handle generic error on update password', fakeAsync(() => {

    component.form.patchValue({ password: 'newpassword123', confirmPassword: 'newpassword123' });
    mockAuthService.updateUserPassword.and.returnValue(throwError(() => new Error('Unknown error')));

    component.onConfirm();
    tick();

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockNotification.showError).toHaveBeenCalledWith('Erro ao alterar senha.');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  }));

  it('should handle auth/requires-recent-login error on update password', fakeAsync(() => {

    component.form.patchValue({ password: 'newpassword123', confirmPassword: 'newpassword123' });
    mockAuthService.updateUserPassword.and.returnValue(throwError(() => ({ code: 'auth/requires-recent-login' })));

    component.onConfirm();
    tick();

    expect(mockNotification.showError).toHaveBeenCalledWith('Por segurança, você precisa fazer login novamente antes de trocar a senha.');
    expect(component.loading).toBeFalse();
  }));
});
