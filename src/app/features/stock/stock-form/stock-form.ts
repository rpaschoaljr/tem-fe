import { Component, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { StockItem } from '../../../core/models/stock-item.model';

const CATEGORIES = ['Velas', 'Ervas', 'Bebidas', 'Ritualística', 'Oferenda', 'Limpeza', 'Outros'];
const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'maço'];

@Component({
  selector: 'app-stock-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './stock-form.html',
})
export class StockFormComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<StockFormComponent>);

  categories = CATEGORIES;
  units = UNITS;

  item: StockItem | null = inject(MAT_DIALOG_DATA);

  form = this.fb.group({
    name:     [this.item?.name ?? '',     [Validators.required, Validators.minLength(2)]],
    category: [this.item?.category ?? '', Validators.required],
    unit:     [this.item?.unit ?? 'un',   Validators.required],
    quantity: [this.item?.quantity ?? 0,  [Validators.required, Validators.min(0)]],
    minStock: [this.item?.minStock ?? null],
  });

  get isEdit() { return !!this.item; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const result: Partial<StockItem> = {
      ...(this.item ?? {}),
      name:     v.name ?? '',
      category: v.category ?? '',
      unit:     v.unit ?? 'un',
      quantity: v.quantity ?? 0,
      minStock: v.minStock ?? undefined,
      updatedAt: new Date(),
    };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
