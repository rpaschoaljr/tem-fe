import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatButtonModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);
  private notify = inject(NotificationService);


  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;

      try {
        await signInWithEmailAndPassword(this.auth, email!, password!);

        // Sucesso visual
        this.notify.showSuccess('Axé! Login realizado com sucesso.');
        this.router.navigate(['/dashboard']);

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