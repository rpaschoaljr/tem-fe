import { Component, inject, Inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { StockItem, StockLot } from '../../../core/models/stock-item.model';

export interface StockAdjustData {
  item: StockItem;
  type: 'add' | 'remove';
}

export interface AdjustResult { 
  updatedItem: StockItem; 
  delta: number; 
}

@Component({
  selector: 'app-stock-adjust',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatRadioModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-adjust.html',
})
export class StockAdjustComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<StockAdjustComponent>);
  
  data: StockAdjustData = inject(MAT_DIALOG_DATA);
  item = this.data.item;
  type = this.data.type;
  
  lots = signal<StockLot[]>(this.item.lots || []);
  hasLots = computed(() => this.lots().length > 0);

  form = this.fb.group({
    adjustMode: [this.type === 'add' ? 'new_lot' : 'existing_lot'], // 'new_lot' ou 'existing_lot'
    quantity: [1, [Validators.required, Validators.min(1)]],
    purchasePrice: [this.item.salePrice || null], // Opcional, exigido apenas se new_lot
    selectedLotId: ['']
  });

  constructor() {
    // Configura validações dinâmicas
    this.form.valueChanges.subscribe(v => {
      const mode = v.adjustMode;
      const qty = v.quantity || 1;
      
      if (this.type === 'add') {
        if (mode === 'new_lot') {
          this.form.get('purchasePrice')?.setValidators([Validators.required, Validators.min(0)]);
          this.form.get('selectedLotId')?.clearValidators();
        } else {
          this.form.get('purchasePrice')?.clearValidators();
          this.form.get('selectedLotId')?.setValidators([Validators.required]);
        }
      } else { // remove
        this.form.get('selectedLotId')?.setValidators([Validators.required]);
        
        // Verifica se a quantidade a remover é maior que o saldo do lote
        if (v.selectedLotId) {
          const lot = this.lots().find(l => l.id === v.selectedLotId);
          if (lot && qty > lot.quantity) {
             this.form.get('quantity')?.setErrors({ max: true, maxLot: lot.quantity });
          } else {
             if (this.form.get('quantity')?.hasError('max')) {
                 this.form.get('quantity')?.setErrors(null);
             }
          }
        }
      }
      this.form.get('purchasePrice')?.updateValueAndValidity({ emitEvent: false });
      this.form.get('selectedLotId')?.updateValueAndValidity({ emitEvent: false });
    });

    // Dispara a primeira validação
    this.form.updateValueAndValidity();
  }

  adjust(amount: number) {
    const current = this.form.get('quantity')?.value || 0;
    const next = Math.max(1, current + amount);
    this.form.patchValue({ quantity: next });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.value;
    const qty = v.quantity || 0;
    const updatedItem = JSON.parse(JSON.stringify(this.item)) as StockItem; // Clone
    if (!updatedItem.lots) updatedItem.lots = [];

    if (this.type === 'add') {
      if (v.adjustMode === 'new_lot') {
        // Criar lote
        const newLot: StockLot = {
          id: `lote_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          quantity: qty,
          purchasePrice: v.purchasePrice || 0,
          date: new Date()
        };
        updatedItem.lots.push(newLot);
      } else {
        // Somar ao lote existente
        const lot = updatedItem.lots.find(l => l.id === v.selectedLotId);
        if (lot) lot.quantity += qty;
      }
      updatedItem.quantity += qty;
    } else {
      // Subtrair do lote (Saída)
      const lot = updatedItem.lots.find(l => l.id === v.selectedLotId);
      if (lot) {
        lot.quantity -= qty;
        // Se zerar, podemos optar por manter com qtd 0 para histórico ou remover.
        // É melhor manter para saber o custo histórico se precisarmos, ou remover para limpar.
        // Vamos manter com qtd 0 para histórico no DRE.
      }
      updatedItem.quantity -= qty;
    }

    const result: AdjustResult = { updatedItem, delta: qty };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
