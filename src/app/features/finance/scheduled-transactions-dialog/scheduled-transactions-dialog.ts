import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ScheduledTransactionsService } from '../../../core/services/scheduled-transactions.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ScheduledTransaction, RECURRENCE_LABELS } from '../../../core/models/scheduled-transaction.model';
import { GenericListComponent, ColumnDef } from '../../../shared/components/generic-list/generic-list';
import { ScheduledTransactionFormComponent } from '../scheduled-transaction-form/scheduled-transaction-form';

@Component({
    selector: 'app-scheduled-transactions-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        GenericListComponent
    ],
    template: `
<h2 mat-dialog-title>
    <mat-icon style="vertical-align: middle; margin-right: 8px;">schedule</mat-icon>
    Agendamentos de Lançamentos
</h2>

<mat-dialog-content style="min-width: 320px; max-width: 680px;">
    <div style="display:flex; justify-content:flex-end; margin-bottom: 12px;">
        <button mat-flat-button color="primary" (click)="onNew()">
            <mat-icon>add</mat-icon> Novo Agendamento
        </button>
    </div>

    <app-generic-list
        [data]="schedules"
        [columns]="columns"
        (editAction)="onEdit($event)"
        (deleteAction)="onDelete($event)"
        (restoreAction)="onRestore($event)">
    </app-generic-list>
</mat-dialog-content>

<mat-dialog-actions align="end">
    <button mat-button (click)="close()">FECHAR</button>
</mat-dialog-actions>
    `
})
export class ScheduledTransactionsDialogComponent implements OnInit {
    private service = inject(ScheduledTransactionsService);
    private notify = inject(NotificationService);
    private dialog = inject(MatDialog);
    private dialogRef = inject(MatDialogRef<ScheduledTransactionsDialogComponent>);

    schedules: ScheduledTransaction[] = [];

    columns: ColumnDef[] = [
        { def: 'description', label: 'Descrição' },
        { def: 'category', label: 'Categoria', hideOnMobile: true },
        { def: 'recurrenceLabel', label: 'Recorrência', hideOnMobile: true },
        { def: 'value', label: 'Valor (R$)', type: 'currency' },
        { def: 'nextDueDate', label: 'Próxima Data', type: 'date', hideOnMobile: true },
    ];

    ngOnInit() { this.loadData(); }

    loadData() {
        this.service.getAll(true).subscribe({
            next: (data) => {
                this.schedules = data.map(s => ({
                    ...s,
                    value: s.type === 'Saída' ? -Math.abs(s.value) : Math.abs(s.value),
                    recurrenceLabel: RECURRENCE_LABELS[s.recurrence]
                } as any));
            },
            error: () => this.notify.showError('Erro ao carregar agendamentos.')
        });
    }

    onNew() {
        const ref = this.dialog.open(ScheduledTransactionFormComponent, {
            data: null,
            width: '100%',
            maxWidth: '500px',
            panelClass: 'responsive-dialog'
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.service.save(result as ScheduledTransaction).subscribe({
                next: () => { this.notify.showSuccess('Agendamento criado!'); this.loadData(); },
                error: (e: any) => this.notify.showError('Erro: ' + e.message)
            });
        });
    }

    onEdit(s: ScheduledTransaction) {
        const original: ScheduledTransaction = {
            ...s,
            value: Math.abs(s.value),
        };
        const ref = this.dialog.open(ScheduledTransactionFormComponent, {
            data: original,
            width: '100%',
            maxWidth: '500px',
            panelClass: 'responsive-dialog'
        });
        ref.afterClosed().subscribe(result => {
            if (!result) return;
            this.service.save(result as ScheduledTransaction).subscribe({
                next: () => { this.notify.showSuccess('Agendamento atualizado!'); this.loadData(); },
                error: (e: any) => this.notify.showError('Erro: ' + e.message)
            });
        });
    }

    onDelete(s: ScheduledTransaction) {
        this.service.softDelete(s.id).subscribe({
            next: () => { this.notify.showSuccess('Agendamento removido.'); this.loadData(); },
            error: (e: any) => this.notify.showError('Erro: ' + e.message)
        });
    }

    onRestore(s: ScheduledTransaction) {
        this.service.restore(s.id).subscribe({
            next: () => { this.notify.showSuccess('Agendamento restaurado!'); this.loadData(); },
            error: (e: any) => this.notify.showError('Erro: ' + e.message)
        });
    }

    close() { this.dialogRef.close(); }
}
