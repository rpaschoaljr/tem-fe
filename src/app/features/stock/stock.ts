import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockService } from '../../core/services/stock.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { StockItem } from '../../core/models/stock-item.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';
import { StockFormComponent } from './stock-form/stock-form';
import { StockAdjustComponent, AdjustResult } from './stock-adjust/stock-adjust';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatDialogModule, GenericListComponent],
  templateUrl: './stock.html',
  styleUrl: './stock.scss'
})
export class StockComponent implements OnInit {
  private stockService = inject(StockService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);

  allItems: StockItem[] = [];
  items: StockItem[] = [];
  stockFilter: 'all' | 'low' | 'out' = 'all';
  canWrite$ = this.authService.hasPermission('stock', 'write');

  totalItems = 0;
  lowStockCount = 0;
  outOfStockCount = 0;

  tableColumns: ColumnDef[] = [
    { def: 'name', label: 'Item' },
    { def: 'category', label: 'Categoria', hideOnMobile: true },
    { def: 'unit', label: 'Unidade', hideOnMobile: true },
    { def: 'quantity', label: 'Qtd. Atual', type: 'stock-level' },
    { def: 'updatedAt', label: 'Última Mov.', type: 'date', hideOnMobile: true }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.stockService.getStock(true).subscribe({
      next: (data) => {
        this.allItems = data;
        this.calculateKPIs();
        this.applyFilter();
      },
      error: (err) => {
        this.notify.showError('Erro ao carregar estoque: ' + err.message);
      }
    });
  }

  calculateKPIs() {
    const active = this.allItems.filter(i => !i.deleted);
    this.totalItems = active.length;
    this.outOfStockCount = active.filter(i => i.quantity <= 0).length;
    this.lowStockCount = active.filter(i => i.quantity > 0 && i.minStock && i.quantity <= i.minStock).length;
  }

  applyFilter() {
    if (this.stockFilter === 'low') {
      this.items = this.allItems.filter(i => i.quantity > 0 && i.minStock && i.quantity <= i.minStock);
    } else if (this.stockFilter === 'out') {
      this.items = this.allItems.filter(i => i.quantity <= 0);
    } else {
      this.items = this.allItems;
    }
  }

  setFilter(filter: 'all' | 'low' | 'out') {
    this.stockFilter = (this.stockFilter === filter) ? 'all' : filter;
    this.applyFilter();
  }

  onAdjust(event: { item: StockItem, type: 'add' | 'remove' }) {
    const item = event.item;
    const ref = this.dialog.open(StockAdjustComponent, { 
      data: item, 
      width: '100%',
      maxWidth: '400px',
      panelClass: 'responsive-dialog'
    });
    ref.afterClosed().subscribe((result: AdjustResult | undefined) => {
      if (!result) return;
      
      // Se o botão for 'remove', forçamos o delta a ser negativo
      let delta = Math.abs(result.delta);
      if (event.type === 'remove') delta = -delta;

      const updated: StockItem = { ...result.item, quantity: result.item.quantity + delta, updatedAt: new Date() };
      this.stockService.save(updated).subscribe({
        next: () => {
          const action = event.type === 'add' ? 'adicionado ao' : 'removido do';
          this.notify.showSuccess(`Estoque ajustado! ${Math.abs(delta)} ${updated.unit} ${action} saldo.`);
          this.loadData();
        },
        error: (e: any) => this.notify.showError('Erro ao ajustar: ' + e.message),
      });
    });
  }

  public getRowClass(item: StockItem): any {
    if (item.quantity <= 0) return { 'stock-out': true };
    if (item.quantity > 0 && item.minStock && item.quantity <= item.minStock) return { 'stock-warning': true };
    return null;
  }
}