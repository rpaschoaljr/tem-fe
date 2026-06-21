import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoticesComponent } from './notices';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NoticesService } from '../../core/services/notices.service';
import { provideFirebaseMocks } from '../../core/services/firebase-testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { of, BehaviorSubject } from 'rxjs';
import { Notice } from '../../core/models/notice.model';
import { NoticeFormComponent } from './notice-form/notice-form';
import { provideNativeDateAdapter } from '@angular/material/core';

describe('NoticesComponent', () => {
  let component: NoticesComponent;
  let fixture: ComponentFixture<NoticesComponent>;
  let mockNoticesService: jasmine.SpyObj<NoticesService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;
  let mockSnack: jasmine.SpyObj<MatSnackBar>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockRouteUrl: BehaviorSubject<any[]>;

  const mockNotices: Notice[] = [
    { id: '1', title: 'Test', content: 'Test Content', type: 'info', date: new Date(), deleted: false, createdAt: new Date(), updatedAt: new Date() }
  ];

  beforeEach(async () => {
    mockNoticesService = jasmine.createSpyObj('NoticesService', [
      'getNotices', 'getArchivedNotices', 'getDeletedNotices', 
      'softDelete', 'restore', 'hardDelete'
    ]);
    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);
    mockSnack = jasmine.createSpyObj('MatSnackBar', ['open']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockRouteUrl = new BehaviorSubject<any[]>([{ path: 'notices' }]);

    mockNoticesService.getNotices.and.returnValue(of(mockNotices));
    mockNoticesService.getArchivedNotices.and.returnValue(of([]));
    mockNoticesService.getDeletedNotices.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [NoticesComponent, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        provideFirebaseMocks(),
        { provide: NoticesService, useValue: mockNoticesService },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatSnackBar, useValue: mockSnack },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { url: mockRouteUrl.asObservable() } }
      ]
    })
    .overrideProvider(MatDialog, { useValue: mockDialog })
    .overrideProvider(MatSnackBar, { useValue: mockSnack })
    .compileComponents();

    fixture = TestBed.createComponent(NoticesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load active notices by default', () => {
    expect(component).toBeTruthy();
    expect(component.viewMode).toBe('active');
    expect(mockNoticesService.getNotices).toHaveBeenCalled();
    expect(component.notices).toEqual(mockNotices);
  });

  it('should load archived notices when route is archive', () => {
    mockRouteUrl.next([{ path: 'archive' }]);
    fixture.detectChanges();
    expect(component.viewMode).toBe('archive');
    expect(mockNoticesService.getArchivedNotices).toHaveBeenCalled();
  });

  it('should load trash notices when route is trash', () => {
    mockRouteUrl.next([{ path: 'trash' }]);
    fixture.detectChanges();
    expect(component.viewMode).toBe('trash');
    expect(mockNoticesService.getDeletedNotices).toHaveBeenCalled();
  });

  it('should get icon for type', () => {
    expect(component.getIconForType('event')).toBe('event');
    expect(component.getIconForType('payment')).toBe('payments');
    expect(component.getIconForType('warning')).toBe('warning');
    expect(component.getIconForType('info')).toBe('info');
    expect(component.getIconForType('unknown')).toBe('info');
  });

  it('should navigate back to dashboard', () => {
    component.back();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should navigate to path under notices', () => {
    component.navigate('archive');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/notices/archive']);
  });

  it('should open form to create notice', () => {
    const dialogRefSpyObj = jasmine.createSpyObj({ afterClosed: of(true) });
    mockDialog.open.and.returnValue(dialogRefSpyObj);

    component.openForm();
    
    expect(mockDialog.open).toHaveBeenCalledWith(NoticeFormComponent, { width: '500px', data: null });
    expect(mockSnack.open).toHaveBeenCalledWith('Aviso salvo com sucesso!', 'OK', { duration: 3000 });
    expect(mockNoticesService.getNotices).toHaveBeenCalledTimes(2); // Initial + reload
  });

  it('should open form to edit notice', () => {
    const dialogRefSpyObj = jasmine.createSpyObj({ afterClosed: of(false) });
    mockDialog.open.and.returnValue(dialogRefSpyObj);

    component.openForm(mockNotices[0]);
    
    expect(mockDialog.open).toHaveBeenCalledWith(NoticeFormComponent, { width: '500px', data: mockNotices[0] });
    expect(mockSnack.open).not.toHaveBeenCalled();
  });

  it('should soft delete notice', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockNoticesService.softDelete.and.returnValue(of(true));

    component.deleteNotice('1');

    expect(mockNoticesService.softDelete).toHaveBeenCalledWith('1');
    expect(mockSnack.open).toHaveBeenCalledWith('Aviso movido para a lixeira.', 'OK', { duration: 3000 });
    expect(mockNoticesService.getNotices).toHaveBeenCalledTimes(2); // Reload
  });

  it('should not soft delete if unconfirmed', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.deleteNotice('1');
    expect(mockNoticesService.softDelete).not.toHaveBeenCalled();
  });

  it('should restore notice', () => {
    mockNoticesService.restore.and.returnValue(of(true));
    component.restoreNotice('1');
    expect(mockNoticesService.restore).toHaveBeenCalledWith('1');
    expect(mockSnack.open).toHaveBeenCalledWith('Aviso restaurado.', 'OK', { duration: 3000 });
  });

  it('should hard delete notice', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockNoticesService.hardDelete.and.returnValue(of(true));

    component.hardDeleteNotice('1');

    expect(mockNoticesService.hardDelete).toHaveBeenCalledWith('1');
    expect(mockSnack.open).toHaveBeenCalledWith('Aviso excluído permanentemente.', 'OK', { duration: 3000 });
  });

  it('should not hard delete if unconfirmed', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.hardDeleteNotice('1');
    expect(mockNoticesService.hardDelete).not.toHaveBeenCalled();
  });
});
