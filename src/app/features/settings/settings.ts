import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ConfigService } from '../../core/services/config.service';
import { ModuleConfig, DynamicField, FieldOption } from '../../core/models/system-config.model';
import { NotificationService } from '../../core/services/notification.service';
import { LoggerService } from '../../core/services/logger.service';

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
    FormsModule,
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
    MatInputModule,
    MatSliderModule,
    MatAutocompleteModule,
    GenericListComponent
  ],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './settings.scss'
})
export class SettingsComponent implements OnInit {
  private configService = inject(ConfigService);
  private stockService = inject(StockService);
  private membersService = inject(MembersService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private logger = inject(LoggerService);

  stockConfig = signal<ModuleConfig | null>(null);
  financeConfig = signal<ModuleConfig | null>(null);
  membersConfig = signal<ModuleConfig | null>(null);
  stockItems = signal<StockItem[]>([]);
  members = signal<Member[]>([]);
  
  loading = signal(true);
  mainTabIndex = 0;
  showOptionsTrash = signal<{ [key: string]: boolean }>({});

  rolesList = signal<string[]>([]);
  selectedRole = signal<string>('');
  rolePermission = signal<PermissionConfig | null>(null);
  allRolePermissions = signal<PermissionConfig[]>([]);

  userSearchQuery = '';
  filteredUsersForPerm: Member[] = [];
  selectedUserForPerm = signal<Member | null>(null);
  userPermission = signal<PermissionConfig | null>(null);

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
    this.membersService.getMembers().subscribe(m => {
      this.members.set(m as Member[]);
    });
  }

  loadConfigs(initial = false) {
    if (initial) this.loading.set(true);
    
    this.configService.getConfig('stock').subscribe({
      next: (conf) => this.stockConfig.set(conf),
      complete: () => this.checkLoading()
    });
    this.configService.getConfig('finance').subscribe({
      next: (conf) => this.financeConfig.set(conf),
      complete: () => this.checkLoading()
    });
    this.configService.getConfig('members').subscribe({
      next: (conf) => {
        this.membersConfig.set(conf);
        const roleField = conf.fields.find(f => f.key === 'role');
        if (roleField) {
          const roles = roleField.options?.filter(o => !o.deleted).map(o => o.label).sort((a, b) => a.localeCompare(b)) || [];
          this.rolesList.set(roles);
          if (!this.selectedRole() && roles.length > 0) {
            this.selectRole(roles[0]);
          }
          this.configService.getAllRolePermissions(roles).subscribe(perms => {
            this.allRolePermissions.set(perms);
          });
        }
      },
      complete: () => this.checkLoading()
    });
  }

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

    if (!perm.modules) perm.modules = {};
    if (!perm.modules[moduleId]) perm.modules[moduleId] = {};

    const currentVal = perm.modules[moduleId]![action];
    
    if (action === 'read' && currentVal === true) {
      perm.modules![moduleId]!.read = false;
      perm.modules![moduleId]!.write = false;
    } 
    else if (action === 'write' && currentVal === false) {
      perm.modules![moduleId]!.write = true;
      perm.modules![moduleId]!.read = true;
    } else {
      perm.modules![moduleId]![action] = !currentVal;
    }

