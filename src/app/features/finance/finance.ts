import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FinanceService } from '../../core/services/finance.service';
import { NotificationService } from '../../core/services/notification.service'; // <--- Importe
import { Transaction } from '../../core/models/transaction.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, GenericListComponent],
  templateUrl: './finance.html',
  styleUrl: './finance.scss'
})
export class FinanceComponent implements OnInit {
  private financeService = inject(FinanceService);
  private notify = inject(NotificationService); // <--- Injeção

  transactions: Transaction[] = [];

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

  // Carregamento com tratamento de erro
  loadData() {
    this.financeService.getTransactions().subscribe({
      next: (data) => {
        this.transactions = data;
        this.calculateKPIs();
      },
      error: (err) => {
        this.notify.showError('Erro ao carregar dados financeiros. Tente recarregar a página.');
      }
    });
  }

  calculateKPIs() {
    const active = this.transactions.filter(t => !t.deleted);
    this.totalIncome = active.filter(t => t.value > 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalExpense = active.filter(t => t.value < 0).reduce((acc, curr) => acc + curr.value, 0);
    this.totalBalance = this.totalIncome + this.totalExpense;
  }

  // --- Ações com Try/Catch (Simulado via Subscribe Error) ---

  onNewEntry() {
    this.notify.showSuccess('Formulário de Entrada será aberto em breve.');
  }

  onNewExpense() {
    this.notify.showSuccess('Formulário de Saída será aberto em breve.');
  }

  onEdit(transaction: Transaction) {
    // Tentativa de editar (vai dar erro proposital conforme pedimos)
    this.financeService.update(transaction).subscribe({
      next: () => this.notify.showSuccess('Editado com sucesso!'),
      error: (err) => {
        // Exibe o erro visualmente para o usuário
        this.notify.showError('Não foi possível editar: ' + err.message);
      }
    });
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