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

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTabsModule, MatIconModule, MatButtonModule, MatTableModule, MatDialogModule],
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

  ngOnInit() {
    this.loadConfigs();
    this.loadStockItems();
  }

  loadStockItems() {
    this.stockService.getStock(true).subscribe(items => {
      this.stockItems.set(items.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }

  loadConfigs() {
    this.loading.set(true);
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
    if (confirm(`Excluir permanentemente "${item.name}"? Isso não pode ser desfeito.`)) {
      this.stockService.softDelete(item.id).subscribe(() => {
        this.notify.showSuccess('Item removido!');
        this.loadStockItems();
      });
    }
  }

  // --- GESTÃO DE OPÇÕES (CATEGORIAS/UNIDADES) ---

  addOption(config: ModuleConfig, field: DynamicField) {
    const newOpt = prompt(`Nova opção para ${field.label}:`);
    if (newOpt && newOpt.trim()) {
      if (!field.options) field.options = [];
      const sanitized = newOpt.trim().toUpperCase();
      
      // Verifica se já existia (mesmo que deletado) para restaurar em vez de criar duplicado
      const existing = field.options.find(o => o.label === sanitized);
      if (existing) {
        if (existing.deleted) {
          existing.deleted = false;
          this.saveAndReload(config, 'Opção restaurada!');
        } else {
          this.notify.showWarning('Esta opção já existe.');
        }
      } else {
        field.options.push({ label: sanitized, deleted: false });
        this.saveAndReload(config, 'Opção adicionada!');
      }
    }
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

  private saveAndReload(config: ModuleConfig, message: string) {
    this.configService.saveConfig(config).subscribe(() => {
      this.notify.showSuccess(message);
      this.loadConfigs();
    });
  }

  // Helpers de Template
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
