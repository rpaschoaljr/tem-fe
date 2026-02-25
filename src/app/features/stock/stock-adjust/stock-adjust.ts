import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StockItem } from '../../../core/models/stock-item.model';

export interface AdjustResult { item: StockItem; delta: number; }

@Component({
  selector: 'app-stock-adjust',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule,
  ],
  templateUrl: './stock-adjust.html',
})
export class StockAdjustComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<StockAdjustComponent>);
  item: StockItem = inject(MAT_DIALOG_DATA);

  form = this.fb.group({
    operation: ['entrada', Validators.required],
    quantity:  [1, [Validators.required, Validators.min(1)]],
  });

  get newTotal(): number {
    const delta = this.form.value.operation === 'entrada'
      ? (this.form.value.quantity ?? 0)
      : -(this.form.value.quantity ?? 0);
    return this.item.quantity + delta;
  }

  onSubmit() {
    if (this.form.invalid) return;
    const delta = this.form.value.operation === 'entrada'
      ? (this.form.value.quantity ?? 0)
      : -(this.form.value.quantity ?? 0);
    const result: AdjustResult = { item: this.item, delta };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
