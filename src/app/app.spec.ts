import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { provideFirebaseMocks } from './core/services/firebase-testing';
import { ConfigService } from './core/services/config.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideFirebaseMocks(),
        { provide: ConfigService, useValue: { ensureInitialized: () => of(undefined) } }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

});
