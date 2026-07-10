import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DashboardComponent } from './dashboard';
import { Router } from '@angular/router';
import { MembersService } from '../../core/services/members.service';
import { FinanceService } from '../../core/services/finance.service';
import { StockService } from '../../core/services/stock.service';
import { NoticesService } from '../../core/services/notices.service';
import { AuthService } from '../../core/services/auth.service';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as auth from '@angular/fire/auth';
import { FbUtils } from '../../shared/utils/firebase-utils';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockMembersService: jasmine.SpyObj<MembersService>;
  let mockFinanceService: jasmine.SpyObj<FinanceService>;
  let mockStockService: jasmine.SpyObj<StockService>;
  let mockNoticesService: jasmine.SpyObj<NoticesService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockMembersService = jasmine.createSpyObj('MembersService', ['getMembers']);
    mockFinanceService = jasmine.createSpyObj('FinanceService', ['getTransactions']);
    mockStockService = jasmine.createSpyObj('StockService', ['getStock']);
    mockNoticesService = jasmine.createSpyObj('NoticesService', ['getActiveNotices']);
    mockAuthService = jasmine.createSpyObj('AuthService', ['canManageNotices', 'hasPermission', 'logout', 'getMyDuesStatus'], {
      member$: of(null)
    });

    mockMembersService.getMembers.and.returnValue(of([
      { id: '1', name: 'A', deleted: false } as any,
      { id: '2', name: 'B', deleted: true } as any
    ]));
    mockFinanceService.getTransactions.and.returnValue(of([
      { id: '1', value: 100, deleted: false } as any,
      { id: '2', value: -50, deleted: false } as any,
      { id: '3', value: 200, deleted: true } as any
    ]));
    mockStockService.getStock.and.returnValue(of([
      { id: '1', quantity: 0, deleted: false } as any,
      { id: '2', quantity: 10, deleted: false } as any,
      { id: '3', quantity: 0, deleted: true } as any
    ]));
    mockNoticesService.getActiveNotices.and.returnValue(of([]));
    mockAuthService.canManageNotices.and.returnValue(of(true));
    mockAuthService.hasPermission.and.returnValue(of(true));
    mockAuthService.logout.and.returnValue(of(undefined));
    mockAuthService.getMyDuesStatus.and.returnValue(of({ status: 'ok', alertMsg: '' }));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: Router, useValue: mockRouter },
        { provide: MembersService, useValue: mockMembersService },
        { provide: FinanceService, useValue: mockFinanceService },
        { provide: StockService, useValue: mockStockService },
        { provide: NoticesService, useValue: mockNoticesService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize KPIs on ngOnInit', () => {
    component.ngOnInit();
    expect(component.kpis.activeMembers).toBe(1);
    expect(component.kpis.balance).toBe(50);
    expect(component.kpis.outOfStock).toBe(1);
  });

  it('should navigate to path', () => {
    component.navigate('test-path');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/test-path']);
  });

  it('should get correct icon for type', () => {
    expect(component.getIconForType('event')).toBe('event');
    expect(component.getIconForType('payment')).toBe('payments');
    expect(component.getIconForType('warning')).toBe('warning');
    expect(component.getIconForType('unknown')).toBe('info');
  });

  it('should sign out and navigate to login', fakeAsync(() => {
    component.logout();
    tick();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  }));

  describe('Zero Trust / Negative Scenarios', () => {
    it('should handle members service failure gracefully', () => {
      mockMembersService.getMembers.and.returnValue(throwError(() => new Error('Permission denied')));
      component.ngOnInit();
      
      expect(component.kpis.activeMembers).toBe(0);
      expect(component.kpis.balance).toBe(50); // Others should still load
      expect(component.kpis.outOfStock).toBe(1);
    });

    it('should handle finance service failure gracefully', () => {
      mockFinanceService.getTransactions.and.returnValue(throwError(() => new Error('Permission denied')));
      component.ngOnInit();
      
      expect(component.kpis.activeMembers).toBe(1); // Others should still load
      expect(component.kpis.balance).toBe(0);
      expect(component.kpis.outOfStock).toBe(1);
    });

    it('should handle stock service failure gracefully', () => {
      mockStockService.getStock.and.returnValue(throwError(() => new Error('Permission denied')));
      component.ngOnInit();
      
      expect(component.kpis.activeMembers).toBe(1);
      expect(component.kpis.balance).toBe(50);
      expect(component.kpis.outOfStock).toBe(0); // This should fail gracefully to 0
    });
  });

  describe('Mensalidade Alerts', () => {
    it('should set status ok and no message if status is ok', () => {
      mockAuthService.getMyDuesStatus.and.returnValue(of({ status: 'ok', alertMsg: '' }));

      component.ngOnInit();
      expect(component.paymentStatus()).toBe('ok');
      expect(component.paymentAlertMsg()).toBe('');
    });

    it('should set status overdue if status is overdue', () => {
      mockAuthService.getMyDuesStatus.and.returnValue(of({
        status: 'overdue',
        alertMsg: 'Atenção: Sua mensalidade está atrasada (venceu em 10/07/2026).'
      }));

      component.ngOnInit();
      expect(component.paymentStatus()).toBe('overdue');
      expect(component.paymentAlertMsg()).toContain('atrasada');
    });

    it('should set status warning if status is warning', () => {
      mockAuthService.getMyDuesStatus.and.returnValue(of({
        status: 'warning',
        alertMsg: 'Aviso: Sua mensalidade vence em 3 dias (12/07/2026).'
      }));

      component.ngOnInit();
      expect(component.paymentStatus()).toBe('warning');
      expect(component.paymentAlertMsg()).toContain('vence em 3 dias');
    });
  });
});
