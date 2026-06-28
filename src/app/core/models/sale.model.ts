import { Timestamp } from '@angular/fire/firestore';

export interface SaleItem {
  itemId: string; // StockItem ID
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  totalCost: number; // For CMV calculation
  fractionFactor: number; // The fraction applied at the time of sale
  lotsDeducted: { lotId: string; quantity: number; costPrice: number }[]; // To track exactly which lots were deducted so we can refund them
}

export interface Sale {
  id?: string;
  date: Timestamp | Date;
  totalAmount: number;
  totalCost: number;
  paymentMethod: string;
  items: SaleItem[];
  financeTransactionId?: string; // Reference to the generated finance transaction
  createdBy: string; // User ID
  updatedBy?: string; // User ID
  updatedAt?: Timestamp | Date;
  deleted: boolean;
  deletedAt?: Timestamp | Date;
  deletedBy?: string;
}
