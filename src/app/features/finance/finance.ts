import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FinanceService } from '../../core/services/finance.service';
import { NotificationService } from '../../core/services/notification.service';
import { Transaction } from '../../core/models/transaction.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';
import { TransactionFormComponent } from './transaction-form/transaction-form';

const MONTHS = [
  { value: 0, label: 'Janeiro' }, { value: 1, label: 'Fevereiro' }, { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' }, { value: 4, label: 'Maio' }, { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' }, { value: 10, label: 'Novembro' }, { value: 11, label: 'Dezembro' },
];

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatDialogModule,
            MatSelectModule, MatFormFieldModule, FormsModule, MatTooltipModule, GenericListComponent],
  templateUrl: './finance.html',
  styleUrl: './finance.scss'
})
export class FinanceComponent implements OnInit {
  private financeService = inject(FinanceService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  allTransactions: Transaction[] = [];
  transactions: Transaction[] = [];

  months = MONTHS;
  years: number[] = [];
  selectedMonth: number | null = null;
  selectedYear: number | null = null;

  // KPIs
  totalBalance = 0;
  totalIncome = 0;
  totalExpense = 0;

  tableColumns: ColumnDef[] = [
    { def: 'date', label: 'Data', type: 'date' },
    { def: 'description', label: 'Descrição' },
    { def: 'category', label: 'Categoria' },
    { def: 'value', label: 'Valor (R$)', type: 'currency' }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.financeService.getTransactions().subscribe({
      next: (data) => {
        this.allTransactions = data;
        this.years = [...new Set(data.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
        if (!this.selectedYear && this.years.length) {
          this.selectedYear = this.years[0];
          this.selectedMonth = new Date().getMonth();
        }
        this.applyFilter();
      },
      error: (err) => {
        this.notify.showError('Erro ao carregar dados financeiros. Tente recarregar a página.');
      }
    });
  }

  applyFilter() {
    let filtered = this.allTransactions;
    if (this.selectedYear !== null) {
      filtered = filtered.filter(t => new Date(t.date).getFullYear() === this.selectedYear);
    }
    if (this.selectedMonth !== null) {
      filtered = filtered.filter(t => new Date(t.date).getMonth() === this.selectedMonth);
    }
    this.transactions = filtered;
    this.calculateKPIs();
  }

  clearFilter() {
    this.selectedMonth = null;
    this.selectedYear = null;
    this.transactions = this.allTransactions;
    this.calculateKPIs();
  }

  calculateKPIs() {
    const active = this.transactions.filter(t => !t.deleted);
    this.totalIncome = active.filter(t => t.value > 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalExpense = active.filter(t => t.value < 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalBalance = this.totalIncome + this.totalExpense;
  }

  // --- Ações ---

  openForm(transaction: Transaction | null = null) {
    const ref = this.dialog.open(TransactionFormComponent, {
      data: transaction,
      width: '480px',
    });
    ref.afterClosed().subscribe((result: Partial<Transaction> | undefined) => {
      if (!result) return;
      this.financeService.save(result as Transaction).subscribe({
        next: () => {
          this.notify.showSuccess(transaction ? 'Lançamento atualizado!' : 'Lançamento registrado!');
          this.loadData();
        },
        error: (e: any) => this.notify.showError('Erro ao salvar: ' + e.message),
      });
    });
  }

  onNewEntry() {
    this.openForm();
  }

  onNewExpense() {
    this.openForm();
  }

  onEdit(transaction: Transaction) {
    this.openForm(transaction);
  }

  onDelete(transaction: Transaction) {
    // Tenta deletar
    this.financeService.softDelete(transaction.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item movido para a lixeira.');
        this.loadData(); // Atualiza a lista (vai pegar do cache local atualizado)
      },
      error: (err) => {
        this.notify.showError('Erro ao deletar: ' + err.message);
      }
    });
  }

  onRestore(transaction: Transaction) {
    this.financeService.restore(transaction.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item restaurado com sucesso!');
        this.loadData();
      },
      error: (err) => {
        this.notify.showError('Erro ao restaurar: ' + err.message);
      }
    });
  }
}