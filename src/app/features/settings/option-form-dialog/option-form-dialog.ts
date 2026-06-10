import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FieldOption } from '../../../core/models/system-config.model';

@Component({
  selector: 'app-option-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.edit ? 'Editar' : 'Novo' }} {{ data.label }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome / Descrição</mat-label>
          <input matInput formControlName="label" placeholder="Ex: MENSALIDADE" (input)="onInputName($event)">
          <mat-error>Obrigatório</mat-error>
        </mat-form-field>

        <div class="row-flex" *ngIf="data.showMeta">
          <mat-form-field appearance="outline" style="flex: 2">
            <mat-label>Tipo / Operação</mat-label>
            <mat-select formControlName="meta">
              <mat-option value="Entrada">Entrada (Crédito)</mat-option>
              <mat-option value="Saída">Saída (Débito)</mat-option>
            </mat-select>
            <mat-error>Obrigatório</mat-error>
          </mat-form-field>

          <mat-checkbox formControlName="requiresMember" color="primary" style="margin-top: 10px;">
            Vincular a Membro?
          </mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Cancelar</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Confirmar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-container { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; min-width: 350px; }
    .full-width { width: 100%; }
    .row-flex { display: flex; gap: 16px; align-items: flex-start; }
  `]
})
export class OptionFormDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<OptionFormDialogComponent>);
  
  form: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { label: string, showMeta: boolean, value?: FieldOption, edit?: boolean }) {
    this.form = this.fb.group({
      label: [this.data.value?.label || '', [Validators.required, Validators.minLength(2)]],
      meta: [this.data.value?.meta || (this.data.showMeta ? 'Entrada' : ''), this.data.showMeta ? Validators.required : []],
      requiresMember: [this.data.value?.requiresMember || false]
    });
  }

  onInputName(event: Event) {
    const val = (event.target as HTMLInputElement).value.toUpperCase();
    this.form.get('label')?.setValue(val, { emitEvent: false });
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
