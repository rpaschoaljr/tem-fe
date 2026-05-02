import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { FinanceService } from '../../core/services/finance.service';
import { combineLatest } from 'rxjs';

import { MembersService } from '../../core/services/members.service';
import { NotificationService } from '../../core/services/notification.service';
import { Member } from '../../core/models/member.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatIconModule,
    MatButtonModule, 
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    GenericListComponent
  ],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class MembersComponent implements OnInit {
  private membersService = inject(MembersService);
  private financeService = inject(FinanceService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private exportService = inject(ExportService);

  allMembers: Member[] = [];
  members: any[] = []; // Usamos any para incluir o campo virtual financeiro
  exportData: any[] = []; 
  totalActive = 0;
  canWrite$ = this.authService.hasPermission('members', 'write');

  searchTerm = '';
  statusFilter = 'Ativo';
  roleFilter = '';
  roles: string[] = [];

  tableColumns: ColumnDef[] = [
    { def: 'name', label: 'Nome' },
    { def: 'role', label: 'Função', hideOnMobile: true },
    { def: 'status', label: 'Status', hideOnMobile: true },
    { def: 'financeStatus', label: 'Financeiro', type: 'status', hideOnMobile: true }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();

    combineLatest({
      members: this.membersService.getMembers(),
      transactions: this.financeService.getTransactions()
    }).subscribe({
      next: (res) => {
        console.log('📦 MembersComponent: Dados brutos recebidos:', res);
        // Filtra transações de mensalidade do mês atual (que não estejam deletadas)
        const currentMensalidades = res.transactions.filter(t => 
          !t.deleted && 
          t.category === 'MENSALIDADE' && 
          t.refMonth === curMonth && 
          t.refYear === curYear
        );

        this.allMembers = res.members;
        this.roles = [...new Set(res.members.map(m => m.role))].sort();
        this.totalActive = res.members.filter(m => !m.deleted && m.status === 'Ativo').length;

        // Processa cada membro para injetar o status financeiro
        this.allMembers = res.members.map(m => {
          let financeStatus = '-';
          let financeClass = '';

          if (m.status === 'Ativo' && !m.deleted) {
            const isPaid = currentMensalidades.some(t => t.memberId === m.id);
            const isExempt = (m as any).isExempt === true;

            if (isExempt) {
              financeStatus = 'Isento';
              financeClass = 'status-exempt';
            } else if (isPaid) {
              financeStatus = 'Pago';
              financeClass = 'status-paid';
            } else {
              financeStatus = 'Atrasado';
              financeClass = 'status-late';
            }
          }

          return { ...m, financeStatus, financeClass };
        });

        this.applyFilter();
      },
      error: (e: any) => this.notify.showError('Erro ao carregar dados.')
    });
  }

  applyFilter() {
    let filtered = this.allMembers;

    if (this.statusFilter) {
      filtered = filtered.filter(m => m.status === this.statusFilter);
    }

    if (this.roleFilter) {
      filtered = filtered.filter(m => m.role === this.roleFilter);
    }

    this.members = filtered;
  }

  exportMembers() {
    const columns = [
      { key: 'name', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'role', label: 'Função' },
      { key: 'status', label: 'Status' },
      { key: 'financeStatus', label: 'Financeiro (Mês Atual)' },
      { key: 'entryDate', label: 'Data de Entrada' },
      { key: 'address.city', label: 'Cidade' },
      { key: 'address.state', label: 'UF' }
    ];
    this.exportService.exportToCsv(this.exportData, 'membros_temfe', columns);
  }


  // --- AÇÕES COM TRY/CATCH E NAVEGAÇÃO ---

  openRegisterDialog() {
    try {
      this.router.navigate(['/members/new']);
    } catch (e: any) {
      this.notify.showError('Erro ao abrir formulário: ' + e.message);
    }
  }

  onEdit(member: Member) {
    try {
      if (!member.id) throw new Error('Membro sem ID inválido.');
      this.router.navigate(['/members/edit', member.id]);
    } catch (e: any) {
      this.notify.showError('Erro ao abrir edição: ' + e.message);
    }
  }

  onDelete(member: Member) {
    this.membersService.softDelete(member.id).subscribe({
      next: () => {
        this.notify.showSuccess('Membro movido para a lixeira.');
        this.loadData();
      },
      error: (e: any) => this.notify.showError('Erro ao excluir: ' + e.message)
    });
  }

  onRestore(member: Member) {
    this.membersService.restore(member.id).subscribe({
      next: () => {
        this.notify.showSuccess('Membro restaurado!');
        this.loadData();
      },
      error: (e: any) => this.notify.showError('Erro ao restaurar: ' + e.message)
    });
  }
}