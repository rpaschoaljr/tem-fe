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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ScheduledTransaction, RecurrenceType, RECURRENCE_LABELS } from '../../../core/models/scheduled-transaction.model';
import { InputMaskDirective } from '../../../shared/directives/input-mask';
import { ConfigService } from '../../../core/services/config.service';
import { MembersService } from '../../../core/services/members.service';
import { Member } from '../../../core/models/member.model';
import { FieldOption } from '../../../core/models/system-config.model';

@Component({
    selector: 'app-scheduled-transaction-form',
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
        MatSlideToggleModule,
        InputMaskDirective
    ],
    templateUrl: './scheduled-transaction-form.html',
})
export class ScheduledTransactionFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private dialogRef = inject(MatDialogRef<ScheduledTransactionFormComponent>);
    private configService = inject(ConfigService);
    private membersService = inject(MembersService);

    scheduled: ScheduledTransaction | null = inject(MAT_DIALOG_DATA);

    categoryOptions = signal<FieldOption[]>([]);
    allMembers = signal<Member[]>([]);
    filteredMembers = signal<Member[]>([]);
    showMemberField = signal(false);

    recurrenceOptions: { value: RecurrenceType; label: string }[] = [
        { value: 'monthly', label: RECURRENCE_LABELS.monthly },
        { value: 'weekly', label: RECURRENCE_LABELS.weekly },
        { value: 'yearly', label: RECURRENCE_LABELS.yearly },
        { value: 'once', label: RECURRENCE_LABELS.once },
    ];

    form = this.fb.group({
        description: [this.scheduled?.description ?? '', [Validators.required, Validators.minLength(3)]],
        type: [this.scheduled?.type ?? 'Entrada', Validators.required],
        category: [this.scheduled?.category ?? '', Validators.required],
        value: [this.scheduled?.value ?? 0, [Validators.required, Validators.min(0.01)]],
        valueDisplay: [this.formatInitialValue(this.scheduled?.value), Validators.required],
        recurrence: [this.scheduled?.recurrence ?? 'monthly' as RecurrenceType, Validators.required],
        dayOfMonth: [this.scheduled?.dayOfMonth ?? null as number | null],
        nextDueDate: [this.scheduled?.nextDueDate ?? new Date(), Validators.required],
        active: [this.scheduled?.active ?? true],
        memberId: [this.scheduled?.memberId ?? ''],
        memberName: [this.scheduled?.memberName ?? '']
    });

    ngOnInit() {
        this.loadCategories();
        this.loadMembers();
        this.setupAutoType();
        this.setupDescriptionSearch();
        this.setupRecurrenceWatcher();
        if (this.scheduled?.recurrence === 'monthly') {
            this.form.get('dayOfMonth')?.setValidators([Validators.required, Validators.min(1), Validators.max(28)]);
            this.form.get('dayOfMonth')?.updateValueAndValidity();
        }
    }

    private formatInitialValue(val: number | undefined): string {
        if (!val) return '0,00';
        return Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    onValueInput(event: any) {
        let value = event.target.value.replace(/\D/g, '');
        if (value === '') value = '0';
        const floatValue = parseFloat(value) / 100;
        this.form.patchValue({ value: floatValue });
        const formatted = floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.form.patchValue({ valueDisplay: formatted }, { emitEvent: false });
    }

    loadCategories() {
        this.configService.getConfig('finance').subscribe(config => {
            const catField = config.fields.find(f => f.key === 'category');
            if (catField?.options) {
                this.categoryOptions.set(catField.options.filter(o => !o.deleted));
                if (this.scheduled) {
                    this.checkMemberRequirement(this.scheduled.category);
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

    setupRecurrenceWatcher() {
        this.form.get('recurrence')?.valueChanges.subscribe(rec => {
            const dayCtrl = this.form.get('dayOfMonth');
            if (rec === 'monthly') {
                dayCtrl?.setValidators([Validators.required, Validators.min(1), Validators.max(28)]);
            } else {
                dayCtrl?.clearValidators();
                dayCtrl?.setValue(null);
            }
            dayCtrl?.updateValueAndValidity();
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
            if (!this.showMemberField() || typeof val !== 'string' || val.includes(' - ')) return;
            const search = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const searchOnlyNumbers = val.replace(/\D/g, '');
            if (search.length < 2) { this.filteredMembers.set([]); return; }
            this.filteredMembers.set(
                this.allMembers().filter(m => {
                    const nameNorm = m.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const cpfNum = (m.cpf || '').replace(/\D/g, '');
                    const phoneNum = (m.phone || '').replace(/\D/g, '');
                    return nameNorm.includes(search) ||
                        (searchOnlyNumbers && cpfNum.includes(searchOnlyNumbers)) ||
                        (searchOnlyNumbers && phoneNum.includes(searchOnlyNumbers));
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

    get isEdit() { return !!this.scheduled; }
    get isMonthly() { return this.form.get('recurrence')?.value === 'monthly'; }

    onSubmit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const result: Partial<ScheduledTransaction> = {
            ...(this.scheduled ?? {}),
            description: raw.description!,
            type: raw.type as 'Entrada' | 'Saída',
            category: raw.category!,
            value: Math.abs(raw.value!),
            recurrence: raw.recurrence as RecurrenceType,
            dayOfMonth: raw.recurrence === 'monthly' ? (raw.dayOfMonth ?? undefined) : undefined,
            nextDueDate: raw.nextDueDate as Date,
            active: raw.active!,
            memberId: raw.memberId || undefined,
            memberName: raw.memberName || undefined,
            deleted: this.scheduled?.deleted ?? false
        };
        this.dialogRef.close(result);
    }

    onCancel() { this.dialogRef.close(); }
}
