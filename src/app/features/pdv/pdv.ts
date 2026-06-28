import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { StockItem } from '../../core/models/stock-item.model';
import { SaleItem } from '../../core/models/sale.model';
import { PdvCheckoutDialog } from './pdv-checkout-dialog/pdv-checkout-dialog';
import { SalesHistory } from './sales-history/sales-history';
import { StockService } from '../../core/services/stock.service';
import { PdvService } from '../../core/services/pdv.service';
import { ConfigService } from '../../core/services/config.service';
import { getPtBrPaginatorIntl } from '../../shared/components/generic-list/generic-list';

@Component({
  selector: 'app-pdv',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatIconModule, 
    MatCardModule, 
    MatSnackBarModule,
    MatPaginatorModule,
    MatSidenavModule,
    MatBadgeModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    SalesHistory
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: getPtBrPaginatorIntl }
  ],
  templateUrl: './pdv.html',
  styleUrl: './pdv.scss',
})
export class Pdv implements OnInit {
  dialog = inject(MatDialog);
  stockService = inject(StockService);
  pdvService = inject(PdvService);
  configService = inject(ConfigService);
  snackbar = inject(MatSnackBar);
  cdr = inject(ChangeDetectorRef);
  
  products: StockItem[] = [];
  paymentMethods: any[] = [];
  cart: SaleItem[] = [];
  loading = true;
  isCartOpen = false;
  showingHistory = false;

  // Pagination & Search
  searchQuery = '';
  pageIndex = 0;
  pageSize = 20;

  get filteredProducts(): StockItem[] {
    let filtered = this.products;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  get pagedProducts(): StockItem[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  onSearchChange() {
    this.pageIndex = 0; // Reset page when searching
  }

  toggleHistory() {
    this.showingHistory = !this.showingHistory;
  }

  loadToCart(items: SaleItem[]) {
    this.cart = [...items];
    this.showingHistory = false;
    this.isCartOpen = true; // For mobile
  }

  loadProducts() {
    this.stockService.getStock().subscribe((items: StockItem[]) => {
      this.products = items.filter((i: StockItem) => i.isForSale && !i.deleted);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    this.loadProducts();

    this.configService.getConfig('pdv').subscribe(config => {
      const pmField = config.fields.find(f => f.key === 'paymentMethods');
      if (pmField && pmField.options) {
        this.paymentMethods = pmField.options.filter(o => !o.deleted);
      }
    });
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  addToCart(product: StockItem) {
    if (product.quantity <= 0 && !product.allowBackorder) return;
    
    const existing = this.cart.find(i => i.itemId === product.id);
    if (existing) {
      this.updateQuantity(existing, existing.quantity + 1);
    } else {
      const fractionFactor = product.fractionable && product.fractionFactor ? product.fractionFactor : 1;
      const displayName = product.fractionable && product.saleUnitName 
                          ? `${product.name} (${product.saleUnitName})` 
                          : product.name;
      this.cart.push({
        itemId: product.id!,
        name: displayName,
        quantity: 1,
        unitPrice: product.salePrice || 0,
        totalPrice: product.salePrice || 0,
        totalCost: 0,
        fractionFactor: fractionFactor,
        lotsDeducted: []
      });
    }
  }

  updateQuantity(item: SaleItem, qty: number) {
    if (qty <= 0) {
      this.removeFromCart(item);
      return;
    }
    const product = this.products.find(p => p.id === item.itemId);
    const fractionFactor = product?.fractionable && product?.fractionFactor ? product.fractionFactor : 1;
    
    if (product && (product.quantity < qty * fractionFactor) && !product.allowBackorder) {
        this.snackbar.open('Estoque insuficiente para esta quantidade.', 'OK', { duration: 3000 });
        return;
    }
    item.quantity = qty;
    item.totalPrice = item.quantity * item.unitPrice;
  }

  removeFromCart(item: SaleItem) {
    this.cart = this.cart.filter(i => i !== item);
  }

  checkout() {
    if (this.cart.length === 0) return;
    
    const dialogRef = this.dialog.open(PdvCheckoutDialog, {
      width: '500px',
      data: { totalAmount: this.cartTotal, cart: this.cart, paymentMethods: this.paymentMethods }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const saleData = {
          totalAmount: this.cartTotal,
          paymentMethod: result,
          items: this.cart
        };
        
        this.pdvService.checkout(saleData as any).subscribe({
          next: () => {
            this.snackbar.open('Venda finalizada com sucesso!', 'OK', { duration: 3000 });
            this.cart = [];
            this.isCartOpen = false;
            this.loadProducts();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Erro ao finalizar:', err);
            this.snackbar.open(`Erro ao finalizar: ${err.message}`, 'Fechar', { duration: 5000 });
          }
        });
      }
    });
  }
}
