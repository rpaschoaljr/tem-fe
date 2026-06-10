import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ScheduledTransactionsService } from '../../../core/services/scheduled-transactions.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ScheduledTransaction, RECURRENCE_LABELS } from '../../../core/models/scheduled-transaction.model';
import { GenericListComponent, ColumnDef } from '../../../shared/components/generic-list/generic-list';
import { ScheduledTransactionFormComponent } from '../scheduled-transaction-form/scheduled-transaction-form';

interface ScheduleViewModel extends ScheduledTransaction {
    recurrenceLabel: string;
}

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
    styles: [`
        .scheduled-list-wrapper {
            ::ng-deep {
                .hide-on-mobile { display: none !important; }
                table { min-width: 100% !important; }
                .mat-mdc-cell {
                    padding: 12px 8px !important;
                    white-space: normal; 
                    word-break: break-word;
                }
                .mobile-actions { display: flex !important; }
                .actions-header, .actions-cell { display: none !important; }
                
                .search-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                    .search-bar { max-width: 100%; }
                    button { align-self: flex-end; }
                }
                .mat-mdc-paginator-container { justify-content: center !important; }
                .mat-mdc-paginator-page-size {
                    margin-right: 0;
                    width: 100%;
                    justify-content: center;
                    margin-bottom: 8px;
                }
                .mat-mdc-paginator-range-actions { width: 100%; justify-content: center; }
            }
        }
    `],
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

    <div class="scheduled-list-wrapper">
        <app-generic-list
            [data]="schedules"
            [columns]="columns"
            (editAction)="onEdit($event)"
            (deleteAction)="onDelete($event)"
            (restoreAction)="onRestore($event)">
        </app-generic-list>
    </div>
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
    private logger = inject(LoggerService);

    schedules: ScheduleViewModel[] = [];

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
                }));
            },
            error: (e: unknown) => {
                this.logger.error('Erro ao carregar agendamentos', e);
                this.notify.showError('Erro ao carregar agendamentos.');
            }
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
                error: (e: unknown) => {
                    this.logger.error('Erro ao salvar agendamento', e);
                    this.notify.showError('Erro: ' + (e instanceof Error ? e.message : ''));
                }
            });
        });
    }

    onEdit(s: ScheduleViewModel) {
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
                error: (e: unknown) => {
                    this.logger.error('Erro ao salvar agendamento', e);
                    this.notify.showError('Erro: ' + (e instanceof Error ? e.message : ''));
                }
            });
        });
    }

    onDelete(s: ScheduleViewModel) {
        this.service.softDelete(s.id).subscribe({
            next: () => { this.notify.showSuccess('Agendamento removido.'); this.loadData(); },
            error: (e: unknown) => {
                this.logger.error('Erro ao excluir agendamento', e);
                this.notify.showError('Erro: ' + (e instanceof Error ? e.message : ''));
            }
        });
    }

    onRestore(s: ScheduleViewModel) {
        this.service.restore(s.id).subscribe({
            next: () => { this.notify.showSuccess('Agendamento restaurado!'); this.loadData(); },
            error: (e: unknown) => {
                this.logger.error('Erro ao restaurar agendamento', e);
                this.notify.showError('Erro: ' + (e instanceof Error ? e.message : ''));
            }
        });
    }

    close() { this.dialogRef.close(); }
}
