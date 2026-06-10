import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Auth, sendPasswordResetEmail, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MembersService } from '../../../core/services/members.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatButtonModule
  ],
  templateUrl: './forgot-password-dialog.html',
  styles: [`
    .full-width { width: 100%; margin: 10px 0; }
    p { margin-bottom: 20px; color: #666; }
  `]
})
export class ForgotPasswordDialogComponent {
  private dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);
  private auth = inject(Auth);
  private notify = inject(NotificationService);
  private membersService = inject(MembersService);
  private logger = inject(LoggerService);

  email: string = '';
  loading = false;

  onCancel() {
    this.dialogRef.close();
  }

  async onConfirm() {
    if (!this.email) return;

    this.loading = true;
    try {
      this.membersService.getMembers().pipe(take(1)).subscribe(async members => {
        const member = members.find(m => m.email?.toLowerCase() === this.email.toLowerCase());

        if (!member) {
          this.notify.showError('Este e-mail não está cadastrado como membro do sistema.');
          this.loading = false;
          return;
        }

        try {
          await sendPasswordResetEmail(this.auth, this.email);
          this.notify.showSuccess('Link enviado com sucesso! Verifique seu e-mail.');
          this.dialogRef.close();
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
            try {
              const tempPass = Math.random().toString(36).slice(-10) + 'Aa1!';
              await createUserWithEmailAndPassword(this.auth, this.email, tempPass);
              
              await sendPasswordResetEmail(this.auth, this.email);
              
              this.notify.showSuccess('Conta ativada! Enviamos um link para você definir sua senha.');
              this.dialogRef.close();
            } catch (createErr: unknown) {
              this.logger.error('Erro ao criar conta para reset de senha', createErr);
              this.notify.showError('Erro ao ativar sua conta. Procure o administrador.');
            }
          } else {
            this.notify.showError('Erro ao processar solicitação: ' + (error && typeof error === 'object' && 'code' in error ? error.code : ''));
          }
        } finally {
          this.loading = false;
        }
      });

    } catch (globalErr: unknown) {
      this.logger.error('Erro inesperado ao processar recuperação de senha', globalErr);
      this.notify.showError('Erro inesperado.');
      this.loading = false;
    }
  }
}
