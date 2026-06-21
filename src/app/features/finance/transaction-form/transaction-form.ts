import { Component, inject, Inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { Transaction } from '../../../core/models/transaction.model';
import { InputMaskDirective } from '../../../shared/directives/input-mask';
import { ConfigService } from '../../../core/services/config.service';
import { MembersService } from '../../../core/services/members.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Member } from '../../../core/models/member.model';
import { FieldOption } from '../../../core/models/system-config.model';

const MONTHS = [
  { value: 0, label: 'Janeiro' }, { value: 1, label: 'Fevereiro' }, { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' }, { value: 4, label: 'Maio' }, { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' }, { value: 7, label: 'Agosto' }, { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' }, { value: 10, label: 'Novembro' }, { value: 11, label: 'Dezembro' },
];

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatExpansionModule,
    InputMaskDirective,
  ],
  providers: [],
  templateUrl: './transaction-form.html',
  styles: [`
    .net-value-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 8px 16px;
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .net-value-box .label {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .net-value-box .value {
      font-size: 18px;
      font-weight: bold;
      color: var(--mat-sys-primary);
    }
    .net-value-box .value.negative {
      color: var(--mat-sys-error);
    }
  `]
})
export class TransactionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TransactionFormComponent>);
  private configService = inject(ConfigService);
  private membersService = inject(MembersService);
  private logger = inject(LoggerService);

  transaction: Transaction | null = inject(MAT_DIALOG_DATA);
  categoryOptions = signal<FieldOption[]>([]);
  paymentMethodOptions = signal<FieldOption[]>([]);
  bankAccountOptions = signal<FieldOption[]>([]);
  costCenterOptions = signal<FieldOption[]>([]);

  allMembers = signal<Member[]>([]);
  filteredMembers = signal<Member[]>([]);
  showMemberField = signal(false);
  months = MONTHS;
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  form = this.fb.group({
    description: [this.transaction?.description ?? '', [Validators.required, Validators.minLength(3)]],
    type:        [this.transaction?.type ?? 'Entrada', Validators.required],
    category:    [this.transaction?.category ?? '', Validators.required],
    date:        [this.transaction?.date ?? new Date(), Validators.required],
    value:       [Math.abs(this.transaction?.value ?? 0), [Validators.required, Validators.min(0.01)]],
    valueDisplay: [this.formatInitialValue(this.transaction?.value), Validators.required],
    
    paymentMethod: [this.transaction?.paymentMethod ?? '', Validators.required],
    bankAccount: [this.transaction?.bankAccount ?? '', Validators.required],
    costCenter: [this.transaction?.costCenter ?? '', Validators.required],
    fee: [this.transaction?.fee ?? 0, Validators.min(0)],
    feeDisplay: [this.formatInitialValue(this.transaction?.fee)],

    memberId:    [this.transaction?.memberId ?? ''],
    memberName:  [this.transaction?.memberName ?? ''],
    refMonth:    [this.transaction?.refMonth ?? new Date().getMonth()],
    refYear:     [this.transaction?.refYear ?? new Date().getFullYear()]
  });

  ngOnInit() {
    this.loadCategories();
    this.loadMembers();
    this.setupAutoType();
    this.setupFeeCalculation();
    this.setupDescriptionSearch();
  }

  private formatInitialValue(val: number | undefined): string {
    if (!val) return '0,00';
    return (Math.abs(val)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onValueInput(event: Event) {
    let value = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    if (value === '') value = '0';
    
    const floatValue = parseFloat(value) / 100;
    
    this.form.patchValue({ value: floatValue });

    const formatted = floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    this.form.patchValue({ valueDisplay: formatted }, { emitEvent: false });
  }

  onFeeInput(event: Event) {
    let value = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    if (value === '') value = '0';
    
    const floatValue = parseFloat(value) / 100;
    
    this.form.patchValue({ fee: floatValue });

    const formatted = floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    this.form.patchValue({ feeDisplay: formatted }, { emitEvent: false });
  }

  get netValueCalculated(): number {
    const v = this.form.get('value')?.value || 0;
    const f = this.form.get('fee')?.value || 0;
    return v - f;
  }

  loadCategories() {
    this.configService.getConfig('finance').subscribe(config => {
      const catField = config.fields.find(f => f.key === 'category');
      if (catField?.options) this.categoryOptions.set(catField.options.filter(o => !o.deleted));

      const payField = config.fields.find(f => f.key === 'paymentMethod');
      if (payField?.options) this.paymentMethodOptions.set(payField.options.filter(o => !o.deleted));

      const bankField = config.fields.find(f => f.key === 'bankAccount');
      if (bankField?.options) this.bankAccountOptions.set(bankField.options.filter(o => !o.deleted));

      const costField = config.fields.find(f => f.key === 'costCenter');
      if (costField?.options) this.costCenterOptions.set(costField.options.filter(o => !o.deleted));

      if (this.transaction) {
         this.checkMemberRequirement(this.transaction.category);
      }
    });
  }

  loadMembers() {
    this.membersService.getMembers().subscribe(m => this.allMembers.set(m.filter(x => !x.deleted) as Member[]));
  }

  setupAutoType() {
    this.form.get('category')?.valueChanges.subscribe(catLabel => {
      const option = this.categoryOptions().find(o => o.label === catLabel);
      if (option) {
        if (option.meta) {
          this.form.patchValue({ type: option.meta as 'Entrada' | 'Saída' }, { emitEvent: false });
          this.form.get('type')?.disable();
        } else {
          this.form.get('type')?.enable();
        }
        
        // Auto-preenchimento do DRE
        if (option.costCenter) {
          this.form.patchValue({ costCenter: option.costCenter });
        }
        if (option.defaultPaymentMethod) {
          this.form.patchValue({ paymentMethod: option.defaultPaymentMethod });
        }
        if (option.defaultBankAccount) {
          this.form.patchValue({ bankAccount: option.defaultBankAccount });
        }

        this.checkMemberRequirement(catLabel!);
      }
    });
  }

  setupFeeCalculation() {
    const recalcFee = () => {
      // Evita sobrescrever se estivermos apenas carregando a transação inicial
      // Mas para ser dinâmico, vamos calcular sempre
      const payLabel = this.form.get('paymentMethod')?.value;
      const bankLabel = this.form.get('bankAccount')?.value;
      const val = this.form.get('value')?.value || 0;

      const payOpt = this.paymentMethodOptions().find(o => o.label === payLabel);
      const bankOpt = this.bankAccountOptions().find(o => o.label === bankLabel);

      // Procura a primeira configuração que tenha taxa, dando prioridade para Forma de Pagamento, depois Conta.
      const feeSource = [payOpt, bankOpt].find(o => o?.feeType && o.feeValue);

      if (feeSource) {
        let fee = 0;
        if (feeSource.feeType === 'fixed') {
          fee = feeSource.feeValue!;
        } else if (feeSource.feeType === 'percentage') {
          fee = val * (feeSource.feeValue! / 100);
        }

        this.form.patchValue({ fee }, { emitEvent: false });
        const formatted = fee.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.form.patchValue({ feeDisplay: formatted }, { emitEvent: false });
      } else {
        // Se mudou pra uma forma que não tem taxa automática, podemos zerar ou manter a que o cara digitou.
        // Vamos manter a atual (não faz nada) para que o usuário possa digitar na mão e não apagar do nada.
      }
    };

    this.form.get('paymentMethod')?.valueChanges.subscribe(() => recalcFee());
    this.form.get('bankAccount')?.valueChanges.subscribe(() => recalcFee());
    this.form.get('value')?.valueChanges.subscribe(() => recalcFee());
  }

  private checkMemberRequirement(catLabel: string) {
    const option = this.categoryOptions().find(o => o.label === catLabel);
    const requires = !!option?.requiresMember;
    this.showMemberField.set(requires);
    
    if (requires) {
      this.form.get('memberId')?.setValidators(Validators.required);
    } else {
      this.form.get('memberId')?.clearValidators();
      this.form.patchValue({ memberId: '', memberName: '' });
    }
    this.form.get('memberId')?.updateValueAndValidity();
  }

  setupDescriptionSearch() {
    this.form.get('description')?.valueChanges.subscribe(val => {
      if (!this.showMemberField() || typeof val !== 'string' || val.includes(' - ')) {
        return;
      }
      
      const search = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const searchOnlyNumbers = val.replace(/\D/g, '');

      if (search.length < 2) {
        this.filteredMembers.set([]);
        return;
      }

      this.filteredMembers.set(
        this.allMembers().filter(m => {
          const nameNorm = m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const cpfOnlyNumbers = (m.cpf || '').replace(/\D/g, '');
          const phoneOnlyNumbers = (m.phone || '').replace(/\D/g, '');

          return nameNorm.includes(search) || 
                 (searchOnlyNumbers && cpfOnlyNumbers.includes(searchOnlyNumbers)) || 
                 (searchOnlyNumbers && phoneOnlyNumbers.includes(searchOnlyNumbers));
        }).slice(0, 5)
      );
    });
  }

  displayMember(member: Member | string): string {
    if (typeof member === 'string') return member;
    return member?.name || '';
  }

  onMemberSelected(event: MatAutocompleteSelectedEvent) {
    const member: Member = event.option.value;
    const category = this.form.get('category')?.value;
    
    this.form.patchValue({
      memberId: member.id,
      memberName: member.name,
      description: `${category} - ${member.name}`.toUpperCase()
    });
    this.filteredMembers.set([]);
  }

  get isEdit() { return !!this.transaction; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const feeValue = raw.fee || 0;
    const isIncome = raw.type === 'Entrada';
    const signedValue = isIncome ? Math.abs(raw.value!) : -Math.abs(raw.value!);
    const netValue = (Math.abs(raw.value!) - feeValue) * (isIncome ? 1 : -1);

    const result: Partial<Transaction> = {
      ...(this.transaction ?? {}),
      description: raw.description!,
      type: raw.type as 'Entrada' | 'Saída',
      category: raw.category!,
      date: raw.date as Date,
      value: signedValue,
      fee: feeValue,
      netValue: netValue,
      paymentMethod: raw.paymentMethod!,
      bankAccount: raw.bankAccount!,
      costCenter: raw.costCenter!,
      memberId: raw.memberId || undefined,
      memberName: raw.memberName || undefined,
      refMonth: raw.refMonth ?? undefined,
      refYear: raw.refYear ?? undefined
    };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
