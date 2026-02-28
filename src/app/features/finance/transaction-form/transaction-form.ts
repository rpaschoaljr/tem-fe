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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Transaction } from '../../../core/models/transaction.model';
import { InputMaskDirective } from '../../../shared/directives/input-mask';
import { ConfigService } from '../../../core/services/config.service';
import { MembersService } from '../../../core/services/members.service';
import { Member } from '../../../core/models/member.model';
import { FieldOption } from '../../../core/models/system-config.model';

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
    InputMaskDirective,
  ],
  providers: [],
  templateUrl: './transaction-form.html',
})
export class TransactionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<TransactionFormComponent>);
  private configService = inject(ConfigService);
  private membersService = inject(MembersService);

  transaction: Transaction | null = inject(MAT_DIALOG_DATA);
  categoryOptions = signal<FieldOption[]>([]);
  allMembers = signal<Member[]>([]);
  filteredMembers = signal<Member[]>([]);
  showMemberField = signal(false);

  form = this.fb.group({
    description: [this.transaction?.description ?? '', [Validators.required, Validators.minLength(3)]],
    type:        [this.transaction?.type ?? 'Entrada', Validators.required],
    category:    [this.transaction?.category ?? '', Validators.required],
    date:        [this.transaction?.date ?? new Date(), Validators.required],
    value:       [Math.abs(this.transaction?.value ?? 0), [Validators.required, Validators.min(0.01)]],
    valueDisplay: [this.formatInitialValue(this.transaction?.value), Validators.required],
    memberId:    [this.transaction?.memberId ?? ''],
    memberName:  [this.transaction?.memberName ?? '']
  });

  ngOnInit() {
    this.loadCategories();
    this.loadMembers();
    this.setupAutoType();
    this.setupDescriptionSearch();
  }

  private formatInitialValue(val: number | undefined): string {
    if (!val) return '0,00';
    return (Math.abs(val)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onValueInput(event: any) {
    let value = event.target.value.replace(/\D/g, ''); // Remove tudo que não é número
    if (value === '') value = '0';
    
    // Converte para decimal (ex: "123" -> 1.23)
    const floatValue = parseFloat(value) / 100;
    
    // Atualiza o valor numérico real no formulário
    this.form.patchValue({ value: floatValue });

    // Formata a exibição (ex: 1.23 -> "1,23")
    const formatted = floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    this.form.patchValue({ valueDisplay: formatted }, { emitEvent: false });
  }

  loadCategories() {
    this.configService.getConfig('finance').subscribe(config => {
      const catField = config.fields.find(f => f.key === 'category');
      if (catField?.options) {
        this.categoryOptions.set(catField.options.filter(o => !o.deleted));
        // Se estiver editando, já checa se precisa exibir o campo de membro
        if (this.transaction) {
           this.checkMemberRequirement(this.transaction.category);
        }
      }
    });
  }

  loadMembers() {
    this.membersService.getMembers().subscribe(m => this.allMembers.set(m.filter(x => !x.deleted)));
  }

  setupAutoType() {
    this.form.get('category')?.valueChanges.subscribe(catLabel => {
      const option = this.categoryOptions().find(o => o.label === catLabel);
      if (option) {
        if (option.meta) {
          this.form.patchValue({ type: option.meta as any }, { emitEvent: false });
          this.form.get('type')?.disable();
        } else {
          this.form.get('type')?.enable();
        }
        
        this.checkMemberRequirement(catLabel!);
      }
    });
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
      
      // Normaliza termo de busca (tira acentos e deixa minusculo)
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

  displayMember(member: any): string {
    if (typeof member === 'string') return member;
    return member?.name || '';
  }

  onMemberSelected(event: any) {
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
    const signedValue = raw.type === 'Saída' ? -Math.abs(raw.value!) : Math.abs(raw.value!);

    const result: Partial<Transaction> = {
      ...(this.transaction ?? {}),
      description: raw.description!,
      type: raw.type as 'Entrada' | 'Saída',
      category: raw.category!,
      date: raw.date as Date,
      value: signedValue,
      memberId: raw.memberId || undefined,
      memberName: raw.memberName || undefined
    };
    this.dialogRef.close(result);
  }

  onCancel() { this.dialogRef.close(); }
}
