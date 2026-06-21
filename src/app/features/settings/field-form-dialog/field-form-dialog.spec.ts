import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldFormDialogComponent } from './field-form-dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DynamicField } from '../../../core/models/system-config.model';

describe('FieldFormDialogComponent', () => {
  let component: FieldFormDialogComponent;
  let fixture: ComponentFixture<FieldFormDialogComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<FieldFormDialogComponent>>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [FieldFormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {} }
      ]
    }).compileComponents();
  });

  describe('creation mode', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(FieldFormDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create and init empty form', () => {
      expect(component).toBeTruthy();
      expect(component.form.get('label')?.value).toBe('');
      expect(component.form.get('type')?.value).toBe('text');
      expect(component.form.valid).toBeFalse();
    });

    it('should save text field and generate key', () => {
      component.form.patchValue({
        label: 'Grau de Escolaridade',
        type: 'text',
        required: false,
        section: 'Dados Pessoais',
        showInProfile: true
      });
      expect(component.form.valid).toBeTrue();

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith(jasmine.objectContaining({
        label: 'Grau de Escolaridade',
        key: 'grau_de_escolaridade',
        type: 'text',
        required: false,
        section: 'Dados Pessoais',
        showInProfile: true
      }));
    });

    it('should save select field and parse options', () => {
      component.form.patchValue({
        label: 'Teste Select',
        type: 'select',
        required: true,
        section: 'Geral',
        showInProfile: false,
        optionsList: 'OPT1, OPT2\nOPT3'
      });

      component.save();

      const result = mockDialogRef.close.calls.first().args[0] as DynamicField;
      expect(result.type).toBe('select');
      expect(result.options?.length).toBe(3);
      expect(result.options![0].label).toBe('OPT1');
      expect(result.options![1].label).toBe('OPT2');
      expect(result.options![2].label).toBe('OPT3');
    });

    it('should close dialog without saving', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('should not save if invalid', () => {
      component.form.patchValue({ label: '' });
      component.save();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const existingField: DynamicField = {
      key: 'my_field',
      label: 'My Field',
      type: 'select',
      required: true,
      order: 1,
      section: 'Dados Pessoais',
      options: [
        { label: 'OPT1', deleted: false },
        { label: 'OPT_DEL', deleted: true }
      ]
    };

    beforeEach(async () => {
      TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { edit: true, disableType: true, value: existingField } });
      fixture = TestBed.createComponent(FieldFormDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should init with existing data', () => {
      expect(component.form.get('label')?.value).toBe('My Field');
      expect(component.form.get('type')?.value).toBe('select');
      expect(component.form.get('type')?.disabled).toBeTrue();
      expect(component.form.get('optionsList')?.value).toBe('OPT1');
    });

    it('should preserve deleted options and keep existing key', () => {
      component.form.patchValue({
        label: 'My Updated Field',
        optionsList: 'OPT1, NEW_OPT'
      });

      component.save();

      const result = mockDialogRef.close.calls.first().args[0] as DynamicField;
      expect(result.key).toBe('my_field');
      expect(result.label).toBe('My Updated Field');
      expect(result.options?.length).toBe(3);
      expect(result.options?.find(o => o.label === 'OPT_DEL')?.deleted).toBeTrue();
      expect(result.options?.find(o => o.label === 'OPT1')?.deleted).toBeFalse();
      expect(result.options?.find(o => o.label === 'NEW_OPT')?.deleted).toBeFalse();
    });
  });
});
