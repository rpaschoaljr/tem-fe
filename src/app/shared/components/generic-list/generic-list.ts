import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, MatPaginatorIntl } from '@angular/material/paginator';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

// Função para traduzir e compactar o paginador
export function getPtBrPaginatorIntl() {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Itens:';
  intl.nextPageLabel = 'Próximo';
  intl.previousPageLabel = 'Anterior';
  intl.firstPageLabel = 'Primeira';
  intl.lastPageLabel = 'Última';
  
  intl.getRangeLabel = (page: number, pageSize: number, length: number) => {
    if (length === 0 || pageSize === 0) return `0 de ${length}`;
    const startIndex = page * pageSize;
    const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
    return `${startIndex + 1}-${endIndex} / ${length}`;
  };
  return intl;
}

// Interface corrigida (sem duplicidade)
export interface ColumnDef {
  def: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'status' | 'stock-level';
  hideOnMobile?: boolean;
}

@Component({
  selector: 'app-generic-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatIconModule, MatButtonModule, MatTooltipModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: getPtBrPaginatorIntl }
  ],
  animations: [
    trigger('detailExpand', [
      state('collapsed, void', style({ height: '0px', minHeight: '0', display: 'none' })),
      state('expanded', style({ height: '*' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
      transition('expanded <=> void', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'))
    ]),
  ],
  templateUrl: './generic-list.html',
  styleUrl: './generic-list.scss'
})
export class GenericListComponent implements OnChanges, AfterViewInit {
  @Input() data: any[] = [];
  @Input() columns: ColumnDef[] = [];
  @Input() showAdjust = false;
  @Input() hideTrash = false;
  @Input() hideActions = false;
  @Input() rowClassFn?: (row: any) => any;

  @Output() editAction = new EventEmitter<any>();
  @Output() deleteAction = new EventEmitter<any>();
  @Output() restoreAction = new EventEmitter<any>();
  @Output() adjustAction = new EventEmitter<{ item: any, type: 'add' | 'remove' }>();
  @Output() filteredDataChange = new EventEmitter<any[]>();

  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [];
  expandedElement: any | null = null;
  showDeleted = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['columns']) {
      this.updateTable();
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.setupCustomFilter();
    
    // Notifica dados iniciais
    setTimeout(() => this.emitFilteredData(), 0);
  }

  updateTable() {
    this.displayedColumns = [...this.columns.map(c => c.def), 'actions'];
    const filteredData = this.data.filter(item => !!item.deleted === this.showDeleted);
    this.dataSource.data = filteredData;
    this.emitFilteredData();
  }

  toggleDeletedMode() {
    this.showDeleted = !this.showDeleted;
    this.updateTable();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    this.emitFilteredData();
  }

  emitFilteredData() {
    // Retorna os dados que passaram pelo filtro interno do MatTableDataSource
    const filtered = this.dataSource.filteredData;
    this.filteredDataChange.emit(filtered);
  }

  setupCustomFilter() {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const dataStr = this.columns
        .map(col => data[col.def])
        .join(' ')
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const filterStr = filter
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      return dataStr.includes(filterStr);
    };
  }

  confirmDelete(item: any) {
    if (confirm('Tem certeza que deseja mover para a lixeira?')) {
      this.deleteAction.emit(item);
    }
  }

  getStockClass(item: any): string {
    const q = item.quantity ?? 0;
    const min = item.minStock ?? 0;
    if (q <= 0) return 'critical';
    if (q <= min) return 'warning';
    return 'normal';
  }

  toggleRow(element: any) {
    this.expandedElement = this.expandedElement === element ? null : element;
  }

  hasHiddenColumns(): boolean {
    return this.columns.some(c => c.hideOnMobile);
  }

  getHiddenColumns(): ColumnDef[] {
    return this.columns.filter(c => c.hideOnMobile);
  }
}
