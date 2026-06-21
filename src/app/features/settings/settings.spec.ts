import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SettingsComponent } from './settings';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfigService } from '../../core/services/config.service';
import { StockService } from '../../core/services/stock.service';
import { MembersService } from '../../core/services/members.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoggerService } from '../../core/services/logger.service';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { ModuleConfig, PermissionConfig } from '../../core/models/system-config.model';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockConfig: jasmine.SpyObj<ConfigService>;
  let mockStock: jasmine.SpyObj<StockService>;
  let mockMembers: jasmine.SpyObj<MembersService>;
  let mockNotify: jasmine.SpyObj<NotificationService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  const mockStockConfig: ModuleConfig = {
    id: 'stock',
    fields: [
      { key: 'category', label: 'Cat', type: 'select', order: 1, options: [{ label: 'CAT1', deleted: false }, { label: 'CAT_DEL', deleted: true }], required: true }
    ],
    updatedAt: new Date()
  };

  const mockFinanceConfig: ModuleConfig = {
    id: 'finance',
    fields: [
      { key: 'category', label: 'Finance Cat', type: 'select', order: 1, options: [{ label: 'DOAÇÃO', deleted: false }], required: true }
    ],
    updatedAt: new Date()
  };

  const mockMembersConfig: ModuleConfig = {
    id: 'members',
    fields: [
      { key: 'role', label: 'Role', type: 'select', order: 1, isSystem: true, options: [{ label: 'ADMIN', deleted: false }], required: true, section: 'Dados Pessoais' },
      { key: 'name', label: 'Name', type: 'text', order: 2, required: true, section: 'Dados Pessoais', deleted: false },
      { key: 'del_field', label: 'Deleted', type: 'text', order: 3, required: false, deleted: true }
    ],
    updatedAt: new Date()
  };

  const mockRolePerm: PermissionConfig = {
    id: 'role_ADMIN',
    type: 'role',
    target: 'ADMIN',
    hierarchyLevel: 5,
    modules: {
      stock: { read: true, write: false }
    },
    updatedAt: new Date()
  };

  const mockUserPerm: PermissionConfig = {
    id: 'test@test.com',
    type: 'user',
    target: 'test@test.com',
    hierarchyLevel: 0,
    modules: {
      stock: { read: false, write: false }
    },
    updatedAt: new Date()
  };

  beforeEach(async () => {
    mockConfig = jasmine.createSpyObj('ConfigService', [
      'getConfig', 'getRolePermission', 'getAllRolePermissions', 'savePermission', 
      'getUserPermission', 'saveUserPermission', 'saveConfig'
    ]);
    mockStock = jasmine.createSpyObj('StockService', ['getStock', 'save', 'mergeItems', 'softDelete', 'restore']);
    mockMembers = jasmine.createSpyObj('MembersService', ['getMembers']);
    mockNotify = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError', 'showWarning']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['error']);
    mockDialog = jasmine.createSpyObj('MatDialog', ['open'], { openDialogs: [] });

    mockConfig.getConfig.and.callFake((id: string) => {
      if (id === 'stock') return of(mockStockConfig);
      if (id === 'finance') return of(mockFinanceConfig);
      if (id === 'members') return of(mockMembersConfig);
      return of({ id, fields: [], updatedAt: new Date() });
    });
    mockConfig.getAllRolePermissions.and.returnValue(of([mockRolePerm]));
    mockStock.getStock.and.returnValue(of([{ id: '1', name: 'Item1', category: 'CAT1', quantity: 10, unit: 'UN', deleted: false, updatedAt: new Date() }]));
    mockMembers.getMembers.and.returnValue(of([{ id: '1', name: 'John Doe', email: 'test@test.com', role: 'ADMIN', deleted: false } as any]));

    await TestBed.configureTestingModule({
      imports: [SettingsComponent, NoopAnimationsModule],
      providers: [
        { provide: ConfigService, useValue: mockConfig },
        { provide: StockService, useValue: mockStock },
        { provide: MembersService, useValue: mockMembers },
        { provide: NotificationService, useValue: mockNotify },
        { provide: LoggerService, useValue: mockLogger },
        { provide: MatDialog, useValue: mockDialog }
      ]
    })
    .overrideProvider(MatDialog, { useValue: mockDialog })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load data', () => {
    expect(component).toBeTruthy();
    expect(component.stockConfig()?.id).toBe('stock');
    expect(component.financeConfig()?.id).toBe('finance');
    expect(component.membersConfig()?.id).toBe('members');
    expect(component.rolesList()).toContain('ADMIN');
    expect(component.stockItems().length).toBe(1);
    expect(component.members().length).toBe(1);
  });

  describe('Role Permissions', () => {
    it('should select role and load permissions', () => {
      mockConfig.getRolePermission.and.returnValue(of(mockRolePerm));
      component.selectRole('ADMIN');
      expect(mockConfig.getRolePermission).toHaveBeenCalledWith('ADMIN');
      expect(component.rolePermission()).toEqual(mockRolePerm);
    });

    it('should toggle permission logic (read->false makes write false)', () => {
      component.rolePermission.set({ ...mockRolePerm, modules: { stock: { read: true, write: true } } });
      component.togglePermission('stock', 'read');
      expect(component.rolePermission()?.modules?.['stock']?.read).toBeFalse();
      expect(component.rolePermission()?.modules?.['stock']?.write).toBeFalse();
    });

    it('should toggle permission logic (write->true makes read true)', () => {
      component.rolePermission.set({ ...mockRolePerm, modules: { stock: { read: false, write: false } } });
      component.togglePermission('stock', 'write');
      expect(component.rolePermission()?.modules?.['stock']?.write).toBeTrue();
      expect(component.rolePermission()?.modules?.['stock']?.read).toBeTrue();
    });

    it('should save role permission', () => {
      mockConfig.savePermission.and.returnValue(of(undefined));
      component.rolePermission.set(mockRolePerm);
      component.saveRolePermission();
      expect(mockConfig.savePermission).toHaveBeenCalled();
      expect(mockNotify.showSuccess).toHaveBeenCalled();
    });
  });

  describe('User Permissions', () => {
    it('should search user', () => {
      component.searchUserForPerm('John');
      expect(component.filteredUsersForPerm.length).toBe(1);
      expect(component.filteredUsersForPerm[0].name).toBe('John Doe');
      
      component.searchUserForPerm('X');
      expect(component.filteredUsersForPerm.length).toBe(0);
    });

    it('should select user and load permissions', () => {
      mockConfig.getUserPermission.and.returnValue(of(mockUserPerm));
      component.selectUserForPerm(component.members()[0]);
      expect(component.selectedUserForPerm()?.name).toBe('John Doe');
      expect(component.userPermission()).toEqual(mockUserPerm);
    });

    it('should toggle user permission logic (write->false makes write false)', () => {
      component.selectedUserForPerm.set(component.members()[0]);
      component.userPermission.set({ ...mockUserPerm, modules: { stock: { read: true, write: true } } });
      component.toggleUserPermission('stock', 'write');
      expect(component.userPermission()?.modules?.['stock']?.write).toBeFalse();
    });

    it('should toggle user permission logic (read->true makes read true)', () => {
      component.selectedUserForPerm.set(component.members()[0]);
      component.userPermission.set({ ...mockUserPerm, modules: { stock: { read: false, write: false } } });
      component.toggleUserPermission('stock', 'read');
      expect(component.userPermission()?.modules?.['stock']?.read).toBeTrue();
    });

    it('should save user permission', () => {
      mockConfig.saveUserPermission.and.returnValue(of(undefined));
      component.userPermission.set(mockUserPerm);
      component.saveUserPermission();
      expect(mockConfig.saveUserPermission).toHaveBeenCalled();
      expect(mockNotify.showSuccess).toHaveBeenCalled();
    });

    it('should clear user perm', () => {
      mockConfig.getUserPermission.and.returnValue(of(mockUserPerm));
      component.selectUserForPerm(component.members()[0]);
      component.clearUserPerm();
      expect(component.selectedUserForPerm()).toBeNull();
      expect(component.userPermission()).toBeNull();
    });
  });

  describe('Hierarchy', () => {
    it('should increase hierarchy', () => {
      component.rolePermission.set({ ...mockRolePerm, hierarchyLevel: 5 });
      component.increaseHierarchy();
      expect(component.rolePermission()?.hierarchyLevel).toBe(6);
    });

    it('should decrease hierarchy', () => {
      component.rolePermission.set({ ...mockRolePerm, hierarchyLevel: 5 });
      component.decreaseHierarchy();
      expect(component.rolePermission()?.hierarchyLevel).toBe(4);
    });

    it('should return label', () => {
      expect(component.getHierarchyLabel(10)).toBe('Admin Total');
      expect(component.getHierarchyLabel(8)).toBe('Alta autoridade');
      expect(component.getHierarchyLabel(5)).toBe('Autoridade média');
      expect(component.getHierarchyLabel(2)).toBe('Acesso básico');
    });

    it('should get matrix value', () => {
      expect(component.getMatrixValue({ ...mockRolePerm, hierarchyLevel: 10 }, 'stock', 'read')).toBeTrue();
      expect(component.getMatrixValue(mockRolePerm, 'stock', 'read')).toBeTrue();
      expect(component.getMatrixValue(mockRolePerm, 'stock', 'write')).toBeFalse();
    });
  });

  describe('Stock items', () => {
    it('should open new stock item dialog and save', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ name: 'NewItem' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockStock.save.and.returnValue(of(true));

      component.onNewStockItem();
      tick();
      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockStock.save).toHaveBeenCalled();
    }));

    it('should edit stock item and save', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ id: '1', name: 'Updated' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockStock.save.and.returnValue(of(true));

      component.onEditStockItem({ id: '1', name: 'Item1' } as any);
      tick();
      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockStock.save).toHaveBeenCalled();
    }));

    it('should merge stock items', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ sourceId: '1', targetId: '2' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockStock.mergeItems.and.returnValue(of(undefined));

      component.onMergeStock();
      tick();
      expect(mockStock.mergeItems).toHaveBeenCalledWith('1', '2');
    }));

    it('should soft delete stock item', () => {
      mockStock.softDelete.and.returnValue(of(true));
      component.deleteStockItem({ id: '1' } as any);
      expect(mockStock.softDelete).toHaveBeenCalledWith('1');
    });

    it('should restore stock item', () => {
      mockStock.restore.and.returnValue(of(true));
      component.restoreStockItem({ id: '1' } as any);
      expect(mockStock.restore).toHaveBeenCalledWith('1');
    });
  });

  describe('Options', () => {
    it('should toggle options trash', () => {
      component.toggleOptionsTrash('category');
      expect(component.isTrashVisible('category')).toBeTrue();
    });

    it('should add option', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ label: 'NEW_CAT' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockConfig.saveConfig.and.returnValue(of(undefined));

      component.addOption(mockStockConfig, mockStockConfig.fields[0]);
      tick();
      expect(mockConfig.saveConfig).toHaveBeenCalled();
      expect(mockStockConfig.fields[0].options?.find(o => o.label === 'NEW_CAT')).toBeTruthy();
    }));

    it('should remove option without dependencies', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockConfig.saveConfig.and.returnValue(of(undefined));
      
      const option = mockStockConfig.fields[0].options![0];
      component.removeOption({ id: 'finance', fields: [] } as any, mockStockConfig.fields[0], option);
      tick();
      expect(option.deleted).toBeTrue();
    }));

    it('should restore option', fakeAsync(() => {
      mockConfig.saveConfig.and.returnValue(of(undefined));
      const option = mockStockConfig.fields[0].options![1];
      component.restoreOption(mockStockConfig, option);
      tick();
      expect(option.deleted).toBeFalse();
    }));
  });

  describe('Fields', () => {
    it('should add field', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ key: 'newField', label: 'New', type: 'text' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockConfig.saveConfig.and.returnValue(of(undefined));

      component.addField('stock');
      tick();
      expect(mockConfig.saveConfig).toHaveBeenCalled();
      expect(mockStockConfig.fields.find(f => f.key === 'newField')).toBeTruthy();
    }));

    it('should edit field', fakeAsync(() => {
      const dialogSpy = jasmine.createSpyObj({ afterClosed: of({ label: 'Updated Label', type: 'text' }) });
      mockDialog.open.and.returnValue(dialogSpy);
      mockConfig.saveConfig.and.returnValue(of(undefined));

      const field = mockMembersConfig.fields[1];
      component.editField(mockMembersConfig, field);
      tick();
      expect(field.label).toBe('Updated Label');
      expect(mockConfig.saveConfig).toHaveBeenCalled();
    }));

    it('should delete field', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      mockConfig.saveConfig.and.returnValue(of(undefined));
      
      const field = mockMembersConfig.fields[1]; // Name
      component.members.set([]); // Clear members so dependency check passes
      component.deleteField(mockMembersConfig, field);
      tick();
      expect(field.deleted).toBeTrue();
    }));

    it('should restore field', fakeAsync(() => {
      mockConfig.saveConfig.and.returnValue(of(undefined));
      const field = mockMembersConfig.fields[2];
      component.restoreField(mockMembersConfig, field);
      tick();
      expect(field.deleted).toBeFalse();
    }));
  });
});
