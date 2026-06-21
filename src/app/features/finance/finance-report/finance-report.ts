import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinanceService } from '../../../core/services/finance.service';
import { Transaction } from '../../../core/models/transaction.model';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-finance-report',
  standalone: true,
  imports: [
    CommonModule, 
    BaseChartDirective, 
    MatCardModule, 
    MatSelectModule, 
    MatOptionModule, 
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    RouterModule
  ],
  templateUrl: './finance-report.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './finance-report.scss',
})
export class FinanceReport implements OnInit {
  financeService = inject(FinanceService);

  transactions: Transaction[] = [];
  years: number[] = [];
  selectedYear: number = new Date().getFullYear();

  months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  dreData: any[] = [];
  displayedColumns: string[] = ['category', ...this.months, 'total'];

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: {},
      y: { min: 0 }
    },
    plugins: {
      legend: { display: true },
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: this.months,
    datasets: [
      { data: [], label: 'Entradas', backgroundColor: '#4caf50' },
      { data: [], label: 'Saídas', backgroundColor: '#f44336' }
    ]
  };

  ngOnInit() {
    this.financeService.getTransactions().subscribe(txs => {
      this.transactions = txs.filter(t => !t.deleted);
      this.extractYears();
      this.processReport();
    });
  }

  extractYears() {
    const ySet = new Set<number>();
    this.transactions.forEach(t => {
      const y = t.refYear || t.date.getFullYear();
      ySet.add(y);
    });
    if (!ySet.has(this.selectedYear)) {
      ySet.add(this.selectedYear);
    }
    this.years = Array.from(ySet).sort((a, b) => b - a);
  }

  onYearChange(year: number) {
    this.selectedYear = year;
    this.processReport();
  }

  processReport() {
    const txs = this.transactions.filter(t => (t.refYear || t.date.getFullYear()) === this.selectedYear);

    const entradas = new Array(12).fill(0);
    const saidas = new Array(12).fill(0);
    const categoryMap = new Map<string, number[]>();

    txs.forEach(t => {
      const month = t.refMonth ? t.refMonth - 1 : t.date.getMonth();
      const val = Math.abs(t.value || 0);
      
      if (t.type === 'Entrada') {
        entradas[month] += val;
      } else {
        saidas[month] += val;
      }

      const catKey = `${t.type} - ${t.category}`;
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, new Array(12).fill(0));
      }
      categoryMap.get(catKey)![month] += val;
    });

    this.barChartData.datasets[0].data = entradas;
    this.barChartData.datasets[1].data = saidas;
    this.barChartData = { ...this.barChartData };

    this.dreData = [];
    const sortedCats = Array.from(categoryMap.keys()).sort();

    let totalEntradasAno = 0;
    let totalSaidasAno = 0;

    sortedCats.forEach(cat => {
      const rowData = categoryMap.get(cat)!;
      const total = rowData.reduce((a, b) => a + b, 0);
      const isEntrada = cat.startsWith('Entrada');
      
      if (isEntrada) totalEntradasAno += total;
      else totalSaidasAno += total;

      const row: any = { category: cat.substring(10), type: isEntrada ? 'Entrada' : 'Saída', total };
      this.months.forEach((m, i) => {
        row[m] = rowData[i];
      });
      this.dreData.push(row);
    });

    const resultRow: any = { category: 'RESULTADO DO EXERCÍCIO', type: 'Result', total: totalEntradasAno - totalSaidasAno };
    this.months.forEach((m, i) => {
      resultRow[m] = entradas[i] - saidas[i];
    });
    this.dreData.push(resultRow);
  }
}
