import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Trata os links enviados por e-mail pelo Firebase Auth (redefinição de senha,
 * verificação de e-mail). Substitui a página padrão hospedada pelo Firebase,
 * mantendo o tema do sistema e redirecionando para o login ao concluir.
 */
@Component({
  selector: 'app-auth-action',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './auth-action.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './auth-action.scss'
})
export class AuthActionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  form!: FormGroup;
  state: 'verificando' | 'formulario' | 'invalido' | 'salvando' = 'verificando';
  errorMsg = '';
  email = '';
  hidePassword = true;
  hideConfirm = true;

  private oobCode = '';

  ngOnInit() {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    const params = this.route.snapshot.queryParamMap;
    const mode = params.get('mode');
    this.oobCode = params.get('oobCode') || '';

    if (!this.oobCode) {
      this.fail('Link inválido ou incompleto. Solicite um novo e-mail de acesso.');
      return;
    }

    if (mode === 'verifyEmail') {
      this.authService.applyActionCode(this.oobCode).subscribe({
        next: () => {
          this.notify.showSuccess('E-mail verificado com sucesso!');
          this.router.navigate(['/login']);
        },
        error: () => this.fail('Não foi possível verificar o e-mail. O link pode ter expirado.')
      });
      return;
    }

    if (mode && mode !== 'resetPassword') {
      this.fail('Este tipo de link não é suportado. Solicite um novo e-mail de acesso.');
      return;
    }

    // resetPassword (padrão): valida o código antes de mostrar o formulário
    this.authService.verifyPasswordResetCode(this.oobCode).subscribe({
      next: (email) => {
        this.email = email;
        this.state = 'formulario';
      },
      error: (err: unknown) => {
        this.logger.error('Código de redefinição inválido', err);
        this.fail('Este link expirou ou já foi utilizado. Peça um novo em "Esqueci minha senha".');
      }
    });
  }

  private fail(msg: string) {
    this.errorMsg = msg;
    this.state = 'invalido';
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  onSubmit() {
    if (this.form.invalid || this.state === 'salvando') return;

    this.state = 'salvando';
    const newPassword = this.form.get('password')?.value;

    this.authService.confirmPasswordReset(this.oobCode, newPassword).subscribe({
      next: () => {
        this.notify.showSuccess('Senha definida com sucesso! Faça login para entrar.');
        this.router.navigate(['/login']);
      },
      error: (err: unknown) => {
        this.logger.error('Erro ao definir a senha', err);
        this.state = 'formulario';
        this.notify.showError('Não foi possível definir a senha. O link pode ter expirado.');
      }
    });
  }

  voltarAoLogin() {
    this.router.navigate(['/login']);
  }
}
