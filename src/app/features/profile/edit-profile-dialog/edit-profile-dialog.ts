import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../core/services/members.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InputMaskDirective } from '../../../shared/directives/input-mask';

@Component({
  selector: 'app-edit-profile-dialog',
  templateUrl: './edit-profile-dialog.html',
  styleUrls: ['./edit-profile-dialog.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    InputMaskDirective
  ]
})
export class EditProfileDialogComponent {
  form: FormGroup;
  loading = false;
  
  private membersService = inject(MembersService);
  private notification = inject(NotificationService);

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<EditProfileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      phone: [data.member.phone || '', Validators.required],
      cep: [data.member.address?.cep || '', Validators.required],
      street: [data.member.address?.street || '', Validators.required],
      number: [data.member.address?.number || '', Validators.required],
      complement: [data.member.address?.complement || ''],
      neighborhood: [data.member.address?.neighborhood || '', Validators.required],
      city: [data.member.address?.city || '', Validators.required],
      state: [data.member.address?.state || '', Validators.required]
    });
  }

  buscarCep() {
    const cep = this.form.get('cep')?.value;
    if (cep && cep.replace(/\D/g, '').length === 8) {
      this.membersService.getAddressByCep(cep).subscribe((res) => {
        if (!res.erro) {
          this.form.patchValue({
            street: res.logradouro,
            neighborhood: res.bairro,
            city: res.localidade,
            state: res.uf
          });
        }
      });
    }
  }

  save() {
    const val = this.form.value;
    const hasEmptySpaces = 
      !val.phone?.trim() ||
      !val.cep?.trim() ||
      !val.street?.trim() ||
      !val.number?.trim() ||
      !val.neighborhood?.trim() ||
      !val.city?.trim() ||
      !val.state?.trim();

    if (this.form.invalid || hasEmptySpaces) {
      this.notification.showWarning('Preencha os campos obrigatórios.');
      return;
    }
    
    this.loading = true;
    const updateData = {
      phone: val.phone,
      address: {
        cep: val.cep,
        street: val.street,
        number: val.number,
        complement: val.complement,
        neighborhood: val.neighborhood,
        city: val.city,
        state: val.state
      }
    };

    this.membersService.updateProfileData(this.data.member.id, updateData).subscribe({
      next: () => {
        this.notification.showSuccess('Dados atualizados com sucesso!');
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.notification.showError('Erro ao atualizar dados: ' + err.message);
        this.loading = false;
      }
    });
  }
}
