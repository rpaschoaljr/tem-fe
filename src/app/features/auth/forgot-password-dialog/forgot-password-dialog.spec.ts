import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MembersService } from '../../../core/services/members.service';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as fireAuth from '@angular/fire/auth';
import { FbUtils } from '../../../shared/utils/firebase-utils';

describe('ForgotPasswordDialogComponent', () => {
  let component: ForgotPasswordDialogComponent;
  let fixture: ComponentFixture<ForgotPasswordDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<ForgotPasswordDialogComponent>>;
  let notifySpy: jasmine.SpyObj<NotificationService>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;
  let membersServiceSpy: jasmine.SpyObj<MembersService>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    notifySpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    membersServiceSpy = jasmine.createSpyObj('MembersService', ['getMembers']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordDialogComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: NotificationService, useValue: notifySpy },
        { provide: LoggerService, useValue: loggerSpy },
        { provide: MembersService, useValue: membersServiceSpy }
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
    expect(membersServiceSpy.getMembers).not.toHaveBeenCalled();
  });

  describe('onConfirm', () => {
    it('should show error if member not found', fakeAsync(() => {
      component.email = 'notfound@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([]));
      
      component.onConfirm();
      tick();

      expect(notifySpy.showError).toHaveBeenCalledWith('Este e-mail não está cadastrado como membro do sistema.');
      expect(component.loading).toBeFalse();
    }));

    it('should send reset email successfully', fakeAsync(() => {
      component.email = 'found@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([{ email: 'found@test.com' } as any]));
      
      try { (((FbUtils.sendPasswordResetEmail as any)?.and ? FbUtils.sendPasswordResetEmail : spyOn(FbUtils, 'sendPasswordResetEmail')) as any).and.returnValue(Promise.resolve()); } catch (e) {}
      
      component.onConfirm();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith('Link enviado com sucesso! Verifique seu e-mail.');
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.loading).toBeFalse();
    }));

    it('should handle generic sendPasswordResetEmail error', fakeAsync(() => {
      component.email = 'found@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([{ email: 'found@test.com' } as any]));
      
      try { (((FbUtils.sendPasswordResetEmail as any)?.and ? FbUtils.sendPasswordResetEmail : spyOn(FbUtils, 'sendPasswordResetEmail')) as any).and.returnValue(Promise.reject({ code: 'auth/invalid-email' })); } catch (e) {}
      
      component.onConfirm();
      tick();

      expect(notifySpy.showError).toHaveBeenCalledWith('Erro ao processar solicitação: auth/invalid-email');
      expect(component.loading).toBeFalse();
    }));

    it('should handle user-not-found error by creating a user and sending reset email', fakeAsync(() => {
      component.email = 'found@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([{ email: 'found@test.com' } as any]));
      
      try { 
        let calls = 0;
        (((FbUtils.sendPasswordResetEmail as any)?.and ? FbUtils.sendPasswordResetEmail : spyOn(FbUtils, 'sendPasswordResetEmail')) as any).and.callFake(() => {
          calls++;
          if (calls === 1) return Promise.reject({ code: 'auth/user-not-found' });
          return Promise.resolve();
        });
      } catch (e) {}
      
      try { (((FbUtils.createUserWithEmailAndPassword as any)?.and ? FbUtils.createUserWithEmailAndPassword : spyOn(FbUtils, 'createUserWithEmailAndPassword')) as any).and.returnValue(Promise.resolve({} as any)); } catch (e) {}

      component.onConfirm();
      tick();

      expect(notifySpy.showSuccess).toHaveBeenCalledWith('Conta ativada! Enviamos um link para você definir sua senha.');
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(component.loading).toBeFalse();
    }));

    it('should handle error when creating a user after user-not-found', fakeAsync(() => {
      component.email = 'found@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([{ email: 'found@test.com' } as any]));
      
      try { (((FbUtils.sendPasswordResetEmail as any)?.and ? FbUtils.sendPasswordResetEmail : spyOn(FbUtils, 'sendPasswordResetEmail')) as any).and.returnValue(Promise.reject({ code: 'auth/user-not-found' })); } catch (e) {}
      try { (((FbUtils.createUserWithEmailAndPassword as any)?.and ? FbUtils.createUserWithEmailAndPassword : spyOn(FbUtils, 'createUserWithEmailAndPassword')) as any).and.returnValue(Promise.reject(new Error('Create error'))); } catch (e) {}

      component.onConfirm();
      tick();

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(notifySpy.showError).toHaveBeenCalledWith('Erro ao ativar sua conta. Procure o administrador.');
      expect(component.loading).toBeFalse();
    }));

    it('should handle global error in the subscription block', fakeAsync(() => {
      component.email = 'found@test.com';
      membersServiceSpy.getMembers.and.returnValue(of([{ email: 'found@test.com' } as any]));
      
      try { (((FbUtils.sendPasswordResetEmail as any)?.and ? FbUtils.sendPasswordResetEmail : spyOn(FbUtils, 'sendPasswordResetEmail')) as any).and.throwError('Global sync error'); } catch (e) {}

      component.onConfirm();
      tick();

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(notifySpy.showError).toHaveBeenCalledWith('Erro inesperado.');
      expect(component.loading).toBeFalse();
    }));
  });
});
