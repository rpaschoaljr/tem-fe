import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionFormComponent } from './transaction-form';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { ConfigService } from '../../../core/services/config.service';
import { MembersService } from '../../../core/services/members.service';
import { LoggerService } from '../../../core/services/logger.service';
import { of } from 'rxjs';
import { Transaction } from '../../../core/models/transaction.model';
import { ModuleConfig } from '../../../core/models/system-config.model';
import { Validators } from '@angular/forms';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt);
describe('TransactionFormComponent', () => {
  let component: TransactionFormComponent;
  let fixture: ComponentFixture<TransactionFormComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<TransactionFormComponent>>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let membersServiceSpy: jasmine.SpyObj<MembersService>;

  const mockConfig: ModuleConfig = {
    id: 'finance',
    updatedAt: new Date(),
    fields: [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        order: 1,
        options: [
          { label: 'MENSALIDADE', deleted: false, meta: 'Entrada', requiresMember: true },
          { label: 'CONTAS', deleted: false, meta: 'Saída' },
          { label: 'OUTROS', deleted: true },
          { label: 'DOAÇÃO', deleted: false } // No meta
        ]
      }
    ]
  };

  const mockMembers = [
    { id: '1', name: 'João Silva', cpf: '12345678900', phone: '11999999999' },
    { id: '2', name: 'Maria Souza', deleted: true }
  ];

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['getConfig']);
    configServiceSpy.getConfig.and.returnValue(of(mockConfig));

    membersServiceSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersServiceSpy.getMembers.and.returnValue(of(mockMembers as any));

    await TestBed.configureTestingModule({
      imports: [TransactionFormComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: MembersService, useValue: membersServiceSpy },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['log', 'error']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories excluding deleted ones', () => {
    expect(component.categoryOptions().length).toBe(3);
    expect(component.categoryOptions().find(o => o.label === 'OUTROS')).toBeUndefined();
  });

  it('should load members excluding deleted ones', () => {
    expect(component.allMembers().length).toBe(1);
    expect(component.allMembers()[0].name).toBe('João Silva');
  });

  it('should patch value and valueDisplay on onValueInput', () => {
    const input = document.createElement('input');
    input.value = '1050';
    const event = new Event('input');
    Object.defineProperty(event, 'target', { writable: false, value: input });
    
    component.onValueInput(event);
    
    expect(component.form.get('value')?.value).toBe(10.50);
    expect(component.form.get('valueDisplay')?.value).toBe('10,50');
  });

  it('should default to 0 on empty value input', () => {
    const input = document.createElement('input');
    input.value = '';
    const event = new Event('input');
    Object.defineProperty(event, 'target', { writable: false, value: input });
    
    component.onValueInput(event);
    
    expect(component.form.get('value')?.value).toBe(0);
  });

  it('should set auto type and disable type field when category has meta', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    expect(component.form.get('type')?.value).toBe('Entrada');
    expect(component.form.get('type')?.disabled).toBeTrue();
  });

  it('should enable type field when category has no meta', () => {
    component.form.get('type')?.disable();
    component.form.patchValue({ category: 'DOAÇÃO' });
    expect(component.form.get('type')?.disabled).toBeFalse();
  });

  it('should require memberId if category requires member', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    expect(component.showMemberField()).toBeTrue();
    expect(component.form.get('memberId')?.validator).toBeTruthy();
  });

  it('should filter members by description search', () => {
    component.form.patchValue({ category: 'MENSALIDADE' }); // enables member field
    component.form.patchValue({ description: 'joão' });
    
    expect(component.filteredMembers().length).toBe(1);
    expect(component.filteredMembers()[0].name).toBe('João Silva');
  });

  it('should not search members if search term length < 2', () => {
    component.form.patchValue({ category: 'MENSALIDADE' }); 
    component.form.patchValue({ description: 'j' });
    expect(component.filteredMembers().length).toBe(0);
  });

  it('should not search members if description contains " - "', () => {
    component.form.patchValue({ category: 'MENSALIDADE' }); 
    component.form.patchValue({ description: 'MENSALIDADE - joão' });
    expect(component.filteredMembers().length).toBe(0);
  });

  it('should patch memberId, memberName and description when member is selected', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    const event = { option: { value: mockMembers[0] } } as any;
    
    component.onMemberSelected(event);
    
    expect(component.form.get('memberId')?.value).toBe('1');
    expect(component.form.get('memberName')?.value).toBe('João Silva');
    expect(component.form.get('description')?.value).toBe('MENSALIDADE - JOÃO SILVA');
    expect(component.filteredMembers().length).toBe(0);
  });

  it('should return member name or string from displayMember', () => {
    expect(component.displayMember('Test')).toBe('Test');
    expect(component.displayMember(mockMembers[0] as any)).toBe('João Silva');
    expect(component.displayMember(null as any)).toBe('');
  });

  it('should not submit if form is invalid', () => {
    component.form.patchValue({ description: '' });
    component.onSubmit();
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should submit and map values correctly (Saída gets negative value)', () => {
    component.form.patchValue({
      description: 'Conta de luz',
      type: 'Saída',
      category: 'CONTAS',
      date: new Date('2023-01-01'),
      value: 100.50,
      valueDisplay: '100,50',
      paymentMethod: 'PIX',
      bankAccount: 'Conta Corrente',
      costCenter: 'Despesas'
    });

    component.onSubmit();

    expect(dialogRefSpy.close).toHaveBeenCalled();
    const result = dialogRefSpy.close.calls.first().args[0] as Partial<Transaction>;
    expect(result.value).toBe(-100.50);
    expect(result.type).toBe('Saída');
  });

  it('should close dialog on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalledWith();
  });
});
