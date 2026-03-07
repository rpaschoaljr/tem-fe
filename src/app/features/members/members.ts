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
  private notify = inject(NotificationService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private exportService = inject(ExportService);

  allMembers: Member[] = [];
  members: Member[] = [];
  exportData: Member[] = []; // Dados filtrados prontos para exportar
  totalActive = 0;
  canWrite$ = this.authService.hasPermission('members', 'write');

  statusFilter = 'Ativo';
  roleFilter = '';
  roles: string[] = [];

  tableColumns: ColumnDef[] = [
    { def: 'name', label: 'Nome' },
    { def: 'role', label: 'Função', hideOnMobile: true },
    { def: 'phone', label: 'Whatsapp', hideOnMobile: true },
    { def: 'status', label: 'Status' }
  ];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.membersService.getMembers().subscribe({
      next: (data) => {
        this.allMembers = data;
        this.roles = [...new Set(data.map(m => m.role))].sort();
        this.totalActive = data.filter(m => !m.deleted && m.status === 'Ativo').length;
        this.applyFilter();
      },
      error: (e: any) => this.notify.showError('Erro ao carregar lista de membros.')
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