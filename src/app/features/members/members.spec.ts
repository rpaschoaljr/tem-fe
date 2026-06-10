import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MembersComponent } from './members';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { MembersService } from '../../core/services/members.service';
import { FinanceService } from '../../core/services/finance.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ExportService } from '../../core/services/export.service';
import { LoggerService } from '../../core/services/logger.service';

describe('MembersComponent', () => {
  let component: MembersComponent;
  let fixture: ComponentFixture<MembersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersComponent],
      providers: [
        provideFirebaseMocks(),
        { provide: HttpClient, useValue: {} },
        { provide: MembersService, useValue: { getMembers: () => of([]) } },
        { provide: FinanceService, useValue: { getTransactions: () => of([]) } },
        { provide: AuthService, useValue: { hasPermission: () => of(false), member$: of(null), isAdmin$: () => of(false) } },
        { provide: NotificationService, useValue: {} },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: ExportService, useValue: {} },
        { provide: LoggerService, useValue: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
