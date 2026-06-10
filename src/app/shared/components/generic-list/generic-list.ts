import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit, inject } from '@angular/core';
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
import { LoggerService } from '../../../core/services/logger.service';

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
export class GenericListComponent<T> implements OnChanges, AfterViewInit {
  private readonly logger = inject(LoggerService);

  @Input() data: T[] = [];
  @Input() columns: ColumnDef[] = [];
  @Input() showAdjust = false;
  @Input() hideTrash = false;
  @Input() hideActions = false;
  @Input() rowClassFn?: (row: T) => Record<string, boolean | string> | null;

  @Output() editAction = new EventEmitter<T>();
  @Output() deleteAction = new EventEmitter<T>();
  @Output() restoreAction = new EventEmitter<T>();
  @Output() adjustAction = new EventEmitter<{ item: T, type: 'add' | 'remove' }>();
  @Output() filteredDataChange = new EventEmitter<T[]>();

  dataSource = new MatTableDataSource<T>([]);
  displayedColumns: string[] = [];
  expandedElement: T | null = null;
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
    this.setupNaturalSort();
    
    setTimeout(() => this.emitFilteredData(), 0);
  }

  setupNaturalSort() {
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    
    this.dataSource.sortData = (data: T[], sort: MatSort) => {
      const active = sort.active;
      const direction = sort.direction;
      
      if (!active || direction === '') {
        return data;
      }

      return [...data].sort((a, b) => {
        let valueA = (a as unknown as Record<string, unknown>)[active];
        let valueB = (b as unknown as Record<string, unknown>)[active];

        if (valueA === null || valueA === undefined) valueA = '';
        if (valueB === null || valueB === undefined) valueB = '';

        let comparison = 0;

        if (typeof valueA === 'number' && typeof valueB === 'number') {
          comparison = valueA - valueB;
        }
        else if (valueA instanceof Date && valueB instanceof Date) {
          comparison = valueA.getTime() - valueB.getTime();
        }
        else {
          comparison = collator.compare(String(valueA), String(valueB));
        }

        return direction === 'asc' ? comparison : -comparison;
      });
    };
  }

  updateTable() {
    this.displayedColumns = [...this.columns.map(c => c.def), 'actions'];
    const filteredData = this.data.filter(item => !!(item as unknown as Record<string, unknown>)['deleted'] === this.showDeleted);
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
    Promise.resolve().then(() => {
      const filtered = this.dataSource.filteredData;
      this.filteredDataChange.emit(filtered);
    });
  }

  setupCustomFilter() {
    this.dataSource.filterPredicate = (data: T, filter: string) => {
      const dataStr = this.columns
        .map(col => (data as unknown as Record<string, unknown>)[col.def])
        .join(' ')
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const filterStr = filter
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      return dataStr.includes(filterStr);
    };
  }

  confirmDelete(item: T) {
    if (confirm('Tem certeza que deseja mover para a lixeira?')) {
      this.deleteAction.emit(item);
    }
  }

  getStockClass(item: T): string {
    const q = (item as unknown as Record<string, unknown>)['quantity'] as number ?? 0;
    const min = (item as unknown as Record<string, unknown>)['minStock'] as number ?? 0;
    if (q <= 0) return 'critical';
    if (q <= min) return 'warning';
    return 'normal';
  }

  toggleRow(element: T) {
    this.expandedElement = this.expandedElement === element ? null : element;
  }

  hasHiddenColumns(): boolean {
    return this.columns.some(c => c.hideOnMobile);
  }

  getHiddenColumns(): ColumnDef[] {
    return this.columns.filter(c => c.hideOnMobile);
  }
}
