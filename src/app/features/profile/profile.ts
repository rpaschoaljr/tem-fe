import { Component, inject, OnInit, HostListener, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { MembersService } from '../../core/services/members.service';
import { ConfigService } from '../../core/services/config.service';
import { LoggerService } from '../../core/services/logger.service';
import { Member } from '../../core/models/member.model';
import { DynamicField, ModuleConfig } from '../../core/models/system-config.model';
import { ComponentCanDeactivate } from '../../core/guards/pending-changes.guard';
import { Observable, of } from 'rxjs';
import { take, switchMap } from 'rxjs/operators';
import { ImageCropperDialogComponent } from '../../shared/components/image-cropper-dialog/image-cropper-dialog';
import { ChangePasswordDialogComponent } from './change-password-dialog/change-password-dialog';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDividerModule,
    MatDialogModule,
    ReactiveFormsModule
  ],
})
export class ProfileComponent implements OnInit, ComponentCanDeactivate {
  private notification = inject(NotificationService);
  private authService = inject(AuthService);
  private membersService = inject(MembersService);
  private configService = inject(ConfigService);
  private dialog = inject(MatDialog);
  private logger = inject(LoggerService);

  member = signal<Member | null>(null);
  loading = signal(true);
  
  profileConfig = signal<ModuleConfig | null>(null);
  profileSections = signal<string[]>([]);

  profileImageUrl: string = '';

  @HostListener('window:beforeunload')
  canDeactivate(): boolean | Observable<boolean> {
    return true; 
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    
    this.configService.getConfig('members').subscribe(config => {
      this.profileConfig.set(config);
      
      const sections = config.fields
        .filter(f => f.showInProfile && !f.deleted)
        .map(f => f.section || 'Informações Gerais');
      
      this.profileSections.set([...new Set(sections)].sort((a, b) => {
        const order = ['Dados Pessoais', 'Endereço', 'Vida Espiritual', 'Rituais', 'Consagrações (Orixás)', 'Informações Adicionais'];
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      }));

      this.loadMember();
    });
  }

  loadMember() {
    this.authService.member$.pipe(
      take(1),
      switchMap(member => {
        if (member && member.id) {
          return this.membersService.getById(member.id);
        }
        return of(undefined);
      })
    ).subscribe({
      next: (fullMember) => {
        if (fullMember) {
          this.member.set(fullMember);
          this.profileImageUrl = fullMember.photoUrl || '';
        } else {
          this.notification.showError('Perfil não encontrado no cadastro.');
        }
        this.loading.set(false);
      },
      error: (error) => {
        this.logger.error('Erro ao carregar dados do perfil', error);
        this.notification.showError('Erro ao carregar dados do perfil.');
        this.loading.set(false);
      }
    });
  }

  getFieldsBySection(section: string): DynamicField[] {
    return this.profileConfig()?.fields
      .filter(f => f.showInProfile && !f.deleted && (f.section || 'Informações Gerais') === section)
      .sort((a, b) => a.order - b.order) || [];
  }

  getFieldValue(field: DynamicField): string | null {
    const m = this.member();
    if (!m) return null;

    const memberRecord = m as unknown as Record<string, unknown>;
    const val = memberRecord[field.key] ?? 
                (m.address as Record<string, unknown>)?.[field.key] ?? 
                (m.rituals as Record<string, unknown>)?.[field.key] ?? 
                (m.consecrations as Record<string, unknown>)?.[field.key] ?? 
                (m.customFields as Record<string, unknown>)?.[field.key];
    
    if (field.type === 'date' && val) {
      return new Date(val as string).toLocaleDateString('pt-BR');
    }
    if (field.type === 'boolean') {
      return val ? 'Sim' : 'Não';
    }
    return val ? String(val) : '-';
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.member()) {
      const dialogRef = this.dialog.open(ImageCropperDialogComponent, {
        data: { event },
        width: '500px',
        maxWidth: '90vw'
      });

      dialogRef.afterClosed().subscribe((result: Blob | undefined) => {
        if (result) {
          this.loading.set(true);
          this.membersService.uploadProfilePicture(this.member()!.id, result).subscribe({
            next: (downloadURL) => {
              this.profileImageUrl = downloadURL;
              this.notification.showSuccess('Foto de perfil atualizada!');
              this.loadMember();
            },
            error: (error) => {
              this.logger.error('Erro ao fazer upload da imagem', error);
              this.notification.showError('Erro ao salvar a foto.');
              this.loading.set(false);
            }
          });
        }
        input.value = '';
      });
    }
  }

  openChangePassword() {
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '100%',
      maxWidth: '400px'
    });
  }
}
