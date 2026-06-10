import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Auth, updatePassword } from '@angular/fire/auth';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './change-password-dialog.html',
  styles: [`
    .full-width { width: 100%; margin: 10px 0; }
    p { margin-bottom: 20px; color: #666; font-size: 0.9rem; }
  `]
})
export class ChangePasswordDialogComponent {
  private dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  form: FormGroup;
  loading = false;
  hidePassword = true;
  hideConfirm = true;

  constructor() {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  onCancel() {
    this.dialogRef.close();
  }

  async onConfirm() {
    if (this.form.valid && this.auth.currentUser) {
      this.loading = true;
      try {
        const newPassword = this.form.get('password')?.value;
        await updatePassword(this.auth.currentUser, newPassword);
        this.notify.showSuccess('Senha alterada com sucesso!');
        this.dialogRef.close(true);
      } catch (error: unknown) {
        this.logger.error('Erro ao alterar senha', error);
        let msg = 'Erro ao alterar senha.';
        if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/requires-recent-login') {
          msg = 'Por segurança, você precisa fazer login novamente antes de trocar a senha.';
        }
        this.notify.showError(msg);
      } finally {
        this.loading = false;
      }
    }
  }
}
