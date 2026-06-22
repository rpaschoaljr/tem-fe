import { Transaction } from '../../../core/models/transaction.model';

export type GroupingType = 'AUTO' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface ReportColumn {
  key: string;
  label: string;
  start?: Date;
  end?: Date;
}

export class FinanceReportEngine {
  
  static generateColumns(start: Date, end: Date, type: GroupingType): ReportColumn[] {
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Data inicial ou final inválida.');
    }
    
    // Normalize to 12:00 to avoid DST shifting issues
    const safeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0);
    const safeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0);

    if (safeStart > safeEnd) {
      throw new Error('A data inicial não pode ser maior que a data final.');
    }

    const diffTime = Math.abs(safeEnd.getTime() - safeStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let actualType = type;
    if (actualType === 'AUTO') {
      if (diffDays <= 31) actualType = 'DAY';
      else if (diffDays <= 365) actualType = 'MONTH';
      else actualType = 'YEAR';
    }

    const columns: ReportColumn[] = [];
    let current = new Date(safeStart.getTime());

    const formatDay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const formatMonth = (d: Date) => {
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${months[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`;
    };

    if (actualType === 'DAY') {
      while (current <= safeEnd) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        const cStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0);
        const cEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59);
        columns.push({ key, label: formatDay(current), start: cStart, end: cEnd });
        current.setDate(current.getDate() + 1);
      }
    } else if (actualType === 'WEEK') {
      let weekNum = 1;
      while (current <= safeEnd) {
        const key = `W${weekNum}-${current.getFullYear()}`;
        const cStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0);
        
        const nextCurrent = new Date(current);
        nextCurrent.setDate(current.getDate() + 7);
        // A semana acaba no último milissegundo do 6º dia
        const cEnd = new Date(nextCurrent.getFullYear(), nextCurrent.getMonth(), nextCurrent.getDate(), 0, 0, 0);
        cEnd.setMilliseconds(-1);

        columns.push({ key, label: `Semana ${weekNum}`, start: cStart, end: cEnd });
        current = nextCurrent;
        weekNum++;
      }
    } else if (actualType === 'MONTH') {
      while (current <= safeEnd || (current.getMonth() === safeEnd.getMonth() && current.getFullYear() === safeEnd.getFullYear())) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const cStart = new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0);
        const cEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
        columns.push({ key, label: formatMonth(current), start: cStart, end: cEnd });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (actualType === 'YEAR') {
      while (current.getFullYear() <= safeEnd.getFullYear()) {
        const key = `${current.getFullYear()}`;
        const cStart = new Date(current.getFullYear(), 0, 1, 0, 0, 0);
        const cEnd = new Date(current.getFullYear(), 11, 31, 23, 59, 59);
        columns.push({ key, label: key, start: cStart, end: cEnd });
        current.setFullYear(current.getFullYear() + 1);
      }
    }

    return columns;
  }

  static processTransactions(transactions: Transaction[], columns: ReportColumn[]): any[] {
    const dreData: any[] = [];
    const categoryMap = new Map<string, number[]>();
    const entradasTotalArr = new Array(columns.length).fill(0);
    const saidasTotalArr = new Array(columns.length).fill(0);

    let totalEntradas = 0;
    let totalSaidas = 0;

    transactions.forEach(t => {
      // Find which column this transaction belongs to
      let colIndex = -1;
      const tDate = t.date;
      const normTDate = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), 12, 0, 0);
      
      // Busca universal por range de datas
      colIndex = columns.findIndex(c => c.start && c.end && normTDate >= c.start && normTDate <= c.end);
      
      if (colIndex !== -1) {
        const val = Math.abs(t.value || 0);
        const isEntrada = t.type === 'Entrada';

        if (isEntrada) {
          entradasTotalArr[colIndex] += val;
          totalEntradas += val;
        } else {
          saidasTotalArr[colIndex] += val;
          totalSaidas += val;
        }

        const catKey = `${t.type} - ${t.category}`;
        if (!categoryMap.has(catKey)) {
          categoryMap.set(catKey, new Array(columns.length).fill(0));
        }
        categoryMap.get(catKey)![colIndex] += val;
      }
    });

    // Construir o DRE Final
    const sortedCats = Array.from(categoryMap.keys()).sort();
    
    sortedCats.forEach(cat => {
      const rowData = categoryMap.get(cat)!;
      const total = rowData.reduce((a, b) => a + b, 0);
      const isEntrada = cat.startsWith('Entrada');
      
      const categoryName = cat.replace('Entrada - ', '').replace('Saída - ', '');

      const row: any = { category: categoryName, type: isEntrada ? 'Entrada' : 'Saída', total };
      columns.forEach((c, i) => {
        row[c.key] = rowData[i];
      });
      dreData.push(row);
    });

    const resultRow: any = { category: 'RESULTADO DO EXERCÍCIO', type: 'Result', total: totalEntradas - totalSaidas };
    columns.forEach((c, i) => {
      resultRow[c.key] = entradasTotalArr[i] - saidasTotalArr[i];
    });
    dreData.push(resultRow);

    return dreData;
  }
}
