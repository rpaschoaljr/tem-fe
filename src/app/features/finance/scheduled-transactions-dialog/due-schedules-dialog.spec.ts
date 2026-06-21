import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DueSchedulesDialogComponent, DueSchedulesDialogData } from './due-schedules-dialog';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ScheduledTransaction } from '../../../core/models/scheduled-transaction.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('DueSchedulesDialogComponent', () => {
  let component: DueSchedulesDialogComponent;
  let fixture: ComponentFixture<DueSchedulesDialogComponent>;

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

  const dialogData: DueSchedulesDialogData = { schedules: mockSchedules };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DueSchedulesDialogComponent, MatDialogModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DueSchedulesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display correct number of schedules', () => {
    expect(component.data.schedules.length).toBe(2);
  });

  it('should return correct recurrence label', () => {
    expect(component.recurrenceLabel(mockSchedules[0])).toBe('Mensal');
    expect(component.recurrenceLabel(mockSchedules[1])).toBe('Semanal');
  });
});
