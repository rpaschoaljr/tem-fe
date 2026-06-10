import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { FinanceComponent } from './finance';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { FinanceService } from '../../core/services/finance.service';
import { ScheduledTransactionsService } from '../../core/services/scheduled-transactions.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ExportService } from '../../core/services/export.service';
import { LoggerService } from '../../core/services/logger.service';

describe('FinanceComponent', () => {
  let component: FinanceComponent;
  let fixture: ComponentFixture<FinanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceComponent],
      providers: [
        provideFirebaseMocks(),
        { provide: FinanceService, useValue: { getTransactions: () => of([]) } },
        { provide: ScheduledTransactionsService, useValue: { getDue: () => of([]) } },
        { provide: AuthService, useValue: { hasPermission: () => of(false), member$: of(null), isAdmin$: () => of(false) } },
        { provide: NotificationService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: ExportService, useValue: {} },
        { provide: LoggerService, useValue: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
