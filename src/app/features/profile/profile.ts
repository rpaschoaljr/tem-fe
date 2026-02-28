import { Component, inject, OnInit, HostListener } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Auth, updateProfile, updateEmail } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, collection, query, where, getDocs, limit } from '@angular/fire/firestore';
import { NotificationService } from '../../core/services/notification.service';
import { Member } from '../../core/models/member.model';
import { ComponentCanDeactivate } from '../../core/guards/pending-changes.guard';
import { Observable } from 'rxjs';
import { ImageCropperDialogComponent } from '../../shared/components/image-cropper-dialog/image-cropper-dialog';

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
  private fb = inject(FormBuilder);
  private storage = inject(Storage);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);

  member: Member | null = null;
  loading = true;

  personalDataForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: this.fb.group({
      cep: [''],
      street: [''],
      number: [''],
      complement: [''],
      neighborhood: [''],
      city: [''],
      state: ['']
    })
  });

  profileImageUrl: string = '';

  @HostListener('window:beforeunload')
  canDeactivate(): boolean | Observable<boolean> {
    if (this.personalDataForm.dirty) {
      return confirm('Você tem alterações não salvas. Deseja realmente sair sem salvar?');
    }
    return true;
  }

  ngOnInit(): void {
    this.loadUserData();
  }

  async loadUserData() {
    this.loading = true;
    const user = this.auth.currentUser;
    
    if (user && user.email) {
      try {
        const colRef = collection(this.firestore, 'members');
        const q = query(colRef, where('email', '==', user.email), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty) {
          this.member = { ...snap.docs[0].data(), id: snap.docs[0].id } as Member;
          
          this.personalDataForm.patchValue({
            email: this.member.email,
            phone: this.member.phone,
            address: this.member.address as any
          });
          this.personalDataForm.markAsPristine();
          
          this.profileImageUrl = this.member.photoUrl || user.photoURL || '';
        } else {
          this.notification.showError('Perfil não encontrado no cadastro de membros.');
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        this.notification.showError('Erro ao carregar seus dados.');
      }
    }
    this.loading = false;
  }

  async savePersonalData() {
    if (!this.member || this.personalDataForm.invalid) return;

    const user = this.auth.currentUser;
    const formData = this.personalDataForm.getRawValue();

    try {
      const memberDocRef = doc(this.firestore, `members/${this.member.id}`);
      
      const updateData = {
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        updatedAt: new Date()
      };

      await updateDoc(memberDocRef, updateData);
      this.personalDataForm.markAsPristine();

      if (user && user.email !== formData.email) {
        try {
          await updateEmail(user, formData.email!);
        } catch (authError: any) {
          if (authError.code === 'auth/requires-recent-login') {
            this.notification.showWarning('E-mail atualizado no cadastro, mas para atualizar o login é necessário sair e entrar novamente.');
          }
        }
      }

      this.notification.showSuccess('Dados atualizados com sucesso!');
    } catch (error) {
      console.error('Error updating personal data: ', error);
      this.notification.showError('Erro ao atualizar os dados.');
    }
  }

  async onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0 && this.member) {
      const dialogRef = this.dialog.open(ImageCropperDialogComponent, {
        data: { event },
        width: '500px',
        maxWidth: '90vw'
      });

      dialogRef.afterClosed().subscribe(async (result: Blob | undefined) => {
        if (result) {
          try {
            this.loading = true;
            const storageRef = ref(this.storage, `profile-pictures/${this.member!.id}`);

            // Define o tipo do arquivo como image/webp pois o cropper está configurado para esse formato
            const uploadResult = await uploadBytes(storageRef, result, { contentType: 'image/webp' });
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const memberDocRef = doc(this.firestore, `members/${this.member!.id}`);
            await updateDoc(memberDocRef, { photoUrl: downloadURL, updatedAt: new Date() });

            const user = this.auth.currentUser;
            if (user) {
              await updateProfile(user, { photoURL: downloadURL });
            }

            this.profileImageUrl = downloadURL;
            this.notification.showSuccess('Foto de perfil atualizada!');
          } catch (error) {
            console.error('Error uploading image: ', error);
            this.notification.showError('Erro ao salvar a foto.');
          } finally {
            this.loading = false;
          }
        }
        // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
        event.target.value = '';
      });
    }
  }

  getRitualsList() {
    if (!this.member?.rituals) return [];
    const labels: { [key: string]: string } = {
      initiation: 'Iniciação / Lavagem',
      baptism: 'Batismo',
      baptism1Year: 'Batismo 1 Ano',
      coronation: 'Coroação',
      crownWashing: 'Lavagem de Coroa'
    };
    return Object.entries(this.member.rituals)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => ({ label: labels[key] || key, date: value }));
  }

  getConsecrationsList() {
    if (!this.member?.consecrations) return [];
    return Object.entries(this.member.consecrations)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => ({ orixa: key.toUpperCase(), date: value }));
  }
}
