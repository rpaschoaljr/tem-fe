import { Component, Inject, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { NoticesService } from '../../../core/services/notices.service';
import { Notice } from '../../../core/models/notice.model';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-notice-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar' : 'Novo' }} Aviso</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Título</mat-label>
          <input matInput formControlName="title" placeholder="Ex: Próxima Gira">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subtítulo</mat-label>
          <input matInput formControlName="subtitle" placeholder="Ex: Sexta-feira, 20h">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Conteúdo</mat-label>
          <textarea matInput formControlName="content" rows="4"></textarea>
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="type">
              <mat-option value="info">Informação</mat-option>
              <mat-option value="event">Evento / Gira</mat-option>
              <mat-option value="payment">Financeiro</mat-option>
              <mat-option value="warning">Urgente</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Expira em</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="expirationDate">
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            <mat-hint>O aviso será arquivado após esta data</mat-hint>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Cancelar</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Salvar
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .form-container { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; }
    .full-width { width: 100%; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  `]
})
export class NoticeFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private noticesService = inject(NoticesService);
  private dialogRef = inject(MatDialogRef<NoticeFormComponent>);
  private snack = inject(MatSnackBar);
  
  form: FormGroup;

  constructor(@Inject(MAT_DIALOG_DATA) public data: Notice | null) {
    this.form = this.fb.group({
      id: [data?.id || ''],
      title: [data?.title || '', Validators.required],
      subtitle: [data?.subtitle || ''],
      content: [data?.content || '', Validators.required],
      type: [data?.type || 'info', Validators.required],
      date: [data?.date || new Date()],
      expirationDate: [data?.expirationDate || null],
      deleted: [data?.deleted || false]
    });
  }

  ngOnInit() {}

  save() {
    if (this.form.valid) {
      this.noticesService.save(this.form.value).subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.snack.open('Erro ao salvar: Acesso negado ou dados inválidos.', 'OK', { duration: 4000 });
        }
      });
    }
  }

  close() {
    this.dialogRef.close();
  }
}
