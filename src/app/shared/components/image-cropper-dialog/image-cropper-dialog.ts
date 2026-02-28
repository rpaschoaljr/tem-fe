import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-cropper-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, ImageCropperComponent],
  template: `
    <h2 mat-dialog-title>Recortar Imagem</h2>
    <mat-dialog-content>
      <div class="cropper-wrapper">
        <image-cropper
          [imageChangedEvent]="data.event"
          [maintainAspectRatio]="true"
          [aspectRatio]="1 / 1"
          [resizeToWidth]="400"
          [cropperMinWidth]="200"
          [onlyScaleDown]="true"
          format="webp"
          (imageCropped)="imageCropped($event)"
          (imageLoaded)="imageLoaded($event)"
          (cropperReady)="cropperReady()"
          (loadImageFailed)="loadImageFailed()"
        ></image-cropper>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!croppedImage()">Confirmar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cropper-wrapper {
      max-height: 70vh;
      overflow: auto;
      display: flex;
      justify-content: center;
      background: #333;
    }
    image-cropper {
      max-width: 100%;
    }
  `]
})
export class ImageCropperDialogComponent {
  croppedImage = signal<Blob | null>(null);

  constructor(
    public dialogRef: MatDialogRef<ImageCropperDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { event: any }
  ) {}

  imageCropped(event: ImageCroppedEvent) {
    if (event.blob) {
      this.croppedImage.set(event.blob);
    }
  }

  imageLoaded(image: LoadedImage) {
    // show cropper
  }

  cropperReady() {
    // cropper ready
  }

  loadImageFailed() {
    // show message
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.croppedImage()) {
      this.dialogRef.close(this.croppedImage());
    }
  }
}
