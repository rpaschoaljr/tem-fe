import { Component, Inject, inject, ChangeDetectionStrategy } from '@angular/core';
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

        <div *ngIf="data.showMeta" class="advanced-config">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--mat-sys-on-surface-variant);">Preenchimento Automático (DRE)</h4>
          
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Centro de Custo (Obrigatório)</mat-label>
            <mat-select formControlName="costCenter">
              <mat-option *ngFor="let opt of data.costCenters" [value]="opt">{{ opt }}</mat-option>
            </mat-select>
            <mat-error>Obrigatório</mat-error>
          </mat-form-field>

          <div class="row-flex">
            <mat-form-field appearance="outline" style="flex: 1">
              <mat-label>Forma Pgto Padrão</mat-label>
              <mat-select formControlName="defaultPaymentMethod">
                <mat-option [value]="null">-- Nenhum --</mat-option>
                <mat-option *ngFor="let opt of data.paymentMethods" [value]="opt">{{ opt }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="flex: 1">
              <mat-label>Conta Padrão</mat-label>
              <mat-select formControlName="defaultBankAccount">
                <mat-option [value]="null">-- Nenhum --</mat-option>
                <mat-option *ngFor="let opt of data.bankAccounts" [value]="opt">{{ opt }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
        <div *ngIf="data.showFeeConfig" class="advanced-config">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--mat-sys-on-surface-variant);">Taxa Automática (Opcional)</h4>
          
          <div class="row-flex">
            <mat-form-field appearance="outline" style="flex: 1">
              <mat-label>Tipo de Taxa</mat-label>
              <mat-select formControlName="feeType">
                <mat-option [value]="null">Nenhuma</mat-option>
                <mat-option value="fixed">Valor Fixo (R$)</mat-option>
                <mat-option value="percentage">Porcentagem (%)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" style="flex: 1" *ngIf="form.get('feeType')?.value">
              <mat-label>Valor / Porcentagem</mat-label>
              <input matInput type="number" formControlName="feeValue" placeholder="Ex: 5">
            </mat-form-field>
          </div>
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .form-container { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; min-width: 400px; }
    .full-width { width: 100%; }
    .row-flex { display: flex; gap: 16px; align-items: flex-start; }
    .advanced-config { 
      background: var(--mat-sys-surface-container-low); 
      padding: 12px; 
      border-radius: 6px; 
      border: 1px solid var(--mat-sys-outline-variant); 
      margin-top: 8px; 
    }
  `]
})
export class OptionFormDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<OptionFormDialogComponent>);
  
  form: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { 
    label: string, 
    showMeta: boolean, 
    showFeeConfig?: boolean,
    costCenters?: string[],
    paymentMethods?: string[],
    bankAccounts?: string[],
    value?: FieldOption, 
    edit?: boolean 
  }) {
    this.form = this.fb.group({
      label: [this.data.value?.label || '', [Validators.required, Validators.minLength(2)]],
      meta: [this.data.value?.meta || (this.data.showMeta ? 'Entrada' : ''), this.data.showMeta ? Validators.required : []],
      requiresMember: [this.data.value?.requiresMember || false],
      costCenter: [this.data.value?.costCenter || '', this.data.showMeta ? Validators.required : []],
      defaultPaymentMethod: [this.data.value?.defaultPaymentMethod || null],
      defaultBankAccount: [this.data.value?.defaultBankAccount || null],
      feeType: [this.data.value?.feeType || null],
      feeValue: [this.data.value?.feeValue || null]
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
