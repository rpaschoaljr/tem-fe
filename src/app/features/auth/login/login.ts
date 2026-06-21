import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog';
import { take, filter, map, switchMap } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatDialogModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private logger = inject(LoggerService);


  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;

  openForgotPassword() {
    this.dialog.open(ForgotPasswordDialogComponent, {
      width: '100%',
      maxWidth: '400px'
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.loading = true;
      const { email, password } = this.loginForm.value;

      this.authService.login(email!, password!).subscribe({
        next: () => {
          this.authService.member$.pipe(
            filter(m => !!m), // Wait for the new member (ignore cached null)
            take(1),
            switchMap(member => 
              this.authService.permissions$.pipe(
                filter(p => !!p), // Wait for the new permissions (ignore cached null)
                take(1),
                map(perms => ({ member, perms }))
              )
            )
          ).subscribe({
            next: ({ member, perms }) => {
              this.loading = false;
              if (member?.isFirstAccess) {
                this.notify.showSuccess('Bem-vindo! Por favor, defina sua senha.');
                this.router.navigate(['/first-access']);
              } else {
                this.notify.showSuccess('Axé! Login realizado com sucesso.');
                this.router.navigate(['/dashboard']);
              }
            },
            error: () => {
              this.loading = false;
              this.notify.showError('Erro ao validar permissões.');
            }
          });
        },
        error: (error: any) => {
          this.loading = false;
          this.logger.error('Erro ao realizar login', error);
          let msg = 'Erro ao acessar.';
          if (error && typeof error === 'object' && 'code' in error) {
            if (error.code === 'auth/invalid-credential') msg = 'E-mail ou senha incorretos.';
            if (error.code === 'auth/user-not-found') msg = 'Usuário não cadastrado.';
          }

          this.notify.showError(msg);
        }
      });
    }
  }
}
