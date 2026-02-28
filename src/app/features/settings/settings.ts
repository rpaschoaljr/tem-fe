import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfigService } from '../../core/services/config.service';
import { ModuleConfig, DynamicField } from '../../core/models/system-config.model';
import { NotificationService } from '../../core/services/notification.service';

import { StockService } from '../../core/services/stock.service';
import { StockItem } from '../../core/models/stock-item.model';
import { StockFormComponent } from '../stock/stock-form/stock-form';
import { MergeStockDialogComponent } from '../stock/merge-stock-dialog/merge-stock-dialog';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';
import { OptionFormDialogComponent } from './option-form-dialog/option-form-dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatTabsModule, 
    MatIconModule, 
    MatButtonModule, 
    MatTableModule, 
    MatDialogModule,
    GenericListComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  private configService = inject(ConfigService);
  private stockService = inject(StockService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  stockConfig = signal<ModuleConfig | null>(null);
  financeConfig = signal<ModuleConfig | null>(null);
  stockItems = signal<StockItem[]>([]);
  
  loading = signal(true);
  mainTabIndex = 0;
  showOptionsTrash = signal<{ [key: string]: boolean }>({});

  stockColumns: ColumnDef[] = [
    { def: 'name', label: 'Nome do Item' },
    { def: 'category', label: 'Categoria', hideOnMobile: true },
    { def: 'unit', label: 'Unidade', hideOnMobile: true },
    { def: 'quantity', label: 'Qtd.', type: 'stock-level' }
  ];

  financeColumns: ColumnDef[] = [
    { def: 'label', label: 'Tipo de Lançamento' },
    { def: 'meta', label: 'Operação', type: 'text' }
  ];

  ngOnInit() {
    this.loadConfigs(true);
    this.loadStockItems();
  }

  loadStockItems() {
    this.stockService.getStock(true).subscribe(items => {
      this.stockItems.set(items.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }

  loadConfigs(initial = false) {
    if (initial) this.loading.set(true);
    
    // Carrega Config de Estoque
    this.configService.getConfig('stock').subscribe({
      next: (conf) => this.stockConfig.set(conf),
      complete: () => this.checkLoading()
    });
    // Carrega Config de Financeiro
    this.configService.getConfig('finance').subscribe({
      next: (conf) => this.financeConfig.set(conf),
      complete: () => this.checkLoading()
    });
  }

  private checkLoading() {
    if (this.stockConfig() && this.financeConfig()) {
      this.loading.set(false);
    }
  }

  // --- GESTÃO DE ITENS DO ESTOQUE ---

  onNewStockItem() {
    const ref = this.dialog.open(StockFormComponent, {
      width: '100%',
      maxWidth: '480px',
      panelClass: 'responsive-dialog'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.stockService.save(res).subscribe(() => {
          this.notify.showSuccess('Item cadastrado no catálogo!');
          this.loadStockItems();
        });
      }
    });
  }

  onEditStockItem(item: StockItem) {
    const ref = this.dialog.open(StockFormComponent, {
      data: item,
      width: '100%',
      maxWidth: '480px',
      panelClass: 'responsive-dialog'
    });
    ref.afterClosed().subscribe(res => {
      if (res) {
        this.stockService.save(res).subscribe(() => {
          this.notify.showSuccess('Item atualizado!');
          this.loadStockItems();
        });
      }
    });
  }

  onMergeStock() {
    const ref = this.dialog.open(MergeStockDialogComponent, {
      data: { items: this.stockItems() },
      width: '100%',
      maxWidth: '450px'
    });

    ref.afterClosed().subscribe(res => {
      if (res && res.sourceId && res.targetId) {
        this.stockService.mergeItems(res.sourceId, res.targetId).subscribe({
          next: () => {
            this.notify.showSuccess('Itens mesclados com sucesso!');
            this.loadStockItems();
          },
          error: (err) => this.notify.showError('Erro ao mesclar: ' + err.message)
        });
      }
    });
  }

  deleteStockItem(item: StockItem) {
    this.stockService.softDelete(item.id).subscribe(() => {
      this.notify.showSuccess('Item removido!');
      this.loadStockItems();
    });
  }

  restoreStockItem(item: StockItem) {
    this.stockService.restore(item.id).subscribe(() => {
      this.notify.showSuccess('Item restaurado!');
      this.loadStockItems();
    });
  }

  // --- GESTÃO DE OPÇÕES (CATEGORIAS/UNIDADES) ---

  addOption(config: ModuleConfig, field: DynamicField, existingOption?: any) {
    const dialogRef = this.dialog.open(OptionFormDialogComponent, {
      data: {
        label: field.label,
        showMeta: config.id === 'finance' && field.key === 'category',
        value: existingOption,
        edit: !!existingOption
      },
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res && res.label) {
        const sanitized = res.label.trim().toUpperCase();
        if (!field.options) field.options = [];

        const existingIndex = field.options.findIndex(o => o.label === sanitized);
        
        if (existingIndex >= 0 && !existingOption) {
          const found = field.options[existingIndex];
          if (found.deleted) {
            found.deleted = false;
            found.meta = res.meta;
            this.saveAndReload(config, 'Opção restaurada!');
          } else {
            this.notify.showWarning('Esta opção já existe.');
          }
        } else if (existingOption) {
          existingOption.label = sanitized;
          existingOption.meta = res.meta;
          this.saveAndReload(config, 'Opção atualizada!');
        } else {
          field.options.push({ label: sanitized, deleted: false, meta: res.meta });
          this.saveAndReload(config, 'Opção adicionada!');
        }
      }
    });
  }

  removeOption(config: ModuleConfig, field: DynamicField, index: number) {
    if (confirm('Deseja mover esta opção para a lixeira?')) {
      const option = field.options![index];
      option.deleted = true;
      this.saveAndReload(config, 'Opção movida para a lixeira.');
    }
  }

  restoreOption(config: ModuleConfig, option: any) {
    option.deleted = false;
    this.saveAndReload(config, 'Opção restaurada!');
  }

  // Wrappers para o GenericList
  removeOptionGeneric(option: any, config: ModuleConfig, field: DynamicField) {
    option.deleted = true;
    this.saveAndReload(config, 'Tipo de lançamento movido para a lixeira.');
  }

  restoreOptionGeneric(option: any, config: ModuleConfig, field: DynamicField) {
    option.deleted = false;
    this.saveAndReload(config, 'Tipo de lançamento restaurado!');
  }

  private saveAndReload(config: ModuleConfig, message: string) {
    this.configService.saveConfig(config).subscribe(() => {
      this.notify.showSuccess(message);
      this.loadConfigs();
    });
  }

  // Helpers de Template
  toggleOptionsTrash(fieldKey: string) {
    this.showOptionsTrash.update(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  }

  isTrashVisible(fieldKey: string): boolean {
    return !!this.showOptionsTrash()[fieldKey];
  }

  getActiveOptions(field: DynamicField) {
    return field.options?.filter(o => !o.deleted) || [];
  }

  getDeletedOptions(field: DynamicField) {
    return field.options?.filter(o => o.deleted) || [];
  }

  // --- GESTÃO DE CAMPOS ---

  addField(moduleId: string) {
    this.notify.showInfo('Funcionalidade de adicionar campo em breve!');
  }

  deleteField(config: ModuleConfig, field: DynamicField) {
    if (field.isSystem) {
      this.notify.showError('Campos do sistema não podem ser removidos.');
      return;
    }
    
    if (confirm(`Remover o campo "${field.label}"?`)) {
      config.fields = config.fields.filter(f => f.key !== field.key);
      this.configService.saveConfig(config).subscribe(() => {
        this.notify.showSuccess('Campo removido!');
        this.loadConfigs();
      });
    }
  }
}
