import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StockService } from '../../core/services/stock.service';
import { NotificationService } from '../../core/services/notification.service'; // Injeção de Notificação
import { StockItem } from '../../core/models/stock-item.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, GenericListComponent],
  templateUrl: './stock.html',
  styleUrl: './stock.scss'
})
export class StockComponent implements OnInit {
  private stockService = inject(StockService);
  private notify = inject(NotificationService);

  items: StockItem[] = [];

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
        this.items = data;
        this.calculateKPIs();
      },
      error: (err) => {
        // Tratamento de erro na leitura
        this.notify.showError('Erro ao carregar estoque: ' + err.message);
      }
    });
  }

  calculateKPIs() {
    const active = this.items.filter(i => !i.deleted);
    this.totalItems = active.length;
    this.outOfStockCount = active.filter(i => i.quantity <= 0).length;
    this.lowStockCount = active.filter(i => i.quantity > 0 && i.minStock && i.quantity < i.minStock).length;
  }

  onNewItem() {
    this.notify.showSuccess('Cadastro de item será aberto em breve.');
  }

  onEdit(item: StockItem) {
    // Try/Catch simulado via subscribe error
    this.stockService.update(item).subscribe({
      next: () => this.notify.showSuccess('Item atualizado com sucesso!'),
      error: (err) => {
        // Exibe o erro visual
        this.notify.showError('Não foi possível salvar: ' + err.message);
      }
    });
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
}