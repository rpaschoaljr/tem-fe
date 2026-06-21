import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

import { MembersService } from '../../../core/services/members.service';
import { ConfigService } from '../../../core/services/config.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Member } from '../../../core/models/member.model';
import { DynamicField } from '../../../core/models/system-config.model';
import { CepResponse } from '../../../core/models/common';
import { CustomValidators } from '../../../shared/utils/validators';
import { InputMaskDirective } from '../../../shared/directives/input-mask';
import { ComponentCanDeactivate } from '../../../core/guards/pending-changes.guard';
import { Observable } from 'rxjs';


@Component({
  selector: 'app-member-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTabsModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    InputMaskDirective
  ],
  providers: [],
  templateUrl: './member-form.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './member-form.scss'
})
export class MemberFormComponent implements OnInit, ComponentCanDeactivate {
  private fb = inject(FormBuilder);
  private membersService = inject(MembersService);
  private configService = inject(ConfigService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private logger = inject(LoggerService);

  form!: FormGroup;
  isEditMode = false;
  memberId: string | null = null;
  selectedIndex = 0;
  totalTabs = 4;
  formSubmitted = false;

  canDeactivate(): boolean | Observable<boolean> {
    if (this.form && this.form.dirty && !this.formSubmitted) {
      return confirm('Você tem alterações não salvas no formulário. Deseja realmente sair?');
    }
    return true;
  }

  roles: string[] = [];
  customFieldsConfig: DynamicField[] = [];

  ngOnInit() {
    this.initForm();
    this.loadConfig();
    this.checkEditMode();
    this.setupDateCrossValidation();
  }

  getFieldsBySection(section: string) {
    return this.customFieldsConfig.filter(f => f.section === section);
  }

  getActiveOptions(field: DynamicField) {
    return field.options?.filter(o => !o.deleted).sort((a, b) => a.label.localeCompare(b.label)) || [];
  }

  loadConfig() {
    this.configService.getConfig('members').subscribe(config => {
      this.customFieldsConfig = config.fields.filter(f => !f.deleted);
      
      const roleField = config.fields.find(f => f.key === 'role');
      this.roles = roleField?.options?.filter(o => !o.deleted).map(o => o.label).sort((a, b) => a.localeCompare(b)) || [];

      const addressGroup = this.form.get('address') as FormGroup;
      const ritualsGroup = this.form.get('rituals') as FormGroup;
      const consecrationsGroup = this.form.get('consecrations') as FormGroup;
      const customGroup = this.form.get('customFields') as FormGroup;

      this.customFieldsConfig.forEach(field => {
        let group: FormGroup | null = null;
        let validators = field.required ? [Validators.required] : [];

        if (field.section === 'Endereço') {
          group = addressGroup;
          if (field.key === 'state') validators.push(Validators.maxLength(2));
        } else if (field.section === 'Rituais') {
          group = ritualsGroup;
          validators = [CustomValidators.dateNotFuture, CustomValidators.dateAfterEntry];
          if (field.key === 'baptism1Year') validators.push(CustomValidators.baptism1AfterBaptism);
        } else if (field.section === 'Consagrações (Orixás)') {
          group = consecrationsGroup;
          validators = [CustomValidators.dateNotFuture, CustomValidators.dateAfterEntry];
        } else {
          const rootFields = ['name', 'cpf', 'email', 'phone', 'status', 'role', 'showSpiritualData', 'isExempt', 'entryDate', 'exitDate', 'observations'];
          if (rootFields.includes(field.key)) {
            if (!this.form.contains(field.key)) {
              if (field.key === 'cpf') validators.push(CustomValidators.cpf);
              if (field.key === 'phone') validators.push(CustomValidators.phone);
              if (field.key === 'email') validators.push(Validators.email);
              if (field.key === 'exitDate') validators = [CustomValidators.exitAfterEntry];
              if (field.key === 'entryDate') validators.push(CustomValidators.dateNotFuture);
              if (field.key === 'name') validators.push(Validators.minLength(3));
              
              this.form.addControl(field.key, this.fb.control(
                field.type === 'boolean' ? false : (field.key === 'entryDate' ? new Date() : null), 
                validators
              ));
            }
            return;
          }
          group = customGroup;
        }

        if (group && !group.contains(field.key)) {
          group.addControl(field.key, this.fb.control(
            field.type === 'boolean' ? false : null,
            validators
          ));
        }
      });

      this.totalTabs = this.getFieldsBySection('Informações Adicionais').length > 0 ? 5 : 4;
      
      this.setupDateCrossValidation();
    });
  }

  setupDateCrossValidation() {
    const ritualKeys = ['initiation', 'baptism', 'baptism1Year', 'coronation', 'crownWashing'];

    const entryDateControl = this.form.get('entryDate');
    if (entryDateControl) {
      entryDateControl.valueChanges.subscribe(() => {
        this.form.get('exitDate')?.updateValueAndValidity({ emitEvent: false });
        ritualKeys.forEach(k => this.form.get(`rituals.${k}`)?.updateValueAndValidity({ emitEvent: false }));
        
        const consecrationsGroup = this.form.get('consecrations') as FormGroup;
        if (consecrationsGroup) {
          Object.keys(consecrationsGroup.controls).forEach(key => {
            consecrationsGroup.get(key)?.updateValueAndValidity({ emitEvent: false });
          });
        }
      });
    }

    const baptismControl = this.form.get('rituals.baptism');
    if (baptismControl) {
      baptismControl.valueChanges.subscribe(() => {
        this.form.get('rituals.baptism1Year')?.updateValueAndValidity({ emitEvent: false });
      });
    }
  }

  initForm() {
    this.form = this.fb.group({
      id: [''],
      address: this.fb.group({}),
      rituals: this.fb.group({}),
      consecrations: this.fb.group({}),
      customFields: this.fb.group({})
    });
  }

  checkEditMode() {
    this.route.params.subscribe((params: { id?: string }) => {
      if (params['id']) {
        this.isEditMode = true;
        this.memberId = params['id'];
        this.loadMember(this.memberId!);
      }
    });
  }

  loadMember(id: string) {
    this.membersService.getById(id).subscribe({
      next: (member) => {
        if (member) {
          this.form.patchValue(member);
          this.form.markAsPristine();
        } else {
          this.notify.showError('Membro não encontrado.');
          this.router.navigate(['/members']);
        }
      },
      error: () => this.notify.showError('Erro ao carregar dados do membro.')
    });
  }

  onCepBlur() {
    const cepControl = this.form.get('address.cep');
    const cep = cepControl?.value;

    if (cep && cep.replace(/\D/g, '').length === 8) {
      this.membersService.getAddressByCep(cep).subscribe({
        next: (data: CepResponse) => {
          if (!data || data.erro) {
            this.notify.showError('CEP não encontrado.');
            return;
          }
          this.form.get('address')?.patchValue({
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          });
          this.notify.showSuccess('Endereço encontrado!');
        },
        error: () => this.notify.showError('Erro ao consultar CEP.')
      });
    }
  }

  private isTabValid(tabIndex: number): boolean {
    const config = this.customFieldsConfig;
    let sectionsInTab: string[] = [];
    
    switch (tabIndex) {
      case 0: sectionsInTab = ['Dados Pessoais']; break;
      case 1: sectionsInTab = ['Endereço']; break;
      case 2: sectionsInTab = ['Vida Espiritual', 'Rituais']; break;
      case 3: sectionsInTab = ['Consagrações (Orixás)']; break;
      case 4: sectionsInTab = ['Informações Adicionais']; break;
    }

    const fieldsInTab = config.filter(f => sectionsInTab.includes(f.section || ''));

    let isValid = true;
    fieldsInTab.forEach(f => {
      let control;
      const rootFields = ['name', 'cpf', 'email', 'phone', 'status', 'role', 'showSpiritualData', 'isExempt', 'entryDate', 'exitDate', 'observations'];
      
      if (f.section === 'Endereço') control = this.form.get(`address.${f.key}`);
      else if (f.section === 'Rituais') control = this.form.get(`rituals.${f.key}`);
      else if (f.section === 'Consagrações (Orixás)') control = this.form.get(`consecrations.${f.key}`);
      else if (f.section === 'Informações Adicionais') control = this.form.get(`customFields.${f.key}`);
      else if (rootFields.includes(f.key)) control = this.form.get(f.key);
      else control = this.form.get(`customFields.${f.key}`);

      if (control) {
        control.markAsTouched();
        if (control.invalid) isValid = false;
      }
    });

    return isValid;
  }

  nextTab() {
    if (this.isTabValid(this.selectedIndex)) {
      if (this.selectedIndex < this.totalTabs - 1) {
        this.selectedIndex++;
      }
    } else {
      this.notify.showError('Por favor, preencha os campos obrigatórios da aba atual antes de prosseguir.');
    }
  }

  previousTab() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
  }

