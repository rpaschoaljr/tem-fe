import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceReport } from './finance-report';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { FinanceService } from '../../../core/services/finance.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

describe('FinanceReport', () => {
  let component: FinanceReport;
  let fixture: ComponentFixture<FinanceReport>;
  let mockFinance: any;

  beforeEach(async () => {
    mockFinance = jasmine.createSpyObj('FinanceService', ['getTransactions']);
    mockFinance.getTransactions.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [FinanceReport],
      providers: [
        provideFirebaseMocks(),
        provideCharts(withDefaultRegisterables()),
        { provide: FinanceService, useValue: mockFinance },
        { provide: ActivatedRoute, useValue: { snapshot: {} } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinanceReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
