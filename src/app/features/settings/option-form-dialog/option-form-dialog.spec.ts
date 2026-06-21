import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionFormDialogComponent } from './option-form-dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('OptionFormDialogComponent', () => {
  let component: OptionFormDialogComponent;
  let fixture: ComponentFixture<OptionFormDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<OptionFormDialogComponent>>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [OptionFormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { label: 'Test Label', showMeta: true } }
      ]
    }).compileComponents();
  });

  describe('creation mode (with meta)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(OptionFormDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create and init form', () => {
      expect(component).toBeTruthy();
      expect(component.form.get('label')).toBeTruthy();
      expect(component.form.get('meta')).toBeTruthy();
      expect(component.form.get('requiresMember')).toBeTruthy();
      expect(component.form.valid).toBeFalse();
    });

    it('should validate requires meta when showMeta is true', () => {
      component.form.patchValue({ label: 'test' });
      expect(component.form.valid).toBeFalse();
      component.form.patchValue({ meta: 'Entrada', costCenter: 'ADM' });
      expect(component.form.valid).toBeTrue();
    });

    it('should save if valid', () => {
      component.form.patchValue({ label: 'NEW OP', meta: 'Saída', requiresMember: true, costCenter: 'ADM', defaultPaymentMethod: null, defaultBankAccount: null, feeType: null, feeValue: null });
      component.save();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ label: 'NEW OP', meta: 'Saída', requiresMember: true, costCenter: 'ADM', defaultPaymentMethod: null, defaultBankAccount: null, feeType: null, feeValue: null });
    });

    it('should format input to uppercase', () => {
      const event = { target: { value: 'lowercase' } } as any;
      component.onInputName(event);
      expect(component.form.get('label')?.value).toBe('LOWERCASE');
    });

    it('should not save if invalid', () => {
      component.form.patchValue({ label: '' });
      component.save();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should close dialog', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('edit mode (without meta)', () => {
    beforeEach(async () => {
      TestBed.overrideProvider(MAT_DIALOG_DATA, { 
        useValue: { label: 'Test', showMeta: false, value: { label: 'EXISTING', meta: null, requiresMember: false }, edit: true } 
      });
      fixture = TestBed.createComponent(OptionFormDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should initialize with existing data and valid', () => {
      expect(component.form.get('label')?.value).toBe('EXISTING');
      expect(component.form.valid).toBeTrue();
    });

    it('should save without meta', () => {
      component.save();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ label: 'EXISTING', meta: '', requiresMember: false, costCenter: '', defaultPaymentMethod: null, defaultBankAccount: null, feeType: null, feeValue: null });
    });
  });
});
