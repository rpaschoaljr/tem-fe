import { Component, Inject, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StockItem } from '../../../core/models/stock-item.model';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-merge-stock-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h2 mat-dialog-title>Mesclar Itens de Estoque</h2>
    <mat-dialog-content>
      <p>Mova o saldo de um item para outro. O item de origem será removido.</p>
      
      <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px">
        <mat-form-field appearance="outline">
          <mat-label>Item de Origem (Será removido)</mat-label>
          <mat-select [formControl]="sourceControl">
            <mat-option *ngFor="let item of data.items" [value]="item.id" [disabled]="item.id === targetControl.value">
              {{item.name}} (Saldo: {{item.quantity}})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-icon style="align-self:center; opacity:0.5">arrow_downward</mat-icon>

        <mat-form-field appearance="outline">
          <mat-label>Item de Destino (Recebe o saldo)</mat-label>
          <mat-select [formControl]="targetControl">
            <mat-option *ngFor="let item of data.items" [value]="item.id" [disabled]="item.id === sourceControl.value">
              {{item.name}}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>CANCELAR</button>
      <button mat-raised-button color="warn" 
              [disabled]="sourceControl.invalid || targetControl.invalid"
              (click)="confirm()">
        MESCLAR AGORA
      </button>
    </mat-dialog-actions>
  `
})
export class MergeStockDialogComponent {
  private dialogRef = inject(MatDialogRef<MergeStockDialogComponent>);
  
  constructor(@Inject(MAT_DIALOG_DATA) public data: { items: StockItem[] }) {}

  sourceControl = new FormControl('', Validators.required);
  targetControl = new FormControl('', Validators.required);

  confirm() {
    this.dialogRef.close({
      sourceId: this.sourceControl.value,
      targetId: this.targetControl.value
    });
  }
}
