import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoticeFormComponent } from './notice-form';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NoticesService } from '../../../core/services/notices.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Notice } from '../../../core/models/notice.model';
import { provideNativeDateAdapter } from '@angular/material/core';

describe('NoticeFormComponent', () => {
  let component: NoticeFormComponent;
  let fixture: ComponentFixture<NoticeFormComponent>;
  let mockNoticesService: jasmine.SpyObj<NoticesService>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<NoticeFormComponent>>;

  const testNotice: Notice = {
    id: '1',
    title: 'Test Title',
    subtitle: 'Test Subtitle',
    content: 'Content',
    type: 'warning',
    date: new Date('2023-01-01'),
    expirationDate: new Date('2024-12-31'),
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    mockNoticesService = jasmine.createSpyObj('NoticesService', ['save']);
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoticeFormComponent, NoopAnimationsModule],
      providers: [
        provideNativeDateAdapter(),
        { provide: NoticesService, useValue: mockNoticesService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: null }
      ]
    }).compileComponents();
  });

  describe('with no data (create mode)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NoticeFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create empty form', () => {
      expect(component).toBeTruthy();
      expect(component.form.get('id')?.value).toBe('');
      expect(component.form.get('title')?.value).toBe('');
      expect(component.form.get('type')?.value).toBe('info');
      expect(component.form.valid).toBeFalse();
    });

    it('should be valid when required fields are filled', () => {
      component.form.patchValue({
        title: 'New Title',
        content: 'New Content'
      });
      expect(component.form.valid).toBeTrue();
    });
  });

  describe('with data (edit mode)', () => {
    beforeEach(() => {
      TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: testNotice });
      fixture = TestBed.createComponent(NoticeFormComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should initialize form with data', () => {
      expect(component.form.get('title')?.value).toBe('Test Title');
      expect(component.form.get('subtitle')?.value).toBe('Test Subtitle');
      expect(component.form.get('type')?.value).toBe('warning');
      expect(component.form.valid).toBeTrue();
    });

    it('should save if valid and close dialog', () => {
      mockNoticesService.save.and.returnValue(of(true));
      component.save();
      expect(mockNoticesService.save).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('should not save if invalid', () => {
      component.form.patchValue({ title: '' });
      component.save();
      expect(mockNoticesService.save).not.toHaveBeenCalled();
    });

    it('should close dialog without saving', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
      expect(mockNoticesService.save).not.toHaveBeenCalled();
    });
  });
});
