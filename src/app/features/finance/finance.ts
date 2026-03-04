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
import { ScheduledTransactionsService } from '../../core/services/scheduled-transactions.service';
import { ScheduledTransactionsDialogComponent } from './scheduled-transactions-dialog/scheduled-transactions-dialog';
import { DueSchedulesDialogComponent } from './scheduled-transactions-dialog/due-schedules-dialog';
import { ScheduledTransaction } from '../../core/models/scheduled-transaction.model';
import { forkJoin } from 'rxjs';

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
  private scheduledService = inject(ScheduledTransactionsService);

  allTransactions: Transaction[] = [];
  transactions: Transaction[] = [];

  months = MONTHS;
  years: number[] = [];
  selectedMonth: number | null = null;
  selectedYear: number | null = null;
  typeFilter: 'all' | 'income' | 'expense' = 'all';

  // KPIs
  totalBalance = 0;
  totalIncome = 0;
  totalExpense = 0;

  tableColumns: ColumnDef[] = [
    { def: 'date', label: 'Data', type: 'date', hideOnMobile: true },
    { def: 'description', label: 'Descrição' },
    { def: 'memberName', label: 'Membro', hideOnMobile: true },
    { def: 'category', label: 'Categoria', hideOnMobile: true },
    { def: 'value', label: 'Valor (R$)', type: 'currency' }
  ];

  ngOnInit() {
    this.loadData();
    this.checkDueSchedules();
  }

  loadData() {
    this.financeService.getTransactions().subscribe({
      next: (data) => {
        this.allTransactions = data;
        this.years = [...new Set(data.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
        if (this.selectedYear === null && this.years.length) {
          this.selectedYear = this.years[0];
          this.selectedMonth = new Date().getMonth();
        }
        this.applyFilter();
      },
      error: (err) => {
        this.notify.showError('Erro ao carregar dados financeiros.');
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

    this.calculateKPIs(filtered);

    if (this.typeFilter === 'income') {
      filtered = filtered.filter(t => t.value > 0);
    } else if (this.typeFilter === 'expense') {
      filtered = filtered.filter(t => t.value < 0);
    }

    this.transactions = filtered;
  }

  setFilter(type: 'all' | 'income' | 'expense') {
    this.typeFilter = (this.typeFilter === type) ? 'all' : type;
    this.applyFilter();
  }

  clearFilter() {
    this.selectedMonth = null;
    this.selectedYear = null;
    this.typeFilter = 'all';
    this.applyFilter();
  }

  calculateKPIs(data: Transaction[]) {
    const active = data.filter(t => !t.deleted);
    this.totalIncome = active.filter(t => t.value > 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalExpense = active.filter(t => t.value < 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalBalance = this.totalIncome + this.totalExpense;
  }

  openForm(transaction: Transaction | null = null) {
    const ref = this.dialog.open(TransactionFormComponent, {
      data: transaction,
      width: '100%',
      maxWidth: '480px',
      panelClass: 'responsive-dialog'
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

  onNewTransaction() { this.openForm(); }
  onEdit(transaction: Transaction) { this.openForm(transaction); }

  onDelete(transaction: Transaction) {
    this.financeService.softDelete(transaction.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item movido para a lixeira.');
        this.loadData();
      },
      error: (err) => this.notify.showError('Erro ao deletar: ' + err.message)
    });
  }

  onRestore(transaction: Transaction) {
    this.financeService.restore(transaction.id).subscribe({
      next: () => {
        this.notify.showSuccess('Item restaurado com sucesso!');
        this.loadData();
      },
      error: (err) => this.notify.showError('Erro ao restaurar: ' + err.message)
    });
  }

  openSchedules() {
    this.dialog.open(ScheduledTransactionsDialogComponent, {
      width: '100%',
      maxWidth: '720px',
      panelClass: 'responsive-dialog'
    });
  }

  private checkDueSchedules() {
    this.scheduledService.getDue().subscribe({
      next: (due: ScheduledTransaction[]) => {
        if (due.length === 0) return;
        const ref = this.dialog.open(DueSchedulesDialogComponent, {
          data: { schedules: due },
          width: '100%',
          maxWidth: '520px'
        });
        ref.afterClosed().subscribe((confirmed: boolean) => {
          if (!confirmed) return;
          const applies = due.map(s => this.scheduledService.applySchedule(s));
          forkJoin(applies).subscribe({
            next: () => {
              this.notify.showSuccess(`${due.length} lançamento(s) realizados com sucesso!`);
              this.loadData();
            },
            error: (e: any) => this.notify.showError('Erro ao lançar agendamentos: ' + e.message)
          });
        });
      },
      error: () => { /* silencioso — não bloqueia a tela */ }
    });
  }
}