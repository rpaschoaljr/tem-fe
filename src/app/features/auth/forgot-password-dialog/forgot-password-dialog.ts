import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Auth, sendPasswordResetEmail, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { NotificationService } from '../../../core/services/notification.service';
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

  email: string = '';
  loading = false;

  onCancel() {
    this.dialogRef.close();
  }

  async onConfirm() {
    if (!this.email) return;

    this.loading = true;
    try {
      // 1. Verifica se o e-mail existe na nossa base de MEMBROS (Firestore)
      this.membersService.getMembers().pipe(take(1)).subscribe(async members => {
        const member = members.find(m => m.email.toLowerCase() === this.email.toLowerCase());

        if (!member) {
          this.notify.showError('Este e-mail não está cadastrado como membro do sistema.');
          this.loading = false;
          return;
        }

        try {
          // 2. Tenta enviar o e-mail de reset
          await sendPasswordResetEmail(this.auth, this.email);
          this.notify.showSuccess('Link enviado com sucesso! Verifique seu e-mail.');
          this.dialogRef.close();
        } catch (error: any) {
          // 3. Se o erro for 'user-not-found', significa que o membro existe no Firestore mas não no Auth
          if (error.code === 'auth/user-not-found') {
            try {
              // Cria a conta no Auth com uma senha aleatória para que o e-mail de reset possa ser enviado
              const tempPass = Math.random().toString(36).slice(-10) + 'Aa1!';
              await createUserWithEmailAndPassword(this.auth, this.email, tempPass);
              
              // Agora que existe no Auth, envia o e-mail de reset
              await sendPasswordResetEmail(this.auth, this.email);
              
              this.notify.showSuccess('Conta ativada! Enviamos um link para você definir sua senha.');
              this.dialogRef.close();
            } catch (createErr: any) {
              this.notify.showError('Erro ao ativar sua conta. Procure o administrador.');
            }
          } else {
            this.notify.showError('Erro ao processar solicitação: ' + error.code);
          }
        } finally {
          this.loading = false;
        }
      });

    } catch (globalErr: any) {
      this.notify.showError('Erro inesperado.');
      this.loading = false;
    }
  }
}
