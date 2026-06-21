import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
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
  private authService = inject(AuthService);
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
        try {
          const member = members.find(m => m.email?.toLowerCase() === this.email.toLowerCase());

          if (!member) {
            this.notify.showError('Este e-mail não está cadastrado como membro do sistema.');
            this.loading = false;
            return;
          }

          this.authService.resetPassword(this.email).subscribe({
            next: () => {
              this.notify.showSuccess('Link enviado com sucesso! Verifique seu e-mail.');
              this.dialogRef.close();
              this.loading = false;
            },
            error: (error: any) => {
              if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
                const tempPass = Math.random().toString(36).slice(-10) + 'Aa1!';
                this.authService.createUser(this.email, tempPass).subscribe({
                  next: () => {
                    this.authService.resetPassword(this.email).subscribe({
                      next: () => {
                        this.notify.showSuccess('Conta ativada! Enviamos um link para você definir sua senha.');
                        this.dialogRef.close();
                        this.loading = false;
                      },
                      error: () => {
                        this.notify.showError('Conta criada, mas falha ao enviar o link. Procure o administrador.');
                        this.loading = false;
                      }
                    });
                  },
                  error: (createErr) => {
                    this.logger.error('Erro ao criar conta para reset de senha', createErr);
                    this.notify.showError('Erro ao ativar sua conta. Procure o administrador.');
                    this.loading = false;
                  }
                });
              } else {
                this.notify.showError('Erro ao processar solicitação: ' + (error && typeof error === 'object' && 'code' in error ? error.code : ''));
                this.loading = false;
              }
            }
          });
        } catch (globalErr: unknown) {
          this.logger.error('Erro inesperado ao processar recuperação de senha', globalErr);
          this.notify.showError('Erro inesperado.');
          this.loading = false;
        }
      });
    } catch (globalErr: unknown) {
      this.logger.error('Erro inesperado ao iniciar recuperação de senha', globalErr);
      this.notify.showError('Erro inesperado.');
      this.loading = false;
    }
  }
}