  onSubmit() {
    if (this.form.valid) {
      const memberData: Partial<Member> & { id?: string } = {
        ...this.form.value,
        ...(this.isEditMode ? {} : { isFirstAccess: true })
      };

      if (!this.isEditMode) {
        const { id, ...dataWithoutId } = memberData;
        this.formSubmitted = true;
        this.membersService.save(dataWithoutId as Member).subscribe({
          next: () => {
            this.notify.showSuccess(this.isEditMode ? 'Membro atualizado!' : 'Membro cadastrado!');
            this.router.navigate(['/members']);
          },
          error: (e: unknown) => {
            this.formSubmitted = false;
            this.logger.error('Erro ao salvar membro', e);
            this.notify.showError('Erro ao salvar: ' + (e instanceof Error ? e.message : ''));
          }
        });
        return;
      }

      this.formSubmitted = true;
      this.membersService.save(memberData as Member).subscribe({
        next: () => {
          this.notify.showSuccess(this.isEditMode ? 'Membro atualizado!' : 'Membro cadastrado!');
          this.router.navigate(['/members']);
        },
        error: (e: unknown) => {
          this.formSubmitted = false;
          this.logger.error('Erro ao salvar membro', e);
          this.notify.showError('Erro ao salvar: ' + (e instanceof Error ? e.message : ''));
        }
      });
    } else {
      this.form.markAllAsTouched();
      this.notify.showError('Preencha os campos obrigatórios.');
    }
  }

  onCancel() {
    this.router.navigate(['/members']);
  }
}
