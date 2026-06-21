import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ScheduledTransaction, RECURRENCE_LABELS } from '../../../core/models/scheduled-transaction.model';

export interface DueSchedulesDialogData {
    schedules: ScheduledTransaction[];
}

@Component({
    selector: 'app-due-schedules-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatListModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
<h2 mat-dialog-title>
    <mat-icon color="warn" style="vertical-align: middle; margin-right: 8px;">alarm</mat-icon>
    {{ data.schedules.length }} Agendamento(s) Pendente(s)
</h2>
<mat-dialog-content>
    <p style="opacity:0.7; margin-bottom: 12px;">Os seguintes lançamentos agendados estão vencidos. Deseja lançá-los agora?</p>
    <mat-list>
        <mat-list-item *ngFor="let s of data.schedules">
            <mat-icon matListItemIcon [color]="s.type === 'Entrada' ? 'primary' : 'warn'">
                {{ s.type === 'Entrada' ? 'arrow_upward' : 'arrow_downward' }}
            </mat-icon>
            <div matListItemTitle>{{ s.description }}</div>
            <div matListItemLine>{{ s.value | currency:'BRL' }} · {{ recurrenceLabel(s) }} · Venceu em {{ s.nextDueDate | date:'dd/MM/yyyy' }}</div>
        </mat-list-item>
    </mat-list>
</mat-dialog-content>
<mat-dialog-actions align="end">
    <button mat-button [mat-dialog-close]="false">IGNORAR</button>
    <button mat-raised-button color="primary" [mat-dialog-close]="true">
        <mat-icon>play_arrow</mat-icon> LANÇAR AGORA
    </button>
</mat-dialog-actions>
    `
})
export class DueSchedulesDialogComponent {
    constructor(@Inject(MAT_DIALOG_DATA) public data: DueSchedulesDialogData) {}

    recurrenceLabel(s: ScheduledTransaction): string {
        return RECURRENCE_LABELS[s.recurrence];
    }
}
