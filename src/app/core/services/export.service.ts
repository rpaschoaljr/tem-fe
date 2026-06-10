import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private logger = inject(LoggerService);

  exportToCsv<T>(data: T[], filename: string, columns: { key: string, label: string }[]) {
    if (!data || !data.length) {
      return;
    }

    const separator = ';';
    const csvContent: string[] = [];

    csvContent.push(columns.map(c => this.escapeCsvValue(c.label)).join(separator));

    for (const row of data) {
      const line = columns.map(col => {
        let val = this.resolveValue(row, col.key);
        return this.escapeCsvValue(val);
      });
      csvContent.push(line.join(separator));
    }

    const blobContent = '\ufeff' + csvContent.join('\n');
    const blob = new Blob([blobContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private resolveValue(obj: unknown, path: string): string {
    if (obj === null || obj === undefined) return '';
    
    const value = path.split('.').reduce<unknown>((prev, curr) => (prev as Record<string, unknown>)?.[curr], obj);

    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('pt-BR');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') return value.toString().replace('.', ',');
    
    return String(value);
  }

  private escapeCsvValue(val: unknown): string {
    let str = String(val).replace(/"/g, '""');
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      str = `"${str}"`;
    }
    return str;
  }
}