    this.rolePermission.set({ ...perm });
  }

  saveRolePermission() {
    const perm = this.rolePermission();
    if (!perm) return;
    
    this.loading.set(true);
    this.configService.savePermission(perm).subscribe({
      next: () => {
        this.notify.showSuccess(`Permissões do cargo ${perm.target} atualizadas!`);
        this.configService.getAllRolePermissions(this.rolesList()).subscribe(perms => {
          this.allRolePermissions.set(perms);
        });
        this.loading.set(false);
      },
      error: () => {
        this.notify.showError('Erro ao salvar permissões.');
        this.loading.set(false);
      }
    });
  }

  searchUserForPerm(query: string) {
    this.userSearchQuery = query;
    if (!query || query.length < 2) {
      this.filteredUsersForPerm = [];
      return;
    }
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    this.filteredUsersForPerm = this.members()
      .filter(m => !m.deleted)
      .filter(m => {
        const name = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const email = (m.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 5);
  }

  selectUserForPerm(member: Member) {
    this.selectedUserForPerm.set(member);
    this.filteredUsersForPerm = [];
    this.userSearchQuery = member.name;
    this.configService.getUserPermission(member.email).subscribe({
      next: (perm) => this.userPermission.set(perm),
      error: () => this.notify.showError('Erro ao carregar permissões do usuário.')
    });
  }

  toggleUserPermission(moduleId: string, action: 'read' | 'write') {
    const perm = this.userPermission();
    if (!perm) return;
    
    if (!perm.modules) perm.modules = {};
    if (!perm.modules[moduleId]) perm.modules[moduleId] = {};
    
    const currentEffective = this.getUserPermValue(moduleId, action);
    const newValue = !currentEffective;
    
    if (action === 'read' && newValue === true) {
      perm.modules![moduleId]!.read = true;
    } else if (action === 'read' && newValue === false) {
      perm.modules![moduleId]!.read = false;
      perm.modules![moduleId]!.write = false; // perde write se perder read
    } else if (action === 'write' && newValue === true) {
      perm.modules![moduleId]!.write = true;
      perm.modules![moduleId]!.read = true; // ganha read se ganhar write
    } else if (action === 'write' && newValue === false) {
      perm.modules![moduleId]!.write = false;
    }
    
    this.userPermission.set({ ...perm });
  }

  saveUserPermission() {
    const perm = this.userPermission();
    if (!perm) return;
    this.configService.saveUserPermission(perm).subscribe({
      next: () => this.notify.showSuccess(`Permissões de ${perm.target} atualizadas!`),
      error: () => this.notify.showError('Erro ao salvar permissões do usuário.')
    });
  }

  clearUserPerm() {
    this.selectedUserForPerm.set(null);
    this.userPermission.set(null);
    this.userSearchQuery = '';
    this.filteredUsersForPerm = [];
  }

  getHierarchyLabel(level: number): string {
    if (level >= 10) return 'Admin Total';
    if (level >= 7) return 'Alta autoridade';
    if (level >= 4) return 'Autoridade média';
    return 'Acesso básico';
  }

  increaseHierarchy() {
    const perm = this.rolePermission();
    if (!perm || perm.hierarchyLevel >= 10) return;
    perm.hierarchyLevel = perm.hierarchyLevel + 1;
    this.rolePermission.set({ ...perm });
  }

  decreaseHierarchy() {
    const perm = this.rolePermission();
    if (!perm || perm.hierarchyLevel <= 1) return;
    perm.hierarchyLevel = perm.hierarchyLevel - 1;
    this.rolePermission.set({ ...perm });
  }

  getRolesForMatrix(): PermissionConfig[] {
    return [...this.allRolePermissions()].sort((a, b) => b.hierarchyLevel - a.hierarchyLevel);
  }

  getMatrixValue(perm: PermissionConfig, moduleId: string, action: 'read' | 'write'): boolean {
    if (perm.hierarchyLevel >= 10) return true;
    return perm.modules?.[moduleId]?.[action] ?? false;
  }

  getUserPermValue(moduleId: string, action: 'read' | 'write'): boolean {
    const perm = this.userPermission();
    if (!perm) return false;
    
    // 1. Tenta a sobrescrita do usuário
    if (perm.modules && perm.modules[moduleId] && perm.modules[moduleId]![action] !== undefined) {
      return perm.modules[moduleId]![action] === true;
    }
    
    // 2. Fallback para a permissão do cargo
    const member = this.selectedUserForPerm();
    if (!member || !member.role) return false;
    
    const roleId = `role_${member.role.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, "")}`;
    const rolePerm = this.allRolePermissions().find(rp => rp.id === roleId);
    if (!rolePerm) return false;
    
    if (rolePerm.hierarchyLevel >= 10) return true;
    return rolePerm.modules?.[moduleId]?.[action] === true;
  }

  private checkLoading() {
    if (this.stockConfig() && this.financeConfig() && this.membersConfig()) {
      this.loading.set(false);
    }
  }

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
          error: (err: unknown) => {
            this.logger.error('Erro ao mesclar itens', err);
            this.notify.showError('Erro ao mesclar: ' + (err instanceof Error ? err.message : ''));
          }
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

  addOption(config: ModuleConfig, field: DynamicField, existingOption?: FieldOption) {
    let costCenters: string[] = [];
    let paymentMethods: string[] = [];
    let bankAccounts: string[] = [];

    if (config.id === 'finance' && field.key === 'category') {
       costCenters = config.fields.find(f => f.key === 'costCenter')?.options?.filter(o => !o.deleted).map(o => o.label) || [];
       paymentMethods = config.fields.find(f => f.key === 'paymentMethod')?.options?.filter(o => !o.deleted).map(o => o.label) || [];
       bankAccounts = config.fields.find(f => f.key === 'bankAccount')?.options?.filter(o => !o.deleted).map(o => o.label) || [];
    }

    const dialogRef = this.dialog.open(OptionFormDialogComponent, {
      data: {
        label: field.label,
        showMeta: config.id === 'finance' && field.key === 'category',
        showFeeConfig: config.id === 'finance' && (field.key === 'paymentMethod' || field.key === 'bankAccount'),
        costCenters,
        paymentMethods,
        bankAccounts,
        value: existingOption,
        edit: !!existingOption
      },
      width: '450px'
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
            found.requiresMember = res.requiresMember;
            found.costCenter = res.costCenter;
            found.defaultPaymentMethod = res.defaultPaymentMethod;
            found.defaultBankAccount = res.defaultBankAccount;
            found.feeType = res.feeType;
            found.feeValue = res.feeValue;
            this.saveAndReload(config, 'Opção restaurada!');
          } else {
            this.notify.showWarning('Esta opção já existe.');
          }
        } else if (existingOption) {
          existingOption.label = sanitized;
          existingOption.meta = res.meta;
          existingOption.requiresMember = res.requiresMember;
          existingOption.costCenter = res.costCenter;
          existingOption.defaultPaymentMethod = res.defaultPaymentMethod;
          existingOption.defaultBankAccount = res.defaultBankAccount;
          existingOption.feeType = res.feeType;
          existingOption.feeValue = res.feeValue;
          this.saveAndReload(config, 'Opção atualizada!');
        } else {
          field.options.push({ 
            label: sanitized, 
            deleted: false, 
            meta: res.meta, 
            requiresMember: res.requiresMember,
            costCenter: res.costCenter,
            defaultPaymentMethod: res.defaultPaymentMethod,
            defaultBankAccount: res.defaultBankAccount,
            feeType: res.feeType,
            feeValue: res.feeValue
          });
          this.saveAndReload(config, 'Opção adicionada!');
        }

      }
    });
  }

  private getMemberFieldValue(m: Member, fieldKey: string): unknown {
    return (m as unknown as Record<string, unknown>)[fieldKey] ?? 
           (m.address as unknown as Record<string, unknown>)?.[fieldKey] ?? 
           (m.rituals as unknown as Record<string, unknown>)?.[fieldKey] ?? 
           (m.consecrations as unknown as Record<string, unknown>)?.[fieldKey] ?? 
           (m.customFields as unknown as Record<string, unknown>)?.[fieldKey];
  }

  removeOption(config: ModuleConfig, field: DynamicField, option: FieldOption) {
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
        const val = this.getMemberFieldValue(m, fieldKey);
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

  restoreOption(config: ModuleConfig, option: FieldOption) {
    option.deleted = false;
    this.saveAndReload(config, 'Opção restaurada!');
  }

  removeOptionGeneric(option: FieldOption, config: ModuleConfig, field: DynamicField) {
    if (confirm(`Deseja mover o tipo de lançamento "${option.label}" para a lixeira?`)) {
      option.deleted = true;
      this.saveAndReload(config, 'Tipo de lançamento movido para a lixeira.');
    }
  }

  restoreOptionGeneric(option: FieldOption, config: ModuleConfig, field: DynamicField) {
    option.deleted = false;
    this.saveAndReload(config, 'Tipo de lançamento restaurado!');
  }

  private saveAndReload(config: ModuleConfig, message: string) {
    this.configService.saveConfig(config).subscribe(() => {
      this.notify.showSuccess(message);
      this.loadConfigs();
    });
  }

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
    return field.options?.filter(o => !o.deleted).sort((a, b) => a.label.localeCompare(b.label)) || [];
  }

  getDeletedOptions(field: DynamicField) {
    return field.options?.filter(o => o.deleted).sort((a, b) => a.label.localeCompare(b.label)) || [];
  }

  getSections(config: ModuleConfig | null): string[] {
    if (!config) return [];
    const sections = config.fields
      .filter(f => !f.deleted)
      .map(f => f.section || 'Geral');
    return [...new Set(sections)].sort((a, b) => {
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
    let isUsed = false;
    if (config.id === 'members') {
      const fieldKey = field.key;
      isUsed = this.members().some(m => {
        const val = this.getMemberFieldValue(m, fieldKey);
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
        const val = this.getMemberFieldValue(m, fieldKey);
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
