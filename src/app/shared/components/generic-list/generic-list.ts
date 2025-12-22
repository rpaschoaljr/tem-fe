import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

// Interface corrigida (sem duplicidade)
export interface ColumnDef {
  def: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'status' | 'stock-level';
}

@Component({
  selector: 'app-generic-list',
  standalone: true,
  imports: [
    CommonModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatIconModule, MatButtonModule, MatTooltipModule
  ],
  templateUrl: './generic-list.html',
  styleUrl: './generic-list.scss'
})
export class GenericListComponent implements OnChanges, AfterViewInit {
  @Input() data: any[] = [];
  @Input() columns: ColumnDef[] = [];

  @Output() editAction = new EventEmitter<any>();
  @Output() deleteAction = new EventEmitter<any>();
  @Output() restoreAction = new EventEmitter<any>();

  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [];
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
  }

  updateTable() {
    this.displayedColumns = [...this.columns.map(c => c.def), 'actions'];
    const filteredData = this.data.filter(item => !!item.deleted === this.showDeleted);
    this.dataSource.data = filteredData;
  }

  toggleDeletedMode() {
    this.showDeleted = !this.showDeleted;
    this.updateTable();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
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
}