import { Component, OnInit, inject } from '@angular/core';
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
import { NoticeFormComponent } from './notice-form/notice-form';
import { map } from 'rxjs/operators';

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
  styleUrl: './notices.scss'
})
export class NoticesComponent implements OnInit {
  private noticesService = inject(NoticesService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isArchive = false;
  notices: Notice[] = [];
  displayedColumns = ['type', 'title', 'date', 'expiration', 'actions'];

  ngOnInit() {
    this.route.url.subscribe(url => {
      this.isArchive = url.some(segment => segment.path === 'archive');
      this.loadNotices();
    });
  }

  loadNotices() {
    const obs = this.isArchive 
      ? this.noticesService.getArchivedNotices() 
      : this.noticesService.getNotices();
    
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
    if (confirm('Tem certeza que deseja excluir este aviso?')) {
      this.noticesService.softDelete(id).subscribe(() => {
        this.loadNotices();
        this.snack.open('Aviso excluído.', 'OK', { duration: 3000 });
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
}
