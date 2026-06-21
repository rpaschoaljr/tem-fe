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
import { LoggerService } from '../../core/services/logger.service';

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
  private logger = inject(LoggerService);

  allMembers: (Member & { financeStatus?: string; financeClass?: string })[] = [];
  members: (Member & { financeStatus?: string; financeClass?: string })[] = [];
  exportData: (Member & { financeStatus?: string; financeClass?: string })[] = []; 
  totalActive = 0;
  canWrite$ = this.authService.hasPermission('members', 'write');

  searchTerm = '';
  statusFilter = 'Ativo';
  roleFilter = '';
  roles: string[] = [];

  tableColumns: ColumnDef[] = [
    { def: 'name', label: 'Nome' },
    { def: 'role', label: 'Função', hideOnMobile: true },
    { def: 'status', label: 'Status', hideOnMobile: true }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const curMonth = new Date().getMonth();
    const curYear = new Date().getFullYear();

    combineLatest({
      members: this.membersService.getMembers(),
      canWriteFinance: this.authService.hasPermission('finance', 'write')
    }).subscribe({
      next: (res) => {
        this.logger.debug('Dados de membros carregados', { membersCount: res.members.length });

        // Ajusta as colunas dinamicamente
        const hasFinanceCol = this.tableColumns.some(c => c.def === 'financeStatus');
        if (res.canWriteFinance && !hasFinanceCol) {
          this.tableColumns = [...this.tableColumns, { def: 'financeStatus', label: 'Financeiro', type: 'status', hideOnMobile: true }];
        } else if (!res.canWriteFinance && hasFinanceCol) {
          this.tableColumns = this.tableColumns.filter(c => c.def !== 'financeStatus');
        }

        this.roles = [...new Set(res.members.map(m => m.role).filter((role): role is string => !!role))].sort();
        this.totalActive = res.members.filter(m => !m.deleted && m.status === 'Ativo').length;

        // Se puder escrever no financeiro, busca transações para cruzar dados
        if (res.canWriteFinance) {
          this.financeService.getTransactions().subscribe({
            next: (transactions) => {
              const currentMensalidades = transactions.filter(t => 
                !t.deleted && 
                t.category === 'MENSALIDADE' && 
                t.refMonth === curMonth && 
                t.refYear === curYear
              );
              this.mapMembersData(res.members as Member[], currentMensalidades, true);
            },
            error: (e) => {
              this.logger.error('Erro ao carregar dados financeiros', e);
              this.mapMembersData(res.members as Member[], [], false);
            }
          });
        } else {
          // Não tem permissão, apenas carrega os membros
          this.mapMembersData(res.members as Member[], [], false);
        }
      },
      error: (e: unknown) => {
        this.logger.error('Erro ao carregar dados de membros', e);
        this.notify.showError('Erro ao carregar dados.');
      }
    });
  }

  private mapMembersData(members: Partial<Member>[], currentMensalidades: any[], showFinance: boolean) {
    this.allMembers = members.map(m => {
      let financeStatus = '-';
      let financeClass = '';

      if (showFinance && m.status === 'Ativo' && !m.deleted) {
        const isPaid = currentMensalidades.some(t => t.memberId === m.id);
        const isExempt = m.isExempt ?? false;

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

      return { ...m, financeStatus, financeClass } as Member & { financeStatus?: string; financeClass?: string };
    });

    this.applyFilter();
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
    const columns: any[] = [
      { key: 'name', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'role', label: 'Função' },
      { key: 'status', label: 'Status' },
      { key: 'entryDate', label: 'Data de Entrada' },
      { key: 'address.city', label: 'Cidade' },
      { key: 'address.state', label: 'UF' }
    ];

    if (this.tableColumns.some(c => c.def === 'financeStatus')) {
      columns.splice(5, 0, { key: 'financeStatus', label: 'Financeiro (Mês Atual)' });
    }

    this.exportService.exportToCsv(this.exportData, 'membros_temfe', columns);
  }

  openRegisterDialog() {
    try {
      this.router.navigate(['/members/new']);
    } catch (e: unknown) {
      this.logger.error('Erro ao abrir formulário de membro', e);
      this.notify.showError('Erro ao abrir formulário: ' + (e instanceof Error ? e.message : ''));
    }
  }

  onEdit(member: Partial<Member>) {
    try {
      if (!member.id) throw new Error('Membro sem ID inválido.');
      this.router.navigate(['/members/edit', member.id]);
    } catch (e: unknown) {
      this.logger.error('Erro ao abrir edição de membro', e);
      this.notify.showError('Erro ao abrir edição: ' + (e instanceof Error ? e.message : ''));
    }
  }

  onDelete(member: Partial<Member>) {
    if (!member.id) return;
    this.membersService.softDelete(member.id).subscribe({
      next: () => {
        this.notify.showSuccess('Membro movido para a lixeira.');
        this.loadData();
      },
      error: (e: unknown) => {
        this.logger.error('Erro ao excluir membro', e);
        this.notify.showError('Erro ao excluir: ' + (e instanceof Error ? e.message : ''));
      }
    });
  }

  onRestore(member: Partial<Member>) {
    if (!member.id) return;
    this.membersService.restore(member.id).subscribe({
      next: () => {
        this.notify.showSuccess('Membro restaurado!');
        this.loadData();
      },
      error: (e: unknown) => {
        this.logger.error('Erro ao restaurar membro', e);
        this.notify.showError('Erro ao restaurar: ' + (e instanceof Error ? e.message : ''));
      }
    });
  }
}
