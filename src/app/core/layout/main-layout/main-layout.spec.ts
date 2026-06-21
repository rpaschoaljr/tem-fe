import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { MainLayoutComponent } from './main-layout';
import { provideFirebaseMocks } from '../../services/firebase-testing';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LoggerService } from '../../services/logger.service';

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideFirebaseMocks(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({}), snapshot: { params: {} }, queryParams: of({}) } },
        { provide: MatDialog, useValue: {} },
        { provide: MatSnackBar, useValue: {} },
        { provide: NotificationService, useValue: {} },
        { provide: AuthService, useValue: { hasPermission: () => of(false), member$: of(null), isAdmin$: () => of(false), permissions$: of({}) } },
        { provide: ThemeService, useValue: { darkMode: () => false, toggle: () => {} } },
        { provide: LoggerService, useValue: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
