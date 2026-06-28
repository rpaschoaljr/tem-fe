import { Component, inject, Inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { StockItem } from '../../../core/models/stock-item.model';
import { ConfigService } from '../../../core/services/config.service';

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
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './stock-form.html',
})
export class StockFormComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<StockFormComponent>);
  private configService = inject(ConfigService);

  categories = signal<string[]>([]);
  units = signal<string[]>([]);

  item: StockItem | null = inject(MAT_DIALOG_DATA);

  constructor() {
    this.configService.getConfig('stock').subscribe(config => {
      const catField = config.fields.find(f => f.key === 'category');
      const unitField = config.fields.find(f => f.key === 'unit');
      
      // Filtra apenas as opções NÃO deletadas para exibir no formulário
      if (catField?.options) {
        this.categories.set(catField.options.filter(o => !o.deleted).map(o => o.label));
      }
      if (unitField?.options) {
        this.units.set(unitField.options.filter(o => !o.deleted).map(o => o.label));
      }
    });

    this.form.get('isForSale')?.valueChanges.subscribe(isForSale => {
      const salePriceCtrl = this.form.get('salePrice');
      if (isForSale) {
        salePriceCtrl?.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        salePriceCtrl?.clearValidators();
      }
      salePriceCtrl?.updateValueAndValidity();
    });

    this.form.get('fractionable')?.valueChanges.subscribe(frac => {
      const unitNameCtrl = this.form.get('saleUnitName');
      const factorCtrl = this.form.get('fractionFactor');
      if (frac) {
        unitNameCtrl?.setValidators([Validators.required]);
        factorCtrl?.setValidators([Validators.required, Validators.min(0.001)]);
      } else {
        unitNameCtrl?.clearValidators();
        factorCtrl?.clearValidators();
      }
      unitNameCtrl?.updateValueAndValidity();
      factorCtrl?.updateValueAndValidity();
    });
  }

  form = this.fb.group({
    name:     [this.item?.name ?? '',     [Validators.required, Validators.minLength(2)]],
    category: [this.item?.category ?? '', Validators.required],
    unit:     [this.item?.unit ?? 'UN',   Validators.required],
    minStock: [this.item?.minStock ?? null],
    isForSale: [this.item?.isForSale ?? false],
    salePrice: [this.item?.salePrice ?? null],
    allowBackorder: [this.item?.allowBackorder ?? false],
    fractionable: [this.item?.fractionable ?? false],
    saleUnitName: [this.item?.saleUnitName ?? ''],
    fractionFactor: [this.item?.fractionFactor ?? null],
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
      name:     (v.name ?? '').trim().toUpperCase(),
      category: v.category ?? '',
      unit:     v.unit ?? 'UN',
      minStock: v.minStock ?? undefined,
      isForSale: v.isForSale ?? false,
      salePrice: v.salePrice ?? undefined,
      allowBackorder: v.allowBackorder ?? false,
      fractionable: v.fractionable ?? false,
      saleUnitName: v.saleUnitName ?? undefined,
      fractionFactor: v.fractionFactor ?? undefined,
      updatedAt: new Date(),
    };
    if (!this.item) {
      result.quantity = 0; // Força quantidade inicial = 0 na criação
      result.lots = [];
    }
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
