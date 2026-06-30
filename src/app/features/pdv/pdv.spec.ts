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

  it('should sort products placing unavailable items (quantity <= 0 and allowBackorder false) at the end, alphabetically sorted within groups', () => {
    component.products = [
      { id: '1', name: 'Zebra (Disponível)', category: 'Outros', quantity: 5, unit: 'un', deleted: false, updatedAt: new Date() },
      { id: '2', name: 'Alface (Sem Estoque, Não Encomenda)', category: 'Outros', quantity: 0, allowBackorder: false, unit: 'un', deleted: false, updatedAt: new Date() },
      { id: '3', name: 'Banana (Sob Encomenda)', category: 'Outros', quantity: 0, allowBackorder: true, unit: 'un', deleted: false, updatedAt: new Date() },
      { id: '4', name: 'Cacau (Sem Estoque, Não Encomenda)', category: 'Outros', quantity: 0, allowBackorder: false, unit: 'un', deleted: false, updatedAt: new Date() },
      { id: '5', name: 'Abacaxi (Disponível)', category: 'Outros', quantity: 10, unit: 'un', deleted: false, updatedAt: new Date() }
    ];

    const sorted = component.filteredProducts;

    // Group A (available or backorderable): Abacaxi, Banana, Zebra
    // Group B (unavailable & no backorder): Alface, Cacau
    // Expected order: Abacaxi -> Banana -> Zebra -> Alface -> Cacau
    expect(sorted.map(s => s.name)).toEqual([
      'Abacaxi (Disponível)',
      'Banana (Sob Encomenda)',
      'Zebra (Disponível)',
      'Alface (Sem Estoque, Não Encomenda)',
      'Cacau (Sem Estoque, Não Encomenda)'
    ]);
  });
});
