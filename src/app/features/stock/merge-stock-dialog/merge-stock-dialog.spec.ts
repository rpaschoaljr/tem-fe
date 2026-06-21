import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MergeStockDialogComponent } from './merge-stock-dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { StockItem } from '../../../core/models/stock-item.model';

describe('MergeStockDialogComponent', () => {
  let component: MergeStockDialogComponent;
  let fixture: ComponentFixture<MergeStockDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<MergeStockDialogComponent>>;

  const mockItems: StockItem[] = [
    {
      id: '1',
      name: 'Café Melitta',
      category: 'ALIMENTOS',
      unit: 'UN',
      quantity: 5,
      minStock: 2,
      updatedAt: new Date(),
      deleted: false
    },
    {
      id: '2',
      name: 'Café Pelé',
      category: 'ALIMENTOS',
      unit: 'UN',
      quantity: 10,
      minStock: 1,
      updatedAt: new Date(),
      deleted: false
    }
  ];

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [MergeStockDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: { items: mockItems } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MergeStockDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize controls as invalid', () => {
    expect(component.sourceControl.invalid).toBeTrue();
    expect(component.targetControl.invalid).toBeTrue();
  });

  it('should make source control valid when filled', () => {
    component.sourceControl.setValue('1');
    expect(component.sourceControl.valid).toBeTrue();
  });

  it('should return sourceId and targetId on confirm', () => {
    component.sourceControl.setValue('1');
    component.targetControl.setValue('2');
    
    component.confirm();
    
    expect(dialogRefSpy.close).toHaveBeenCalledWith({
      sourceId: '1',
      targetId: '2'
    });
  });
});
