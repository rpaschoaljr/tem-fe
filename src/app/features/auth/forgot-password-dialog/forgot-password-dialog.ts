import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule
  ],
  templateUrl: './forgot-password-dialog.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .full-width { width: 100%; margin: 10px 0; }
    p { margin-bottom: 20px; color: #666; }
  `]
})
export class ForgotPasswordDialogComponent {
  private dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);
  private authService = inject(AuthService);
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  email: string = '';
  loading = false;

  onCancel() {
    this.dialogRef.close();
  }

  async onConfirm() {
    if (!this.email) return;

    this.loading = true;
    const email = this.email;

    // Mensagem genérica: nunca revela se o e-mail existe/está cadastrado (anti-enumeração).
    const done = () => {
      this.notify.showSuccess('Se o e-mail estiver cadastrado, enviamos um link de acesso. Verifique sua caixa de entrada e o spam.');
      this.dialogRef.close();
      this.loading = false;
    };

    // 1. Backend garante a conta de Auth do membro; 2. envia o link nativo do Firebase.
    this.authService.ensureFirstAccessAccount(email).subscribe({
      next: () => this.authService.resetPassword(email).subscribe({ next: done, error: done }),
      error: (err: unknown) => {
        this.logger.error('Erro ao preparar primeiro acesso', err);
        // Ainda assim tenta enviar o link e mostra mensagem genérica.
        this.authService.resetPassword(email).subscribe({ next: done, error: done });
      }
    });
  }
}
