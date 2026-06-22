import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../../core/services/finance.service';
import { Transaction } from '../../../core/models/transaction.model';
import { BaseChartDirective } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule, MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RouterModule } from '@angular/router';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { FinanceReportEngine, GroupingType, ReportColumn } from './finance-report-engine';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-finance-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective, 
    MatCardModule, 
    MatSelectModule, 
    MatOptionModule, 
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule,
    RouterModule
  ],
  templateUrl: './finance-report.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './finance-report.scss',
})
export class FinanceReport implements OnInit {
  financeService = inject(FinanceService);

  transactions: Transaction[] = [];

  // Filtros Dinâmicos
  startDate: Date;
  endDate: Date;
  groupingType: GroupingType = 'AUTO';

  // Opções de agrupamento
  groupingOptions: { value: GroupingType; label: string }[] = [
    { value: 'AUTO', label: 'Automático' },
    { value: 'DAY', label: 'Por Dia' },
    { value: 'WEEK', label: 'Por Semana' },
    { value: 'MONTH', label: 'Por Mês' },
    { value: 'YEAR', label: 'Por Ano' }
  ];
  
  dreData: any[] = [];
  dynamicColumns: ReportColumn[] = [];
  displayedColumns: string[] = ['category', 'total'];

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
    labels: [],
    datasets: [
      { data: [], label: 'Entradas', backgroundColor: '#4caf50' },
      { data: [], label: 'Saídas', backgroundColor: '#f44336' }
    ]
  };

  constructor() {
    const today = new Date();
    this.endDate = new Date(today.getFullYear(), 11, 31); // 31 de dezembro
    this.startDate = new Date(today.getFullYear(), 0, 1); // 1 de janeiro
  }

  ngOnInit() {
    this.financeService.getTransactions().subscribe(txs => {
      this.transactions = txs.filter(t => !t.deleted);
      this.processReport();
    });
  }

  onFilterChange() {
    if (this.startDate && this.endDate) {
      this.processReport();
    }
  }

  processReport() {
    try {
      this.dynamicColumns = FinanceReportEngine.generateColumns(this.startDate, this.endDate, this.groupingType);
      
      const filteredTxs = this.transactions.filter(t => {
        const d = t.date;
        const normalizedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
        const normStart = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate(), 0, 0, 0);
        const normEnd = new Date(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate(), 23, 59, 59);
        return normalizedDate >= normStart && normalizedDate <= normEnd;
      });

      this.dreData = FinanceReportEngine.processTransactions(filteredTxs, this.dynamicColumns);
      
      this.displayedColumns = ['category', ...this.dynamicColumns.map(c => c.key), 'total'];

      // Atualizar Gráfico
      this.barChartData.labels = this.dynamicColumns.map(c => c.label);
      
      const entradas = new Array(this.dynamicColumns.length).fill(0);
      const saidas = new Array(this.dynamicColumns.length).fill(0);

      this.dreData.forEach(row => {
        if (row.category === 'RESULTADO DO EXERCÍCIO') return;
        this.dynamicColumns.forEach((c, i) => {
          if (row.type === 'Entrada') entradas[i] += (row[c.key] || 0);
          else saidas[i] += (row[c.key] || 0);
        });
      });

      this.barChartData.datasets[0].data = entradas;
      this.barChartData.datasets[1].data = saidas;
      this.barChartData = { ...this.barChartData };

    } catch (e) {
      console.error('Erro ao processar relatório:', e);
      // Aqui pode-se adicionar um toast/snackbar de erro pro usuário (ex: data inválida)
    }
  }

  exportToExcel() {
    if (this.dreData.length === 0) return;

    // Transpor a matriz para o Excel: Períodos nas linhas e Categorias nas colunas
    const exportData = this.dynamicColumns.map(col => {
      const exportRow: any = {
        'Período': col.label,
      };

      this.dreData.forEach(row => {
        const val = row[col.key] || 0;
        exportRow[row.category] = row.type === 'Saída' && val > 0 ? -val : val;
      });

      return exportRow;
    });

    // Adicionar a linha de "Total Geral" no final da planilha
    const totalRow: any = {
      'Período': 'Total Geral'
    };
    
    this.dreData.forEach(row => {
      const totalVal = row.total || 0;
      totalRow[row.category] = row.type === 'Saída' && totalVal > 0 ? -totalVal : totalVal;
    });
    
    if (this.dynamicColumns.length > 100) {
      // Se houver mais de 100 linhas de período, joga o Total para a linha 2 (logo abaixo do cabeçalho)
      exportData.unshift(totalRow);
    } else {
      // Caso contrário, fica no final
      exportData.push(totalRow);
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DRE');

    // Salvar o arquivo
    const fileName = `Relatorio_DRE_${this.startDate.toISOString().split('T')[0]}_a_${this.endDate.toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
}
