import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  /**
   * Exporta um array de objetos para CSV
   * @param data Dados a serem exportados
   * @param filename Nome do arquivo (sem extensão)
   * @param columns Mapeamento de chaves do objeto para labels das colunas
   */
  exportToCsv(data: any[], filename: string, columns: { key: string, label: string }[]) {
    if (!data || !data.length) {
      return;
    }

    const separator = ';';
    const csvContent = [];

    // Cabeçalho
    csvContent.push(columns.map(c => this.escapeCsvValue(c.label)).join(separator));

    // Linhas
    for (const row of data) {
      const line = columns.map(col => {
        let val = this.resolveValue(row, col.key);
        return this.escapeCsvValue(val);
      });
      csvContent.push(line.join(separator));
    }

    // Adiciona BOM para o Excel reconhecer UTF-8
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

  private resolveValue(obj: any, path: string): string {
    if (obj === null || obj === undefined) return '';
    
    // Suporta caminhos aninhados tipo 'address.city'
    const value = path.split('.').reduce((prev, curr) => prev?.[curr], obj);

    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString('pt-BR');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'number') return value.toString().replace('.', ',');
    
    return String(value);
  }

  private escapeCsvValue(val: any): string {
    let str = String(val).replace(/"/g, '""'); // Escapa aspas
    if (str.includes(';') || str.includes('\n') || str.includes('"')) {
      str = `"${str}"`; // Envolve em aspas se tiver separador ou quebra de linha
    }
    return str;
  }
}
