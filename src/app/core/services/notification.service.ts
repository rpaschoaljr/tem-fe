import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private snackBar = inject(MatSnackBar);

    showSuccess(message: string) {
        this.snackBar.open(message, 'OK', {
            duration: 3000,
            panelClass: ['success-snackbar'], // Podemos estilizar depois
            horizontalPosition: 'right',
            verticalPosition: 'top'
        });
    }

    showError(message: string) {
        this.snackBar.open(message, 'FECHAR', {
            duration: 5000,
            panelClass: ['error-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}