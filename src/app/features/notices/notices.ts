import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NoticesService } from '../../core/services/notices.service';
import { Notice } from '../../core/models/notice.model';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NoticeFormComponent } from './notice-form/notice-form';

@Component({
  selector: 'app-notices',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './notices.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './notices.scss'
})
export class NoticesComponent implements OnInit {
  private noticesService = inject(NoticesService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  canWrite$ = this.authService.hasPermission('notices', 'write');

  viewMode: 'active' | 'archive' | 'trash' = 'active';
  notices: Notice[] = [];
  displayedColumns = ['type', 'title', 'date', 'expiration', 'actions'];

  ngOnInit() {
    this.route.url.subscribe(url => {
      if (url.some(segment => segment.path === 'archive')) {
        this.viewMode = 'archive';
      } else if (url.some(segment => segment.path === 'trash')) {
        this.viewMode = 'trash';
      } else {
        this.viewMode = 'active';
      }
      this.loadNotices();
    });
  }

  loadNotices() {
    let obs;
    switch(this.viewMode) {
      case 'archive': obs = this.noticesService.getArchivedNotices(); break;
      case 'trash': obs = this.noticesService.getDeletedNotices(); break;
      default: obs = this.noticesService.getNotices(); break;
    }
    
    obs.subscribe(data => this.notices = data);
  }

  openForm(notice?: Notice) {
    const dialogRef = this.dialog.open(NoticeFormComponent, {
      width: '500px',
      data: notice ? { ...notice } : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadNotices();
        this.snack.open('Aviso salvo com sucesso!', 'OK', { duration: 3000 });
      }
    });
  }

  deleteNotice(id: string) {
    if (confirm('Tem certeza que deseja mover este aviso para a lixeira?')) {
      this.noticesService.softDelete(id).subscribe({
        next: () => {
          this.loadNotices();
          this.snack.open('Aviso movido para a lixeira.', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open('Erro: Acesso negado ou aviso inválido.', 'OK', { duration: 3000 });
        }
      });
    }
  }

  restoreNotice(id: string) {
    this.noticesService.restore(id).subscribe({
      next: () => {
        this.loadNotices();
        this.snack.open('Aviso restaurado.', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snack.open('Erro: Acesso negado ou aviso inválido.', 'OK', { duration: 3000 });
      }
    });
  }

  hardDeleteNotice(id: string) {
    if (confirm('ATENÇÃO: Esta ação é permanente e não pode ser desfeita. Excluir definitivamente?')) {
      this.noticesService.hardDelete(id).subscribe({
        next: () => {
          this.loadNotices();
          this.snack.open('Aviso excluído permanentemente.', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open('Erro: Acesso negado.', 'OK', { duration: 3000 });
        }
      });
    }
  }

  getIconForType(type: string): string {
    switch (type) {
      case 'event': return 'event';
      case 'payment': return 'payments';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  back() {
    this.router.navigate(['/dashboard']);
  }

  navigate(path: string) {
    this.router.navigate(['/notices' + (path ? '/' + path : '')]);
  }
}
