import { Component, inject, Inject, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './stock-adjust.html',
})
export class StockAdjustComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<StockAdjustComponent>);
  item: StockItem = inject(MAT_DIALOG_DATA);

  form = this.fb.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  adjust(amount: number) {
    const current = this.form.get('quantity')?.value || 0;
    const next = Math.max(1, current + amount);
    this.form.patchValue({ quantity: next });
  }

  onSubmit() {
    if (this.form.invalid) return;
    const delta = this.form.value.quantity ?? 0;
    const result: AdjustResult = { item: this.item, delta };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
