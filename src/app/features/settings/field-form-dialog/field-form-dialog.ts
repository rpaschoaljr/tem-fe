import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DynamicField, FieldOption } from '../../../core/models/system-config.model';

@Component({
  selector: 'app-field-form-dialog',
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
    <h2 mat-dialog-title>{{ data.edit ? 'Editar' : 'Novo' }} Campo Personalizado</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Nome do Campo (Label)</mat-label>
          <input matInput formControlName="label" placeholder="Ex: Grau de Escolaridade">
          <mat-error>Obrigatório</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Seção do Formulário</mat-label>
          <mat-select formControlName="section">
            <mat-option value="Dados Pessoais">Dados Pessoais</mat-option>
            <mat-option value="Endereço">Endereço</mat-option>
            <mat-option value="Vida Espiritual">Vida Espiritual</mat-option>
            <mat-option value="Consagrações (Orixás)">Consagrações (Orixás)</mat-option>
            <mat-option value="Informações Adicionais">Informações Adicionais</mat-option>
          </mat-select>
          <mat-error>Obrigatório</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tipo de Dado</mat-label>
          <mat-select formControlName="type">
            <mat-option value="text">Texto Curto</mat-option>
            <mat-option value="number">Número</mat-option>
            <mat-option value="date">Data</mat-option>
            <mat-option value="select">Lista de Seleção</mat-option>
            <mat-option value="boolean">Sim/Não (Checkbox)</mat-option>
          </mat-select>
          <mat-hint *ngIf="data.disableType">O tipo não pode ser alterado pois já existem dados vinculados.</mat-hint>
          <mat-error>Obrigatório</mat-error>
        </mat-form-field>

        <div class="row-flex">
          <mat-checkbox formControlName="required" color="primary">Obrigatório?</mat-checkbox>
          <mat-checkbox formControlName="showInProfile" color="primary">Liberar no perfil do usuário?</mat-checkbox>
        </div>

        <mat-form-field appearance="outline" class="full-width" *ngIf="form.get('type')?.value === 'select'">
          <mat-label>Opções da Lista (uma por linha ou separadas por vírgula)</mat-label>
          <textarea matInput formControlName="optionsList" rows="4" placeholder="Ex: MÉDIUM, OGÃ, CAMBONO"></textarea>
          <mat-hint>As opções já existentes serão mantidas se não forem removidas desta lista.</mat-hint>
        </mat-form-field>
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
    .row-flex { display: flex; gap: 16px; align-items: flex-start; padding: 8px 0; }
  `]
})
export class FieldFormDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<FieldFormDialogComponent>);
  
  form: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { value?: DynamicField, edit?: boolean, disableType?: boolean }) {
    const existingOptions = this.data.value?.options?.filter((o: FieldOption) => !o.deleted).map((o: FieldOption) => o.label).join('\n') || '';

    this.form = this.fb.group({
      label: [this.data.value?.label || '', [Validators.required, Validators.minLength(2)]],
      type: [{ value: this.data.value?.type || 'text', disabled: !!this.data.disableType }, Validators.required],
      required: [this.data.value?.required || false],
      section: [this.data.value?.section || 'Informações Adicionais', Validators.required],
      showInProfile: [this.data.value?.showInProfile || false],
      optionsList: [existingOptions]
    });
  }

  save() {
    if (this.form.valid) {
      const val = this.form.getRawValue(); 
      
      if (val.type === 'select') {
        const rawOptions = val.optionsList
          .split(/[\n,]+/)
          .map((o: string) => o.trim().toUpperCase())
          .filter((o: string) => o !== '');
        
        const currentOptions = this.data.value?.options || [];
        const deletedOptions = currentOptions.filter((o: FieldOption) => o.deleted);
        
        val.options = [
          ...rawOptions.map((label: string) => ({ label, deleted: false })),
          ...deletedOptions
        ];
      }
      
      delete val.optionsList;

      if (!this.data.edit) {
        val.key = val.label.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, '_');
      } else {
        val.key = this.data.value!.key;
      }
      this.dialogRef.close(val);
    }
  }

  close() {
    this.dialogRef.close();
  }
}
