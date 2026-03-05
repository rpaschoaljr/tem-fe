import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog';
import { take, filter } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatDialogModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);


  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  openForgotPassword() {
    this.dialog.open(ForgotPasswordDialogComponent, {
      width: '100%',
      maxWidth: '400px'
    });
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;

      try {
        await signInWithEmailAndPassword(this.auth, email!, password!);

        // Aguarda carregar o membro para decidir a rota
        this.authService.member$.pipe(
          filter(m => !!m),
          take(1)
        ).subscribe(member => {
          if (member?.isFirstAccess) {
            this.notify.showSuccess('Bem-vindo! Por favor, defina sua senha.');
            this.router.navigate(['/first-access']);
          } else {
            this.notify.showSuccess('Axé! Login realizado com sucesso.');
            this.router.navigate(['/dashboard']);
          }
        });

      } catch (error: any) {
        // Erro visual tratado
        let msg = 'Erro ao acessar.';
        if (error.code === 'auth/invalid-credential') msg = 'E-mail ou senha incorretos.';
        if (error.code === 'auth/user-not-found') msg = 'Usuário não cadastrado.';

        this.notify.showError(msg);
      }
    }
  }
}