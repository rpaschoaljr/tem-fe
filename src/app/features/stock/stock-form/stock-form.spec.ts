import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockFormComponent } from './stock-form';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfigService } from '../../../core/services/config.service';
import { StockItem } from '../../../core/models/stock-item.model';
import { ModuleConfig } from '../../../core/models/system-config.model';
import { of } from 'rxjs';

describe('StockFormComponent', () => {
  let component: StockFormComponent;
  let fixture: ComponentFixture<StockFormComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<StockFormComponent>>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;

  const mockConfig: ModuleConfig = {
    id: 'stock',
    updatedAt: new Date(),
    fields: [
      {
        key: 'category',
        label: 'Categoria',
        type: 'select',
        required: true,
        order: 1,
        options: [
          { label: 'ALIMENTOS', deleted: false },
          { label: 'BEBIDAS', deleted: false },
          { label: 'OUTROS', deleted: true }
        ]
      },
      {
        key: 'unit',
        label: 'Unidade',
        type: 'select',
        required: true,
        order: 2,
        options: [
          { label: 'UN', deleted: false },
          { label: 'KG', deleted: false },
          { label: 'L', deleted: true }
        ]
      }
    ]
  };

  const mockItem: StockItem = {
    id: '1',
    name: 'Arroz',
    category: 'ALIMENTOS',
    unit: 'KG',
    quantity: 10,
    minStock: 2,
    updatedAt: new Date(),
    deleted: false
  };

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getConfig']);
    configServiceSpy.getConfig.and.returnValue(of(mockConfig));

    await TestBed.configureTestingModule({
      imports: [StockFormComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: ConfigService, useValue: configServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StockFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories excluding deleted ones', () => {
    expect(component.categories().length).toBe(2);
    expect(component.categories()).toContain('ALIMENTOS');
    expect(component.categories()).toContain('BEBIDAS');
  });

  it('should load units excluding deleted ones', () => {
    expect(component.units().length).toBe(2);
    expect(component.units()).toContain('UN');
    expect(component.units()).toContain('KG');
  });

  it('should not submit if form is invalid', () => {
    component.form.patchValue({ name: '' });
    component.onSubmit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should format values on submit correctly', () => {
    component.form.patchValue({
      name: ' feijão  ',
      category: 'ALIMENTOS',
      unit: 'KG',
      minStock: 1
    });

    component.onSubmit();

    expect(dialogRefSpy.close).toHaveBeenCalled();
    const result = dialogRefSpy.close.calls.first().args[0] as Partial<StockItem>;
    expect(result.name).toBe('FEIJÃO');
    expect(result.category).toBe('ALIMENTOS');
  });

  it('should submit form correctly when optional fields are empty', () => {
    component.form.patchValue({
      name: 'ÁGUA',
      category: 'BEBIDAS',
      unit: 'UN',
      minStock: null
    });

    component.onSubmit();

    const result = dialogRefSpy.close.calls.first().args[0] as Partial<StockItem>;
    expect(result.minStock).toBeUndefined();
  });

  it('should handle undefined values gracefully during map', () => {
    component.form.patchValue({
      name: null as any,
      category: null as any,
      unit: null as any
    });

    // bypass validation for testing defaults
    Object.defineProperty(component.form, 'invalid', { get: () => false });
    
    component.onSubmit();

    const result = dialogRefSpy.close.calls.first().args[0] as Partial<StockItem>;
    expect(result.name).toBe('');
    expect(result.category).toBe('');
    expect(result.unit).toBe('UN');
  });

  it('should close on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});

describe('StockFormComponent - Edit Mode', () => {
  let component: StockFormComponent;
  let fixture: ComponentFixture<StockFormComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<StockFormComponent>>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;

  const mockConfig: ModuleConfig = {
    id: 'stock',
    updatedAt: new Date(),
    fields: []
  };

  const mockItem: StockItem = {
    id: '1',
    name: 'Arroz',
    category: 'ALIMENTOS',
    unit: 'KG',
    quantity: 10,
    minStock: 2,
    updatedAt: new Date(),
    deleted: false
  };

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getConfig']);
    configServiceSpy.getConfig.and.returnValue(of(mockConfig));

    await TestBed.configureTestingModule({
      imports: [StockFormComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: mockItem },
        { provide: ConfigService, useValue: configServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StockFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should identify as edit mode', () => {
    expect(component.isEdit).toBeTrue();
  });

  it('should initialize form with data', () => {
    expect(component.form.get('name')?.value).toBe('Arroz');
    expect(component.form.get('category')?.value).toBe('ALIMENTOS');
  });

  it('should submit edit', () => {
    component.onSubmit();
    const result = dialogRefSpy.close.calls.first().args[0] as Partial<StockItem>;
    expect(result.id).toBe('1');
    expect(result.name).toBe('ARROZ');
  });
});
