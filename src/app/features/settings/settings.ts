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
