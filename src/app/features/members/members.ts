import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router'; // <--- Import Router

import { MembersService } from '../../core/services/members.service';
import { NotificationService } from '../../core/services/notification.service';
import { Member } from '../../core/models/member.model';
import { GenericListComponent, ColumnDef } from '../../shared/components/generic-list/generic-list';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatIconModule,
    MatButtonModule, GenericListComponent
  ],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class MembersComponent implements OnInit {
  private membersService = inject(MembersService);
  private notify = inject(NotificationService);
  private router = inject(Router); // <--- Injeção

  members: Member[] = [];
  totalActive = 0;

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
        this.members = data;
        this.totalActive = data.filter(m => !m.deleted).length;
      },
      error: (e: any) => this.notify.showError('Erro ao carregar lista de membros.')
    });
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