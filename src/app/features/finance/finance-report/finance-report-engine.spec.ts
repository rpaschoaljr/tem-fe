import { FinanceReportEngine, GroupingType } from './finance-report-engine';
import { Transaction } from '../../../core/models/transaction.model';

describe('FinanceReportEngine', () => {
  
  describe('Validação de Datas', () => {
    it('deve lançar erro se a data for inválida', () => {
      // Passando uma data explicitamente corrompida para simular falha no calendário
      const invalidDate = new Date('Data Invalida'); 
      expect(() => FinanceReportEngine.generateColumns(invalidDate, new Date(), 'AUTO'))
        .toThrowError('Data inicial ou final inválida.');
    });

    it('deve lançar erro se a data inicial for maior que a final', () => {
      const start = new Date('2026-06-01');
      const end = new Date('2026-05-01');
      expect(() => FinanceReportEngine.generateColumns(start, end, 'AUTO'))
        .toThrowError('A data inicial não pode ser maior que a data final.');
    });
  });

  describe('Agrupamento Automático (AUTO)', () => {
    it('deve agrupar por DIA se a diferença for <= 31 dias', () => {
      const start = new Date('2026-01-01T12:00:00');
      const end = new Date('2026-01-10T12:00:00');
      const columns = FinanceReportEngine.generateColumns(start, end, 'AUTO');
      
      expect(columns.length).toBe(10);
      expect(columns[0].label).toBe('01/01');
      expect(columns[9].label).toBe('10/01');
    });

    it('deve agrupar por MÊS se a diferença for > 31 dias e <= 365 dias', () => {
      const start = new Date('2026-01-01T12:00:00');
      const end = new Date('2026-04-15T12:00:00');
      const columns = FinanceReportEngine.generateColumns(start, end, 'AUTO');
      
      expect(columns.length).toBe(4);
      expect(columns[0].label).toBe('Jan/26');
      expect(columns[3].label).toBe('Abr/26');
    });

    it('deve agrupar por ANO se a diferença for > 365 dias', () => {
      const start = new Date('2024-01-01T12:00:00');
      const end = new Date('2026-01-01T12:00:00');
      const columns = FinanceReportEngine.generateColumns(start, end, 'AUTO');
      
      expect(columns.length).toBe(3);
      expect(columns[0].label).toBe('2024');
      expect(columns[2].label).toBe('2026');
    });
  });

  describe('Agregação de Transações', () => {
    it('deve agregar os valores corretamente nas colunas geradas', () => {
      const start = new Date('2026-01-01T12:00:00');
      const end = new Date('2026-02-15T12:00:00');
      const columns = FinanceReportEngine.generateColumns(start, end, 'MONTH'); // Forçando MÊS
      
      const txs = [
        { type: 'Entrada', category: 'Dízimo', value: 100, date: new Date('2026-01-10T12:00:00') },
        { type: 'Entrada', category: 'Dízimo', value: 50, date: new Date('2026-01-20T12:00:00') },
        { type: 'Entrada', category: 'Dízimo', value: 200, date: new Date('2026-02-05T12:00:00') },
        { type: 'Saída', category: 'Luz', value: 80, date: new Date('2026-01-15T12:00:00') },
      ] as Transaction[];

      const dre = FinanceReportEngine.processTransactions(txs, columns);

      // Deve gerar linhas: Entrada - Dízimo, Saída - Luz e RESULTADO DO EXERCÍCIO
      const dizimoRow = dre.find(r => r.category === 'Dízimo');
      expect(dizimoRow).toBeDefined();
      expect(dizimoRow.total).toBe(350); // 100 + 50 + 200
      expect(dizimoRow[columns[0].key]).toBe(150); // Janeiro
      expect(dizimoRow[columns[1].key]).toBe(200); // Fevereiro

      const luzRow = dre.find(r => r.category === 'Luz');
      expect(luzRow.total).toBe(80);
      expect(luzRow[columns[0].key]).toBe(80); // Janeiro

      const resultRow = dre.find(r => r.category === 'RESULTADO DO EXERCÍCIO');
      expect(resultRow.total).toBe(270); // 350 - 80
      expect(resultRow[columns[0].key]).toBe(70); // 150 - 80 (Jan)
      expect(resultRow[columns[1].key]).toBe(200); // 200 - 0 (Fev)
    });
  });
});
