import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduledTransactionFormComponent } from './scheduled-transaction-form';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { ConfigService } from '../../../core/services/config.service';
import { MembersService } from '../../../core/services/members.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { of } from 'rxjs';
import { ScheduledTransaction } from '../../../core/models/scheduled-transaction.model';
import { ModuleConfig } from '../../../core/models/system-config.model';
import { Validators } from '@angular/forms';

describe('ScheduledTransactionFormComponent', () => {
  let component: ScheduledTransactionFormComponent;
  let fixture: ComponentFixture<ScheduledTransactionFormComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<ScheduledTransactionFormComponent>>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let membersServiceSpy: jasmine.SpyObj<MembersService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const mockConfig: any = {
    id: 'finance',
    updatedAt: new Date(),
    customParams: {
      defaultDuesValue: 80,
      courseDiscountPercent: 50
    },
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
          { label: 'ALUGUEL', deleted: false }
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

    notificationSpy = jasmine.createSpyObj('NotificationService', ['showError']);

    await TestBed.configureTestingModule({
      imports: [ScheduledTransactionFormComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: MembersService, useValue: membersServiceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['log', 'error']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduledTransactionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories excluding deleted ones', () => {
    expect(component.categoryOptions().length).toBe(3);
  });

  it('should format initial value correctly', () => {
    expect(component.form.get('valueDisplay')?.value).toBe('0,00');
  });

  it('should handle value input and format display', () => {
    const input = document.createElement('input');
    input.value = '1500';
    const event = new Event('input');
    Object.defineProperty(event, 'target', { writable: false, value: input });
    
    component.onValueInput(event);
    
    expect(component.form.get('value')?.value).toBe(15.00);
    expect(component.form.get('valueDisplay')?.value).toBe('15,00');
  });

  it('should default empty value input to 0', () => {
    const input = document.createElement('input');
    input.value = '';
    const event = new Event('input');
    Object.defineProperty(event, 'target', { writable: false, value: input });
    component.onValueInput(event);
    expect(component.form.get('value')?.value).toBe(0);
  });

  it('should automatically set type based on meta', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    expect(component.form.get('type')?.value).toBe('Entrada');
    expect(component.form.get('type')?.disabled).toBeTrue();
    expect(component.showMemberField()).toBeTrue();
  });

  it('should set auto type based on hardcoded list if meta is missing', () => {
    component.form.get('type')?.enable();
    component.form.patchValue({ category: 'ALUGUEL' });
    expect(component.form.get('type')?.value).toBe('Saída');
    expect(component.form.get('type')?.disabled).toBeTrue();
  });

  it('should clear member fields when category does not require it', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    component.form.patchValue({ memberId: '1', memberName: 'João' });
    
    component.form.patchValue({ category: 'CONTAS' });
    expect(component.showMemberField()).toBeFalse();
    expect(component.form.get('memberId')?.value).toBe('');
    expect(component.form.get('memberName')?.value).toBe('');
  });

  it('should search member by description', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    component.form.patchValue({ description: 'joão' });
    expect(component.filteredMembers().length).toBe(1);
    expect(component.filteredMembers()[0].name).toBe('João Silva');
  });

  it('should not search members if less than 2 chars', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    component.form.patchValue({ description: 'j' });
    expect(component.filteredMembers().length).toBe(0);
  });

  it('should update recurrence validation', () => {
    component.form.patchValue({ recurrence: 'monthly' });
    expect(component.form.get('dayOfMonth')?.hasValidator(Validators.required)).toBeTrue();

    component.form.patchValue({ recurrence: 'weekly' });
    expect(component.form.get('dayOfMonth')?.hasValidator(Validators.required)).toBeFalse();
  });

  it('should handle member selection', () => {
    component.form.patchValue({ category: 'MENSALIDADE' });
    const event = { option: { value: mockMembers[0] } } as any;
    component.onMemberSelected(event);
    expect(component.form.get('memberId')?.value).toBe('1');
    expect(component.form.get('description')?.value).toBe('MENSALIDADE - JOÃO SILVA');
    expect(component.filteredMembers().length).toBe(0);
  });

  it('should return correct displayMember format', () => {
    expect(component.displayMember('Test')).toBe('Test');
    expect(component.displayMember(mockMembers[0] as any)).toBe('João Silva');
  });

  it('should show error and not submit if form is invalid - value <= 0', () => {
    component.form.patchValue({ value: 0 });
    component.onSubmit();
    expect(notificationSpy.showError).toHaveBeenCalledWith('O valor deve ser maior que zero.');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('should show error if member required but not selected', () => {
    component.form.patchValue({ category: 'MENSALIDADE', memberId: '', value: 10 });
    component.onSubmit();
    expect(notificationSpy.showError).toHaveBeenCalledWith('Por favor, selecione um membro da lista no campo Descrição.');
  });

  it('should show generic error if other fields invalid', () => {
    component.form.patchValue({ description: '', value: 10, category: 'CONTAS' });
    component.onSubmit();
    expect(notificationSpy.showError).toHaveBeenCalledWith('Verifique os campos obrigatórios em vermelho.');
  });

  it('should submit valid form', () => {
    component.form.patchValue({
      description: 'Test Event',
      type: 'Entrada',
      category: 'OUTROS',
      value: 150,
      recurrence: 'once',
      nextDueDate: new Date('2023-01-01'),
      active: true
    });
    
    component.onSubmit();
    expect(dialogRefSpy.close).toHaveBeenCalled();
    const result = dialogRefSpy.close.calls.first().args[0] as Partial<ScheduledTransaction>;
    expect(result.description).toBe('Test Event');
    expect(result.value).toBe(150);
  });

  it('should close on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });

  it('should auto-populate dues value based on member status and discount', () => {
    const regularMember = { id: 'm1', name: 'João Silva', status: 'Ativo', isExempt: false, duesDiscountPercent: 0 } as any;
    component.form.patchValue({ category: 'MENSALIDADE' });
    
    const event1 = { option: { value: regularMember } } as any;
    component.onMemberSelected(event1);
    expect(component.form.get('value')?.value).toBe(80);
    expect(component.form.get('valueDisplay')?.value).toBe('80,00');

    const exemptMember = { id: 'm2', name: 'Maria Souza', status: 'Ativo', isExempt: true, duesDiscountPercent: 0 } as any;
    const event2 = { option: { value: exemptMember } } as any;
    component.onMemberSelected(event2);
    expect(component.form.get('value')?.value).toBe(0);
    expect(component.form.get('valueDisplay')?.value).toBe('0,00');

    const courseMember = { id: 'm3', name: 'Pedro Dias', status: 'Em Curso', isExempt: false, duesDiscountPercent: 0 } as any;
    const event3 = { option: { value: courseMember } } as any;
    component.onMemberSelected(event3);
    expect(component.form.get('value')?.value).toBe(40); // 80 * (1 - 50%)
    expect(component.form.get('valueDisplay')?.value).toBe('40,00');

    const discountedMember = { id: 'm4', name: 'Ana Costa', status: 'Ativo', isExempt: false, duesDiscountPercent: 25 } as any;
    const event4 = { option: { value: discountedMember } } as any;
    component.onMemberSelected(event4);
    expect(component.form.get('value')?.value).toBe(60); // 80 * (1 - 25%)
    expect(component.form.get('valueDisplay')?.value).toBe('60,00');
  });
});
