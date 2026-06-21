import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockAdjustComponent, AdjustResult } from './stock-adjust';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StockItem } from '../../../core/models/stock-item.model';

describe('StockAdjustComponent', () => {
  let component: StockAdjustComponent;
  let fixture: ComponentFixture<StockAdjustComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<StockAdjustComponent>>;

  const mockItem: StockItem = {
    id: '1',
    name: 'Test Item',
    category: 'TESTE',
    unit: 'UN',
    quantity: 10,
    minStock: 2,
    updatedAt: new Date(),
    deleted: false
  };

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [StockAdjustComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: mockItem }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StockAdjustComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with quantity 1', () => {
    expect(component.form.get('quantity')?.value).toBe(1);
  });

  it('should adjust quantity correctly', () => {
    component.adjust(2);
    expect(component.form.get('quantity')?.value).toBe(3);

    component.adjust(-1);
    expect(component.form.get('quantity')?.value).toBe(2);
  });

  it('should not adjust below 1', () => {
    component.adjust(-5);
    expect(component.form.get('quantity')?.value).toBe(1);
  });

  it('should treat null quantity as 0 when adjusting', () => {
    component.form.patchValue({ quantity: null as any });
    component.adjust(5);
    expect(component.form.get('quantity')?.value).toBe(5);
  });

  it('should not submit if invalid', () => {
    component.form.patchValue({ quantity: 0 });
    component.onSubmit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should submit valid form with delta', () => {
    component.form.patchValue({ quantity: 5 });
    component.onSubmit();
    expect(dialogRefSpy.close).toHaveBeenCalled();
    const result: AdjustResult = dialogRefSpy.close.calls.first().args[0] as AdjustResult;
    expect(result.delta).toBe(5);
    expect(result.item.id).toBe('1');
  });

  it('should submit even if form value is undefined somehow', () => {
    component.form.patchValue({ quantity: null as any });
    // Make form magically valid (bypassing validation for test)
    Object.defineProperty(component.form, 'invalid', { get: () => false });
    
    component.onSubmit();
    const result: AdjustResult = dialogRefSpy.close.calls.first().args[0] as AdjustResult;
    expect(result.delta).toBe(0);
  });

  it('should close on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});
