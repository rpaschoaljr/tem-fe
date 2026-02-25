import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Transaction } from '../../../core/models/transaction.model';
import { InputMaskDirective } from '../../../shared/directives/input-mask';

const CATEGORIES = ['Doação', 'Mensalidade', 'Liturgia', 'Contas', 'Manutenção', 'Outros'];

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    InputMaskDirective,
  ],
  providers: [],
  templateUrl: './transaction-form.html',
})
export class TransactionFormComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TransactionFormComponent>);

  categories = CATEGORIES;

  transaction: Transaction | null = inject(MAT_DIALOG_DATA);

  form = this.fb.group({
    description: [this.transaction?.description ?? '', [Validators.required, Validators.minLength(3)]],
    type:        [this.transaction?.type ?? 'Entrada', Validators.required],
    category:    [this.transaction?.category ?? '', Validators.required],
    date:        [this.transaction?.date ?? new Date(), Validators.required],
    value:       [Math.abs(this.transaction?.value ?? 0), [Validators.required, Validators.min(0.01)]],
  });

  get isEdit() { return !!this.transaction; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { description, type, category, date, value } = this.form.value;
    const signedValue = type === 'Saída' ? -Math.abs(value!) : Math.abs(value!);

    const result: Partial<Transaction> = {
      ...(this.transaction ?? {}),
      description: description!,
      type: type as 'Entrada' | 'Saída',
      category: category!,
      date: date as Date,
      value: signedValue,
    };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
