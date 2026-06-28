import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SalesHistory } from './sales-history';
import { PdvService } from '../../../core/services/pdv.service';

describe('SalesHistory', () => {
  let component: SalesHistory;
  let fixture: ComponentFixture<SalesHistory>;

  beforeEach(async () => {
    const pdvSpy = jasmine.createSpyObj('PdvService', ['getSales', 'cancelSale']);
    pdvSpy.salesUpdated$ = new Subject<void>();
    pdvSpy.getSales.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SalesHistory],
      providers: [
        { provide: PdvService, useValue: pdvSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
