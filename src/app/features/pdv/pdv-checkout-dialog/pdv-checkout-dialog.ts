import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pdv-checkout-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormsModule, MatRadioModule, MatIconModule],
  templateUrl: './pdv-checkout-dialog.html',
  styleUrl: './pdv-checkout-dialog.scss',
})
export class PdvCheckoutDialog {
  paymentMethod: string = 'PIX';

  constructor(
    public dialogRef: MatDialogRef<PdvCheckoutDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { totalAmount: number; cart: any[]; paymentMethods: any[] }
  ) {}

  confirm() {
    this.dialogRef.close(this.paymentMethod);
  }
}
