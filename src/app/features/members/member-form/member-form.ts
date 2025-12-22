import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

// Imports Visuais (Angular Material)
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

// Imports do Projeto
import { MembersService } from '../../../core/services/members.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Member } from '../../../core/models/member.model';
import { CustomValidators } from '../../../shared/utils/validators';
import { InputMaskDirective } from '../../../shared/directives/input-mask';


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
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  templateUrl: './member-form.html',
  styleUrl: './member-form.scss'
})
export class MemberFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private membersService = inject(MembersService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form!: FormGroup;
  isEditMode = false;
  memberId: string | null = null;

  // Listas
  roles = ['MÉDIUM', 'CAMBONO', 'OGÃ', 'PAI/MÃE PEQUENO', 'DIRETORIA', 'CONSULENTE'];

  // Lista para gerar campos dinâmicos
  orixas = [
    { key: 'oxossi', label: 'Oxóssi' }, { key: 'iemanja', label: 'Iemanjá' },
    { key: 'oxala', label: 'Oxalá' }, { key: 'ogum', label: 'Ogum' },
    { key: 'obaluae', label: 'Obaluaê' }, { key: 'oxum', label: 'Oxum' },
    { key: 'xango', label: 'Xangô' }, { key: 'oba', label: 'Obá' },
    { key: 'omulu', label: 'Omulú' }, { key: 'logunan', label: 'Logunã' },
    { key: 'iansa', label: 'Iansã' }, { key: 'nana', label: 'Nanã' },
    { key: 'oxumare', label: 'Oxumaré' }, { key: 'oroina', label: 'Oroiná (Egunitá)' }
  ];

  ngOnInit() {
    this.initForm();
    this.checkEditMode();
  }

  initForm() {
    this.form = this.fb.group({
      id: [''],
      // Identificação
      name: ['', [Validators.required, Validators.minLength(3)]],
      cpf: ['', [Validators.required, CustomValidators.cpf]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],

      // Endereço
      address: this.fb.group({
        cep: ['', Validators.required],
        street: ['', Validators.required],
        number: ['', Validators.required],
        complement: [''],
        neighborhood: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', [Validators.required, Validators.maxLength(2)]]
      }),

      // Vida Espiritual
      role: ['MÉDIUM', Validators.required],
      status: ['Ativo', Validators.required],
      entryDate: [new Date(), Validators.required],
      exitDate: [null],
      observations: [''],

      // Rituais
      rituals: this.fb.group({
        initiation: [null],
        baptism: [null],
        baptism1Year: [null],
        coronation: [null],
        crownWashing: [null]
      }),

      // Consagrações (Gerado dinamicamente via Reduce)
      consecrations: this.fb.group(
        this.orixas.reduce((acc, curr) => ({ ...acc, [curr.key]: [null] }), {})
      )
    });
  }

  checkEditMode() {
    this.route.params.subscribe((params: any) => {
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

    // Só busca se tiver 8 dígitos (considerando que a máscara pode ter colocado traço, mas o length ajuda)
    if (cep && cep.replace(/\D/g, '').length === 8) {
      this.membersService.getAddressByCep(cep).subscribe({
        next: (data: any) => {
          if (!data || data.erro) {
            this.notify.showError('CEP não encontrado.');
            return;
          }
          // PatchValue para preencher automático
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

  onSubmit() {
    if (this.form.valid) {
      const memberData: Member = this.form.value;

      // Se for novo cadastro, remove o ID vazio para o serviço gerar um novo
      if (!this.isEditMode) delete (memberData as any).id;

      this.membersService.save(memberData).subscribe({
        next: () => {
          this.notify.showSuccess(this.isEditMode ? 'Membro atualizado!' : 'Membro cadastrado!');
          this.router.navigate(['/members']);
        },
        error: (e: any) => this.notify.showError('Erro ao salvar: ' + e.message)
      });
    } else {
      this.notify.showError('Preencha os campos obrigatórios.');
      this.form.markAllAsTouched();
    }
  }

  onCancel() {
    this.router.navigate(['/members']);
  }
}