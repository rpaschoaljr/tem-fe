import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PdvCheckoutDialog } from './pdv-checkout-dialog';

describe('PdvCheckoutDialog', () => {
  let component: PdvCheckoutDialog;
  let fixture: ComponentFixture<PdvCheckoutDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdvCheckoutDialog],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: { totalAmount: 0, cart: [], paymentMethods: [] } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdvCheckoutDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
