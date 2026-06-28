import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { StockService } from '../../core/services/stock.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { LoggerService } from '../../core/services/logger.service';
import { StockItem } from '../../core/models/stock-item.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';
import { StockFormComponent } from './stock-form/stock-form';
import { StockAdjustComponent, AdjustResult } from './stock-adjust/stock-adjust';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatIconModule, 
    MatButtonModule, 
    MatDialogModule, 
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    GenericListComponent
  ],
  templateUrl: './stock.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './stock.scss'
})
export class StockComponent implements OnInit {
  private stockService = inject(StockService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private authService = inject(AuthService);
  private exportService = inject(ExportService);
  private logger = inject(LoggerService);

  allItems: StockItem[] = [];
  items: StockItem[] = [];
  exportData: StockItem[] = [];
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
      error: (err: unknown) => {
        this.logger.error('Erro ao carregar estoque', err);
        this.notify.showError('Erro ao carregar estoque: ' + (err instanceof Error ? err.message : ''));
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
    let filtered = this.allItems;

    if (this.stockFilter === 'low') {
      filtered = filtered.filter(i => i.quantity > 0 && i.minStock && i.quantity <= i.minStock);
    } else if (this.stockFilter === 'out') {
      filtered = filtered.filter(i => i.quantity <= 0);
    }

    this.items = filtered;
  }

  setFilter(filter: 'all' | 'low' | 'out') {
    this.stockFilter = (this.stockFilter === filter) ? 'all' : filter;
    this.applyFilter();
  }

  exportStock() {
    const columns = [
      { key: 'name', label: 'Item' },
      { key: 'category', label: 'Categoria' },
      { key: 'unit', label: 'Unidade' },
      { key: 'quantity', label: 'Quantidade Atual' },
      { key: 'minStock', label: 'Estoque Mínimo' },
      { key: 'updatedAt', label: 'Última Atualização' }
    ];
    this.exportService.exportToCsv(this.exportData, 'estoque_temfe', columns);
  }

  onAdjust(event: { item: StockItem, type: 'add' | 'remove' }) {
    const item = event.item;
    const ref = this.dialog.open(StockAdjustComponent, { 
      data: { item, type: event.type }, 
      width: '100%',
      maxWidth: '400px',
      panelClass: 'responsive-dialog'
    });
    ref.afterClosed().subscribe((result: AdjustResult | undefined) => {
      if (!result) return;
      
      const updatedItem = result.updatedItem;
      const delta = result.delta;

      this.stockService.save(updatedItem).subscribe({
        next: () => {
          const action = event.type === 'add' ? 'adicionado ao' : 'removido do';
          this.notify.showSuccess(`Estoque ajustado! ${Math.abs(delta)} ${updatedItem.unit} ${action} saldo.`);
          this.loadData();
        },
        error: (e: unknown) => {
          this.logger.error('Erro ao ajustar estoque', e);
          this.notify.showError('Erro ao ajustar: ' + (e instanceof Error ? e.message : ''));
        },
      });
    });
  }

  public getRowClass(item: StockItem): Record<string, boolean> | null {
    if (item.quantity <= 0) return { 'stock-out': true };
    if (item.quantity > 0 && item.minStock && item.quantity <= item.minStock) return { 'stock-warning': true };
    return null;
  }
}
