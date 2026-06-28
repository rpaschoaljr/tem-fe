import { Component, inject, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GenericListComponent, ColumnDef } from '../../../shared/components/generic-list/generic-list';
import { Sale, SaleItem } from '../../../core/models/sale.model';
import { PdvService } from '../../../core/services/pdv.service';

function parseDate(date: any): number {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (typeof date.toMillis === 'function') return date.toMillis();
    if (date.seconds !== undefined) return date.seconds * 1000 + (date.nanoseconds || 0) / 1000000;
    if (typeof date === 'string') return new Date(date).getTime();
    if (typeof date === 'number') return date;
    return 0;
}

@Component({
  selector: 'app-sales-history',
  standalone: true,
  imports: [CommonModule, GenericListComponent, MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule],
  templateUrl: './sales-history.html',
  styleUrl: './sales-history.scss',
})
export class SalesHistory implements OnInit, OnDestroy {
  @Output() closeHistory = new EventEmitter<void>();
  @Output() editCart = new EventEmitter<SaleItem[]>();
  pdvService = inject(PdvService);
  snackbar = inject(MatSnackBar);
  
  tableColumns: ColumnDef[] = [
    { def: 'date', label: 'Data', type: 'date' },
    { def: 'itemsSummary', label: 'Itens' },
    { def: 'totalAmount', label: 'Total', type: 'currency' },
    { def: 'paymentMethod', label: 'Pagamento', type: 'status' }
  ];
  sales: (Sale & { itemsSummary?: string })[] = [];

  private sub: any;

  ngOnInit() {
    this.loadSales();
    this.sub = this.pdvService.salesUpdated$.subscribe(() => {
      this.loadSales();
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  loadSales() {
    this.pdvService.getSales().subscribe({
      next: (sales) => {
        // Sort descending
        this.sales = sales.sort((a, b) => {
          return parseDate(b.date) - parseDate(a.date);
        }).map(s => ({
          ...s,
          date: new Date(parseDate(s.date)), // Force it to be a Date object for generic-list
          itemsSummary: s.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
        }));
      },
      error: (err) => console.error('Erro ao carregar vendas:', err)
    });
  }

  getSaleDate(date: any): Date {
    return new Date(parseDate(date));
  }

  editSale(sale: Sale & { itemsSummary?: string }) {
    if (confirm('Ao editar, esta venda será estornada do financeiro e do estoque, e seus itens voltarão para o carrinho. Deseja continuar?')) {
      this.pdvService.cancelSale(sale.id!).subscribe({
        next: () => {
          this.snackbar.open('Venda estornada! Os itens estão no carrinho.', 'OK', { duration: 3000 });
          this.editCart.emit(sale.items);
        },
        error: (err) => {
          console.error('Erro ao estornar para edição:', err);
          this.snackbar.open(`Erro ao estornar para edição: ${err.message}`, 'Fechar', { duration: 5000 });
        }
      });
    }
  }

  deleteSale(sale: Sale & { itemsSummary?: string }) {
    if (confirm('Tem certeza que deseja estornar e excluir esta venda? O estoque e o financeiro serão revertidos.')) {
      this.pdvService.cancelSale(sale.id!).subscribe({
        next: () => {
          this.snackbar.open('Venda estornada com sucesso!', 'OK', { duration: 3000 });
          this.loadSales();
        },
        error: (err) => {
          console.error('Erro ao estornar:', err);
          this.snackbar.open(`Erro ao estornar: ${err.message}`, 'Fechar', { duration: 5000 });
        }
      });
    }
  }
}
