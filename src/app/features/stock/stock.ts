import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockService } from '../../core/services/stock.service';
import { NotificationService } from '../../core/services/notification.service';
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

  allItems: StockItem[] = [];
  items: StockItem[] = [];
  stockFilter: 'all' | 'low' | 'out' = 'all';

  totalItems = 0;
  lowStockCount = 0;
  outOfStockCount = 0;

  tableColumns: ColumnDef[] = [
    { def: 'name', label: 'Item' },
    { def: 'category', label: 'Categoria' },
    { def: 'unit', label: 'Unidade' },
    { def: 'quantity', label: 'Qtd. Atual', type: 'stock-level' },
    { def: 'updatedAt', label: 'Última Mov.', type: 'date' }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.stockService.getStock().subscribe({
      next: (data) => {
        this.allItems = data;
        this.calculateKPIs();
        this.applyFilter();
      },
      error: (err) => {
        // Tratamento de erro na leitura
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

  openForm(item: StockItem | null = null) {
    const ref = this.dialog.open(StockFormComponent, {
      data: item,
      width: '480px',
    });
    ref.afterClosed().subscribe((result: Partial<StockItem> | undefined) => {
      if (!result) return;
      this.stockService.save(result as StockItem).subscribe({
        next: () => {
          this.notify.showSuccess(item ? 'Item atualizado!' : 'Item cadastrado!');
          this.loadData();
        },
        error: (e: any) => this.notify.showError('Erro ao salvar: ' + e.message),
      });
    });
  }

  onNewItem() {
    this.openForm();
  }

  onEdit(item: StockItem) {
    this.openForm(item);
  }

  onDelete(item: StockItem) {
    this.stockService.softDelete(item.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item movido para a lixeira.');
        this.loadData();
      },
      error: (err) => {
        this.notify.showError('Falha ao excluir item: ' + err.message);
      }
    });
  }

  onRestore(item: StockItem) {
    this.stockService.restore(item.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item restaurado ao estoque.');
        this.loadData();
      },
      error: (err) => {
        this.notify.showError('Falha ao restaurar: ' + err.message);
      }
    });
  }

  onAdjust(item: StockItem) {
    const ref = this.dialog.open(StockAdjustComponent, { data: item, width: '400px' });
    ref.afterClosed().subscribe((result: AdjustResult | undefined) => {
      if (!result) return;
      const updated: StockItem = { ...result.item, quantity: result.item.quantity + result.delta, updatedAt: new Date() };
      this.stockService.save(updated).subscribe({
        next: () => {
          this.notify.showSuccess(`Estoque ajustado! Novo saldo: ${updated.quantity} ${updated.unit}`);
          this.loadData();
        },
        error: (e: any) => this.notify.showError('Erro ao ajustar: ' + e.message),
      });
        });
      }
    
      /**
       * Retorna um objeto de classes CSS para a linha da tabela com base no status do estoque do item.
       * @param item O item de estoque a ser avaliado.
       * @returns Um objeto para ser usado com [ngClass].
       */
      public getRowClass(item: StockItem): any {
        if (item.quantity <= 0) {
          return { 'stock-out': true };
        }
        if (item.quantity > 0 && item.minStock && item.quantity <= item.minStock) {
          return { 'stock-warning': true };
        }
        return null;
      }
    }
    