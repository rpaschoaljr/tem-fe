import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { StockComponent } from './stock';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { StockService } from '../../core/services/stock.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ExportService } from '../../core/services/export.service';
import { LoggerService } from '../../core/services/logger.service';

describe('StockComponent', () => {
  let component: StockComponent;
  let fixture: ComponentFixture<StockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockComponent],
      providers: [
        provideFirebaseMocks(),
        { provide: StockService, useValue: { getStock: () => of([]) } },
        { provide: AuthService, useValue: { hasPermission: () => of(false), member$: of(null), isAdmin$: () => of(false) } },
        { provide: NotificationService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: ExportService, useValue: {} },
        { provide: LoggerService, useValue: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
