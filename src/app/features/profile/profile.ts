import { Component, inject, OnInit, HostListener, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Auth, updateProfile } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { doc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { NotificationService } from '../../core/services/notification.service';
import { ConfigService } from '../../core/services/config.service';
import { LoggerService } from '../../core/services/logger.service';
import { Member } from '../../core/models/member.model';
import { DynamicField, ModuleConfig } from '../../core/models/system-config.model';
import { ComponentCanDeactivate } from '../../core/guards/pending-changes.guard';
import { Observable } from 'rxjs';
import { ImageCropperDialogComponent } from '../../shared/components/image-cropper-dialog/image-cropper-dialog';
import { ChangePasswordDialogComponent } from './change-password-dialog/change-password-dialog';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss'],
  standalone: true,
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
  private storage = inject(Storage);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private notification = inject(NotificationService);
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

  async loadMember() {
    const user = this.auth.currentUser;
    if (user && user.email) {
      try {
        const colRef = collection(this.firestore, 'members');
        const q = query(colRef, where('email', '==', user.email), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const data = snap.docs[0].data();
          this.member.set({ ...this.fixDates(data), id: snap.docs[0].id } as Member);
          this.profileImageUrl = this.member()?.photoUrl || user.photoURL || '';
        } else {
          this.notification.showError('Perfil não encontrado no cadastro.');
        }
      } catch (error) {
        this.logger.error('Erro ao carregar dados do perfil', error);
        this.notification.showError('Erro ao carregar dados do perfil.');
      }
    }
    this.loading.set(false);
  }

  private fixDates(data: Record<string, unknown>): Record<string, unknown> {
    if (!data) return data;
    const result = { ...data };
    
    const dateFields = ['createdAt', 'updatedAt', 'entryDate', 'exitDate'];
    dateFields.forEach(f => { if (result[f]) result[f] = this.fixDate(result[f]); });

    if (result['rituals']) {
      const rituals = result['rituals'] as Record<string, unknown>;
      Object.keys(rituals).forEach(k => { rituals[k] = this.fixDate(rituals[k]); });
    }
    if (result['consecrations']) {
      const consecrations = result['consecrations'] as Record<string, unknown>;
      Object.keys(consecrations).forEach(k => { consecrations[k] = this.fixDate(consecrations[k]); });
    }
    if (result['customFields']) {
      const customFields = result['customFields'] as Record<string, unknown>;
      Object.keys(customFields).forEach(k => { customFields[k] = this.fixDate(customFields[k]); });
    }
    return result;
  }

  private fixDate(val: unknown): Date | null {
    if (!val) return null;
    if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Record<string, unknown>)['toDate'] === 'function') return (val as { toDate(): Date }).toDate();
    if (val instanceof Date) return val;
    if (val && typeof val === 'object' && 'seconds' in val) return new Date((val as { seconds: number }).seconds * 1000);
    return new Date(val as string);
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

      dialogRef.afterClosed().subscribe(async (result: Blob | undefined) => {
        if (result) {
          try {
            this.loading.set(true);
            const storageRef = ref(this.storage, `profile-pictures/${this.member()!.id}`);

            const uploadResult = await uploadBytes(storageRef, result, { contentType: 'image/webp' });
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const memberDocRef = doc(this.firestore, `members/${this.member()!.id}`);
            await updateDoc(memberDocRef, { photoUrl: downloadURL, updatedAt: new Date() });

            this.profileImageUrl = downloadURL;
            this.notification.showSuccess('Foto de perfil atualizada!');
            
            this.loadMember();
          } catch (error) {
            this.logger.error('Erro ao fazer upload da imagem', error);
            this.notification.showError('Erro ao salvar a foto.');
          } finally {
            this.loading.set(false);
          }
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
