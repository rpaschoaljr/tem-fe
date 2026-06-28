import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Pdv } from './pdv';
import { StockService } from '../../core/services/stock.service';
import { PdvService } from '../../core/services/pdv.service';
import { ConfigService } from '../../core/services/config.service';

describe('Pdv', () => {
  let component: Pdv;
  let fixture: ComponentFixture<Pdv>;

  beforeEach(async () => {
    const stockSpy = jasmine.createSpyObj('StockService', ['getStock']);
    stockSpy.getStock.and.returnValue(of([]));
    
    const pdvSpy = jasmine.createSpyObj('PdvService', ['getSales', 'checkout']);
    pdvSpy.getSales.and.returnValue(of([]));

    const configSpy = jasmine.createSpyObj('ConfigService', ['getConfig']);
    configSpy.getConfig.and.returnValue(of({ fields: [] }));

    await TestBed.configureTestingModule({
      imports: [Pdv],
      providers: [
        { provide: StockService, useValue: stockSpy },
        { provide: PdvService, useValue: pdvSpy },
        { provide: ConfigService, useValue: configSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Pdv);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
