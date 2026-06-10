import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { updatePassword, Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-first-access',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './first-access.html',
  styleUrl: './first-access.scss'
})
export class FirstAccessComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  form!: FormGroup;
  loading = false;
  hidePassword = true;
  hideConfirm = true;
  memberName = '';
  memberId = '';

  ngOnInit() {
    this.initForm();
    this.loadMemberData();
  }

  initForm() {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  loadMemberData() {
    this.authService.member$.pipe(take(1)).subscribe(member => {
      if (member) {
        this.memberName = member.name;
        this.memberId = member.id;
        
        if (!member.isFirstAccess) {
           this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async onSubmit() {
    if (this.form.valid && this.auth.currentUser) {
      this.loading = true;
      try {
        const newPassword = this.form.get('password')?.value;
        
        await updatePassword(this.auth.currentUser, newPassword);

        const memberRef = doc(this.firestore, 'members', this.memberId);
        await updateDoc(memberRef, { 
          isFirstAccess: false,
          updatedAt: new Date()
        });

        this.notify.showSuccess('Senha definida com sucesso! Bem-vindo.');
        this.router.navigate(['/dashboard']);
      } catch (error: unknown) {
        this.logger.error('Erro no primeiro acesso', error);
        let msg = 'Erro ao definir senha.';
        if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/requires-recent-login') {
          msg = 'Por segurança, faça login novamente para trocar a senha.';
          this.auth.signOut();
          this.router.navigate(['/login']);
        }
        this.notify.showError(msg);
      } finally {
        this.loading = false;
      }
    }
  }
}
