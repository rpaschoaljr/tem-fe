import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericListComponent } from './generic-list';

describe('GenericListComponent', () => {
  let component: GenericListComponent<any>;
  let fixture: ComponentFixture<GenericListComponent<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenericListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
