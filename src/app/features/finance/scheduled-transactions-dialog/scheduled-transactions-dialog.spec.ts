import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScheduledTransactionsDialogComponent } from './scheduled-transactions-dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ScheduledTransactionsService } from '../../../core/services/scheduled-transactions.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';
import { of, throwError } from 'rxjs';
import { ScheduledTransaction } from '../../../core/models/scheduled-transaction.model';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('ScheduledTransactionsDialogComponent', () => {
  let component: ScheduledTransactionsDialogComponent;
  let fixture: ComponentFixture<ScheduledTransactionsDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<ScheduledTransactionsDialogComponent>>;
  let dialogSpy: jasmine.SpyObj<MatDialog>;
  let serviceSpy: jasmine.SpyObj<ScheduledTransactionsService>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;
  let loggerSpy: jasmine.SpyObj<LoggerService>;

  const mockSchedules: ScheduledTransaction[] = [
    {
      id: '1',
      description: 'Test Entrada',
      type: 'Entrada',
      category: 'TESTE',
      value: 100,
      recurrence: 'monthly',
      dayOfMonth: 10,
      nextDueDate: new Date('2023-01-01'),
      active: true,
      deleted: false
    },
    {
      id: '2',
      description: 'Test Saída',
      type: 'Saída',
      category: 'TESTE2',
      value: 50,
      recurrence: 'weekly',
      nextDueDate: new Date('2023-01-02'),
      active: true,
      deleted: false
    }
  ];

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    serviceSpy = jasmine.createSpyObj('ScheduledTransactionsService', ['getAll', 'save', 'softDelete', 'restore']);
    serviceSpy.getAll.and.returnValue(of(mockSchedules));
    serviceSpy.save.and.returnValue(of(true as any));
    serviceSpy.softDelete.and.returnValue(of(true as any));
    serviceSpy.restore.and.returnValue(of(true as any));

    notificationSpy = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    loggerSpy = jasmine.createSpyObj('LoggerService', ['log', 'error']);

    await TestBed.configureTestingModule({
      imports: [ScheduledTransactionsDialogComponent, NoopAnimationsModule, MatDialogModule],
      providers: [
        provideFirebaseMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ScheduledTransactionsService, useValue: serviceSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: LoggerService, useValue: loggerSpy }
      ]
    })
    .overrideProvider(MatDialog, { useValue: dialogSpy })
    .compileComponents();

    fixture = TestBed.createComponent(ScheduledTransactionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data and map values correctly', () => {
    expect(component.schedules.length).toBe(2);
    expect(component.schedules[0].value).toBe(100);
    expect(component.schedules[0].recurrenceLabel).toBe('Mensal');
    expect(component.schedules[1].value).toBe(-50); // Saída maps to negative value
    expect(component.schedules[1].recurrenceLabel).toBe('Semanal');
  });

  it('should handle error on loadData', () => {
    serviceSpy.getAll.and.returnValue(throwError(() => new Error('Error')));
    component.loadData();
    expect(loggerSpy.error).toHaveBeenCalled();
    expect(notificationSpy.showError).toHaveBeenCalledWith('Erro ao carregar agendamentos.');
  });

  it('should open new dialog and save', () => {
    const dialogRefReturnSpy = jasmine.createSpyObj({ afterClosed: of(mockSchedules[0]) });
    dialogSpy.open.and.returnValue(dialogRefReturnSpy);
    
    component.onNew();
    
    expect(dialogSpy.open).toHaveBeenCalled();
    expect(serviceSpy.save).toHaveBeenCalled();
    expect(notificationSpy.showSuccess).toHaveBeenCalledWith('Agendamento criado!');
  });

  it('should handle error on new save', () => {
    const dialogRefReturnSpy = jasmine.createSpyObj({ afterClosed: of(mockSchedules[0]) });
    dialogSpy.open.and.returnValue(dialogRefReturnSpy);
    serviceSpy.save.and.returnValue(throwError(() => new Error('Save error')));
    
    component.onNew();
    
    expect(notificationSpy.showError).toHaveBeenCalledWith('Erro: Save error');
  });

  it('should open edit dialog and save', () => {
    const dialogRefReturnSpy = jasmine.createSpyObj({ afterClosed: of(mockSchedules[0]) });
    dialogSpy.open.and.returnValue(dialogRefReturnSpy);
    
    component.onEdit(component.schedules[0]);
    
    expect(dialogSpy.open).toHaveBeenCalled();
    expect(serviceSpy.save).toHaveBeenCalled();
    expect(notificationSpy.showSuccess).toHaveBeenCalledWith('Agendamento atualizado!');
  });

  it('should handle error on edit save', () => {
    const dialogRefReturnSpy = jasmine.createSpyObj({ afterClosed: of(mockSchedules[0]) });
    dialogSpy.open.and.returnValue(dialogRefReturnSpy);
    serviceSpy.save.and.returnValue(throwError(() => new Error('Save error')));
    
    component.onEdit(component.schedules[0]);
    
    expect(notificationSpy.showError).toHaveBeenCalledWith('Erro: Save error');
  });

  it('should delete schedule', () => {
    component.onDelete(component.schedules[0]);
    expect(serviceSpy.softDelete).toHaveBeenCalledWith('1');
    expect(notificationSpy.showSuccess).toHaveBeenCalledWith('Agendamento removido.');
  });

  it('should handle error on delete', () => {
    serviceSpy.softDelete.and.returnValue(throwError(() => new Error('Delete error')));
    component.onDelete(component.schedules[0]);
    expect(notificationSpy.showError).toHaveBeenCalledWith('Erro: Delete error');
  });

  it('should restore schedule', () => {
    component.onRestore(component.schedules[0]);
    expect(serviceSpy.restore).toHaveBeenCalledWith('1');
    expect(notificationSpy.showSuccess).toHaveBeenCalledWith('Agendamento restaurado!');
  });

  it('should handle error on restore', () => {
    serviceSpy.restore.and.returnValue(throwError(() => new Error('Restore error')));
    component.onRestore(component.schedules[0]);
    expect(notificationSpy.showError).toHaveBeenCalledWith('Erro: Restore error');
  });

  it('should close dialog', () => {
    component.close();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});
