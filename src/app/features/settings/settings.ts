import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from '../../core/services/config.service';
import { ModuleConfig, DynamicField } from '../../core/models/system-config.model';
import { NotificationService } from '../../core/services/notification.service';

import { StockService } from '../../core/services/stock.service';
import { MembersService } from '../../core/services/members.service';
import { StockItem } from '../../core/models/stock-item.model';
import { Member } from '../../core/models/member.model';
import { StockFormComponent } from '../stock/stock-form/stock-form';
import { MergeStockDialogComponent } from '../stock/merge-stock-dialog/merge-stock-dialog';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';
import { OptionFormDialogComponent } from './option-form-dialog/option-form-dialog';
import { FieldFormDialogComponent } from './field-form-dialog/field-form-dialog';
import { PermissionConfig } from '../../core/models/system-config.model';

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
    MatExpansionModule,
    MatTooltipModule,
    MatDividerModule,
    MatFormFieldModule,
    MatSelectModule,
    GenericListComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  private configService = inject(ConfigService);
  private stockService = inject(StockService);
  private membersService = inject(MembersService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  stockConfig = signal<ModuleConfig | null>(null);
  financeConfig = signal<ModuleConfig | null>(null);
  membersConfig = signal<ModuleConfig | null>(null);
  stockItems = signal<StockItem[]>([]);
  members = signal<Member[]>([]);
  
  loading = signal(true);
  mainTabIndex = 0;
  showOptionsTrash = signal<{ [key: string]: boolean }>({});

  // --- PERMISSÕES ---
  rolesList = signal<string[]>([]);
  selectedRole = signal<string>('');
  rolePermission = signal<PermissionConfig | null>(null);
  modulesList = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'members', label: 'Membros' },
    { id: 'finance', label: 'Financeiro' },
    { id: 'stock', label: 'Estoque' },
    { id: 'notices', label: 'Avisos' },
    { id: 'settings', label: 'Configurações' }
  ];

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

  memberRoleColumns: ColumnDef[] = [
    { def: 'label', label: 'Função / Cargo' }
  ];

  ngOnInit() {
    this.loadConfigs(true);
    this.loadStockItems();
    this.loadMembers();
  }

  loadStockItems() {
    this.stockService.getStock(true).subscribe(items => {
      this.stockItems.set(items.sort((a, b) => a.name.localeCompare(b.name)));
    });
  }

  loadMembers() {
    this.membersService.getMembers(true).subscribe(m => {
      this.members.set(m);
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
    // Carrega Config de Membros
    this.configService.getConfig('members').subscribe({
      next: (conf) => {
        this.membersConfig.set(conf);
        const roleField = conf.fields.find(f => f.key === 'role');
        if (roleField) {
          const roles = roleField.options?.filter(o => !o.deleted).map(o => o.label) || [];
          this.rolesList.set(roles);
          // Se não houver cargo selecionado e a lista tiver itens, seleciona o primeiro
          if (!this.selectedRole() && roles.length > 0) {
            this.selectRole(roles[0]);
          }
        }
      },
      complete: () => this.checkLoading()
    });
  }

  // --- MÉTODOS DE PERMISSÃO ---

  selectRole(role: string) {
    this.selectedRole.set(role);
    this.loading.set(true);
    this.configService.getRolePermission(role).subscribe({
      next: (perm) => {
        this.rolePermission.set(perm);
        this.loading.set(false);
      },
      error: () => {
        this.notify.showError('Erro ao carregar permissões do cargo.');
        this.loading.set(false);
      }
    });
  }

  togglePermission(moduleId: string, action: 'read' | 'write') {
    const perm = this.rolePermission();
    if (!perm) return;

    const currentVal = perm.modules[moduleId][action];
    
    // Regra: Se tirar a leitura, tira a escrita automaticamente
    if (action === 'read' && currentVal === true) {
      perm.modules[moduleId].read = false;
      perm.modules[moduleId].write = false;
    } 
    // Regra: Se dar escrita, dá leitura automaticamente
    else if (action === 'write' && currentVal === false) {
      perm.modules[moduleId].write = true;
      perm.modules[moduleId].read = true;
    } else {
      perm.modules[moduleId][action] = !currentVal;
    }

    // Como é uma mutação direta, forçamos o sinal a notificar a UI
    this.rolePermission.set({ ...perm });
  }

  saveRolePermission() {
    const perm = this.rolePermission();
    if (!perm) return;
    
    this.loading.set(true);
    this.configService.savePermission(perm).subscribe({
      next: () => {
        this.notify.showSuccess(`Permissões do cargo ${perm.target} atualizadas!`);
        this.loading.set(false);
      },
      error: () => {
        this.notify.showError('Erro ao salvar permissões.');
        this.loading.set(false);
      }
    });
  }

  private checkLoading() {
    if (this.stockConfig() && this.financeConfig() && this.membersConfig()) {
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

  removeOption(config: ModuleConfig, field: DynamicField, option: any) {
    // Se for estoque, verifica dependências
    if (config.id === 'stock') {
      const fieldKey = field.key as keyof StockItem;
      const dependentItems = this.stockItems().filter(item => !item.deleted && item[fieldKey] === option.label);

      if (dependentItems.length > 0) {
        const list = dependentItems.slice(0, 3).map(i => i.name);
        const count = dependentItems.length;
        const names = list.join(', ');
        const extra = count > 3 ? ` e mais ${count - 3} itens` : '';

        const msg = `ATENÇÃO: Existem ${count} itens no catálogo que utilizam esta ${field.label}:\n` +
                    `(${names}${extra}).\n\n` +
                    `Eles continuarão existindo, mas ficarão sem uma ${field.label} válida no cadastro.\n` +
                    `Deseja realmente mover "${option.label}" para a lixeira?`;

        if (!confirm(msg)) return;
      } else {
        if (!confirm(`Deseja mover a opção "${option.label}" para a lixeira?`)) return;
      }
    } else if (config.id === 'members') {
      const fieldKey = field.key;
      const dependentMembers = this.members().filter(m => {
        // Verifica no root, address, rituals, consecrations ou customFields
        const val = (m as any)[fieldKey] || 
                    (m.address as any)?.[fieldKey] || 
                    (m.rituals as any)?.[fieldKey] || 
                    (m.consecrations as any)?.[fieldKey] || 
                    (m.customFields as any)?.[fieldKey];
        return val === option.label;
      });

      if (dependentMembers.length > 0) {
        const count = dependentMembers.length;
        const msg = `NÃO É POSSÍVEL EXCLUIR: Existem ${count} membros utilizando a opção "${option.label}" no campo "${field.label}".\n\n` +
                    `Para excluir esta opção, você deve primeiro alterar o cadastro desses membros.`;
        alert(msg);
        return;
      }

      if (!confirm(`Deseja mover a opção "${option.label}" para a lixeira?`)) return;
    } else {
      if (!confirm(`Deseja mover a opção "${option.label}" para a lixeira?`)) return;
    }

    option.deleted = true;
    this.saveAndReload(config, 'Opção movida para a lixeira.');
  }

  restoreOption(config: ModuleConfig, option: any) {
    option.deleted = false;
    this.saveAndReload(config, 'Opção restaurada!');
  }

  // Wrappers para o GenericList
  removeOptionGeneric(option: any, config: ModuleConfig, field: DynamicField) {
    if (confirm(`Deseja mover o tipo de lançamento "${option.label}" para a lixeira?`)) {
      option.deleted = true;
      this.saveAndReload(config, 'Tipo de lançamento movido para a lixeira.');
    }
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

  // Helpers para Agrupamento de Seções de Campos
  getSections(config: ModuleConfig | null): string[] {
    if (!config) return [];
    const sections = config.fields
      .filter(f => !f.deleted)
      .map(f => f.section || 'Geral');
    return [...new Set(sections)].sort((a, b) => {
      // Prioriza seções conhecidas do formulário
      const order = ['Dados Pessoais', 'Endereço', 'Vida Espiritual', 'Consagrações (Orixás)', 'Informações Adicionais'];
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  getFieldsBySection(config: ModuleConfig | null, section: string): DynamicField[] {
    if (!config) return [];
    return config.fields.filter(f => !f.deleted && (f.section || 'Geral') === section)
      .sort((a, b) => a.order - b.order);
  }

  getDeletedFields(config: ModuleConfig | null): DynamicField[] {
    if (!config) return [];
    return config.fields.filter(f => f.deleted);
  }

  // --- GESTÃO DE CAMPOS ---

  addField(moduleId: string) {
    let config: ModuleConfig | null = null;
    if (moduleId === 'stock') config = this.stockConfig();
    if (moduleId === 'finance') config = this.financeConfig();
    if (moduleId === 'members') config = this.membersConfig();

    if (!config) return;

    const dialogRef = this.dialog.open(FieldFormDialogComponent, {
      width: '450px',
      data: { edit: false }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res && config) {
        // Verifica se a key já existe
        if (config.fields.some(f => f.key === res.key)) {
          this.notify.showWarning('Já existe um campo com este nome.');
          return;
        }

        const newField: DynamicField = {
          ...res,
          order: config.fields.length + 1,
          isSystem: false,
          deleted: false
        };

        if (res.type === 'select') {
          newField.options = [];
        }

        config.fields.push(newField);
        this.saveAndReload(config, 'Campo personalizado adicionado!');
      }
    });
  }

  editField(config: ModuleConfig, field: DynamicField) {
    // Permite editar qualquer campo, incluindo sistema, para mudar visibilidade no perfil ou opções
    // Só bloqueamos se tentar excluir o fundamental 'role', mas aqui é edição

    let isUsed = false;
    if (config.id === 'members') {
      const fieldKey = field.key;
      isUsed = this.members().some(m => {
        const val = (m as any)[fieldKey] || 
                    (m.address as any)?.[fieldKey] || 
                    (m.rituals as any)?.[fieldKey] || 
                    (m.consecrations as any)?.[fieldKey] || 
                    (m.customFields as any)?.[fieldKey];
        return val !== null && val !== undefined && val !== '' && val !== false;
      });
    }

    const dialogRef = this.dialog.open(FieldFormDialogComponent, {
      width: '500px',
      data: { 
        edit: true, 
        value: field,
        disableType: isUsed
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        field.label = res.label;
        field.type = res.type;
        field.required = res.required;
        field.section = res.section;
        field.showInProfile = res.showInProfile;
        
        if (field.type === 'select') {
          field.options = res.options;
        } else {
          delete field.options;
        }
        
        this.saveAndReload(config, 'Campo atualizado!');
      }
    });
  }

  deleteField(config: ModuleConfig, field: DynamicField) {
    if (field.isSystem && config.id === 'members' && field.key === 'role') {
      this.notify.showError('O campo Função/Cargo é obrigatório para o sistema.');
      return;
    }

    if (config.id === 'members') {
      const fieldKey = field.key;
      const dependentMembers = this.members().filter(m => {
        const val = (m as any)[fieldKey] || 
                    (m.address as any)?.[fieldKey] || 
                    (m.rituals as any)?.[fieldKey] || 
                    (m.consecrations as any)?.[fieldKey] || 
                    (m.customFields as any)?.[fieldKey];
        return val !== null && val !== undefined && val !== '' && val !== false;
      });

      if (dependentMembers.length > 0) {
        const count = dependentMembers.length;
        const msg = `NÃO É POSSÍVEL EXCLUIR O CAMPO: Existem ${count} membros com o campo "${field.label}" preenchido.\n\n` +
                    `Para excluir este campo, você deve primeiro limpar essa informação no cadastro desses membros.`;
        alert(msg);
        return;
      }
    }
    
    if (confirm(`Deseja mover o campo "${field.label}" para a lixeira?`)) {
      field.deleted = true;
      this.saveAndReload(config, 'Campo movido para a lixeira.');
    }
  }

  restoreField(config: ModuleConfig, field: DynamicField) {
    field.deleted = false;
    this.saveAndReload(config, 'Campo restaurado!');
  }
}
