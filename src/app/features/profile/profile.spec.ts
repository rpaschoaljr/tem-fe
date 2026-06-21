import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ProfileComponent } from './profile';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { ConfigService } from '../../core/services/config.service';
import { NotificationService } from '../../core/services/notification.service';
import { LoggerService } from '../../core/services/logger.service';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';

import { FbUtils } from '../../shared/utils/firebase-utils';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockConfigService: jasmine.SpyObj<ConfigService>;
  let mockNotification: jasmine.SpyObj<NotificationService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockAuthService: any;
  let mockMembersService: any;

  const mockUser = { id: '1', email: 'test@test.com', photoURL: 'http://test.com/photo.jpg' };
  const mockConfig = {
    id: 'members',
    fields: [
      { key: 'name', type: 'text', showInProfile: true, deleted: false, section: 'Dados Pessoais', order: 1 },
      { key: 'entryDate', type: 'date', showInProfile: true, deleted: false, section: 'Vida Espiritual', order: 2 },
      { key: 'isExempt', type: 'boolean', showInProfile: true, deleted: false, section: 'Vida Espiritual', order: 3 },
      { key: 'hiddenField', type: 'text', showInProfile: false, deleted: false, order: 4 },
      { key: 'deletedField', type: 'text', showInProfile: true, deleted: true, order: 5 }
    ]
  };

  beforeEach(async () => {
    mockConfigService = jasmine.createSpyObj('ConfigService', ['getConfig']);
    mockNotification = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError']);
    mockLogger = jasmine.createSpyObj('LoggerService', ['error']);
    mockDialog = jasmine.createSpyObj('MatDialog', ['open'], { openDialogs: [] });

    mockConfigService.getConfig.and.returnValue(of(mockConfig as any));

    mockAuthService = {
      member$: of(mockUser)
    };
    mockMembersService = jasmine.createSpyObj('MembersService', ['getById', 'uploadProfilePicture']);
    mockMembersService.getById.and.returnValue(of({ id: '1', email: 'test@test.com', name: 'Test', entryDate: new Date() } as any));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent, NoopAnimationsModule],
      providers: [
        provideFirebaseMocks(),
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationService, useValue: mockNotification },
        { provide: LoggerService, useValue: mockLogger },
        { provide: MatDialog, useValue: mockDialog },
        { provide: (await import('../../core/services/auth.service')).AuthService, useValue: mockAuthService },
        { provide: (await import('../../core/services/members.service')).MembersService, useValue: mockMembersService }
      ]
    })
    .overrideProvider(MatDialog, { useValue: mockDialog })
    .compileComponents();

    const auth = TestBed.inject(Auth);
    Object.defineProperty(auth, 'currentUser', { get: () => mockUser });
  });

  it('should create and load data on init', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of({ id: '1', email: 'test@test.com', name: 'Test', entryDate: new Date(), photoUrl: 'http://test.com/photo.jpg' } as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    expect(component).toBeTruthy();
    expect(component.profileConfig()?.id).toBe('members');
    expect(component.profileSections().length).toBe(2);
    expect(component.member()?.id).toBe('1');
    expect(component.profileImageUrl).toBe('http://test.com/photo.jpg');
  }));

  it('should show error if member not found', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of(undefined));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    expect(mockNotification.showError).toHaveBeenCalledWith('Perfil não encontrado no cadastro.');
  }));

  it('should show error if loading member fails', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(throwError(() => new Error('Db error')));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockNotification.showError).toHaveBeenCalledWith('Erro ao carregar dados do perfil.');
  }));

  it('should get fields by section', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of(undefined));
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const fields = component.getFieldsBySection('Dados Pessoais');
    expect(fields.length).toBe(1);
    expect(fields[0].key).toBe('name');
  }));

  it('should format field value correctly', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of({ id: '1', name: 'John', isExempt: true, entryDate: new Date('2023-01-01T00:00:00Z') } as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const nameField = mockConfig.fields[0];
    const dateField = mockConfig.fields[1];
    const boolField = mockConfig.fields[2];

    expect(component.getFieldValue(nameField as any)).toBe('John');
    expect(component.getFieldValue(boolField as any)).toBe('Sim');
    expect(component.getFieldValue(dateField as any)).toBeTruthy(); // Date format might depend on locale
  }));

  it('should return null for field value if member not loaded', () => {
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    expect(component.getFieldValue(mockConfig.fields[0] as any)).toBeNull();
  });

  it('should return boolean formatting false', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of({ id: '1', isExempt: false } as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const boolField = mockConfig.fields[2];
    expect(component.getFieldValue(boolField as any)).toBe('Não');
  }));

  it('should open change password dialog', () => {
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    component.openChangePassword();
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('should handle file selection and upload', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of({ id: '1', name: 'John', photoUrl: 'http://new.url' } as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const mockDialogRef = { afterClosed: () => of(new Blob(['test'], { type: 'image/webp' })) };
    mockDialog.open.and.returnValue(mockDialogRef as any);

    mockMembersService.uploadProfilePicture.and.returnValue(of('http://new.url'));

    const event = { target: { files: [new File([''], 'test.png')], value: 'path' } } as any;
    component.onFileSelected(event);
    tick();

    expect(mockMembersService.uploadProfilePicture).toHaveBeenCalled();
    expect(mockNotification.showSuccess).toHaveBeenCalledWith('Foto de perfil atualizada!');
    expect(component.profileImageUrl).toBe('http://new.url');
  }));

  it('should handle file upload failure', fakeAsync(() => {
    mockMembersService.getById.and.returnValue(of({ id: '1', name: 'John' } as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const mockDialogRef = { afterClosed: () => of(new Blob(['test'])) };
    mockDialog.open.and.returnValue(mockDialogRef as any);

    mockMembersService.uploadProfilePicture.and.returnValue(throwError(() => new Error('Upload error')));

    const event = { target: { files: [new File([''], 'test.png')], value: 'path' } } as any;
    component.onFileSelected(event);
    tick();

    expect(mockNotification.showError).toHaveBeenCalledWith('Erro ao salvar a foto.');
    expect(mockLogger.error).toHaveBeenCalled();
  }));

  it('should fix dates using fixDates', fakeAsync(() => {
    const dataWithTimestamp = {
      id: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      entryDate: new Date('2023-01-01'),
      rituals: { baptism: new Date() }
    };
    mockMembersService.getById.and.returnValue(of(dataWithTimestamp as any));

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();

    const member = component.member();
    expect(member?.createdAt instanceof Date).toBeTrue();
    expect(member?.entryDate instanceof Date).toBeTrue();
    expect((member as any).rituals.baptism instanceof Date).toBeTrue();
  }));

  it('canDeactivate should return true', () => {
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    expect(component.canDeactivate()).toBeTrue();
  });
});
