import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { MemberFormComponent } from './member-form';
import { provideFirebaseMocks } from '../../../core/services/firebase-testing';
import { MembersService } from '../../../core/services/members.service';
import { ConfigService } from '../../../core/services/config.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoggerService } from '../../../core/services/logger.service';

describe('MemberFormComponent', () => {
  let component: MemberFormComponent;
  let fixture: ComponentFixture<MemberFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberFormComponent],
      providers: [
        provideFirebaseMocks(),
        { provide: HttpClient, useValue: {} },
        { provide: ActivatedRoute, useValue: { params: of({}), snapshot: { params: {} } } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: MembersService, useValue: { getById: () => of(null), getAddressByCep: () => of(null) } },
        { provide: ConfigService, useValue: { getConfig: () => of({ fields: [], updatedAt: new Date() }), ensureInitialized: () => of(undefined) } },
        { provide: NotificationService, useValue: {} },
        { provide: LoggerService, useValue: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} } },
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
