import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoticesService } from './notices.service';
import { provideFirebaseMocks } from './firebase-testing';
import { LoggerService } from './logger.service';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { Notice } from '../models/notice.model';
import { of } from 'rxjs';

describe('NoticesService', () => {
  let service: NoticesService;
  let loggerMock: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    loggerMock = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        NoticesService,
        { provide: LoggerService, useValue: loggerMock },
        ...provideFirebaseMocks()
      ]
    });
    service = TestBed.inject(NoticesService);

    localStorage.clear();
    jasmine.getEnv().allowRespy(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  const dummyNotice: Notice = {
    id: '1',
    title: 'Test Notice',
    content: 'Content',
    date: new Date(),
    type: 'info',
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false
  };

  describe('getNotices', () => {
    it('should fetch from firestore (with string dates)', (done) => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      
      const mockDocs = {
        docs: [
          { id: '1', data: () => ({ ...dummyNotice, date: dummyNotice.date.toISOString(), expirationDate: null }) }
        ]
      };
      (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve(mockDocs as any));

      service.getNotices().subscribe(notices => {
        expect(notices.length).toBe(1);
        expect(notices[0].id).toBe('1');
        done();
      });
    });

    it('should fetch from firestore (with firestore Timestamp dates)', (done) => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      
      const mockTimestamp = { toDate: () => new Date() };
      const mockDocs = {
        docs: [
          { id: '1', data: () => ({ ...dummyNotice, date: mockTimestamp, expirationDate: mockTimestamp, createdAt: mockTimestamp, updatedAt: mockTimestamp }) }
        ]
      };
      (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve(mockDocs as any));

      service.getNotices().subscribe(notices => {
        expect(notices.length).toBe(1);
        expect(notices[0].date).toBeInstanceOf(Date);
        done();
      });
    });

    it('should fallback to cache on error if cache is valid', fakeAsync(() => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.reject('error'));
      
      localStorage.setItem('notices_data', JSON.stringify([{ ...dummyNotice, expirationDate: new Date().toISOString() }]));
      localStorage.setItem('notices_last_fetch', Date.now().toString());

      let result: Notice[] = [];
      service.getNotices().subscribe(n => result = n);
      tick(500);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    }));

    it('should fallback to cache on error if cache is valid (null dates)', fakeAsync(() => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.reject('error'));
      
      const nullDateNotice = { ...dummyNotice, expirationDate: null, date: null, createdAt: null, updatedAt: null };
      localStorage.setItem('notices_data', JSON.stringify([nullDateNotice]));
      localStorage.setItem('notices_last_fetch', Date.now().toString());

      let result: Notice[] = [];
      service.getNotices().subscribe(n => result = n);
      tick(500);

      expect(result.length).toBe(1);
    }));

    it('should fallback to mock data on error if cache is expired/missing', fakeAsync(() => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.reject('error'));
      
      let result: Notice[] | null = null;
      service.getNotices().subscribe(n => result = n);
      tick(500);

      expect(result).toEqual([] as any);
    }));
  });

  describe('filtering methods', () => {
    let mockNotices: Notice[];
    beforeEach(() => {
      const activeNotice: Notice = { ...dummyNotice, id: 'a1', deleted: false, expirationDate: new Date(Date.now() + 100000) };
      const archivedNotice: Notice = { ...dummyNotice, id: 'a2', deleted: false, expirationDate: new Date(Date.now() - 100000) };
      const deletedNotice: Notice = { ...dummyNotice, id: 'a3', deleted: true };
      const activeNoExp: Notice = { ...dummyNotice, id: 'a4', deleted: false, expirationDate: null as any };
      const archivedNoExpDel: Notice = { ...dummyNotice, id: 'a5', deleted: true, expirationDate: null as any };

      mockNotices = [activeNotice, archivedNotice, deletedNotice, activeNoExp, archivedNoExpDel];
    });

    it('getActiveNotices', (done) => {
      spyOn(service, 'getNotices').and.returnValue(of(mockNotices));
      service.getActiveNotices().subscribe(res => {
        expect(res.map(n => n.id)).toEqual(['a1', 'a4']);
        done();
      });
    });

    it('getArchivedNotices', (done) => {
      spyOn(service, 'getNotices').and.returnValue(of(mockNotices));
      service.getArchivedNotices().subscribe(res => {
        expect(res.map(n => n.id)).toEqual(['a2']);
        done();
      });
    });

    it('getDeletedNotices', (done) => {
      spyOn(service, 'getNotices').and.returnValue(of(mockNotices));
      service.getDeletedNotices().subscribe(res => {
        expect(res.map(n => n.id)).toEqual(['a3', 'a5']);
        done();
      });
    });
  });

  describe('crud operations', () => {
    it('save (new) should call setDoc', (done) => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({ id: 'new_id' } as any);
      const setDocSpy = (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());

      const newNotice = { ...dummyNotice } as any;
      newNotice.id = ''; // simulate falsy id

      service.save(newNotice).subscribe(res => {
        expect(res).toBeTrue();
        expect(setDocSpy).toHaveBeenCalled();
        done();
      });
    });

    it('save (existing) should call setDoc', (done) => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({ id: '1' } as any);
      const setDocSpy = (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());

      service.save(dummyNotice).subscribe(res => {
        expect(res).toBeTrue();
        expect(setDocSpy).toHaveBeenCalled();
        done();
      });
    });

    it('save error should update mock data', fakeAsync(() => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({ id: '1' } as any);
      (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.reject('error'));
      
      localStorage.setItem('notices_data', JSON.stringify([{ ...dummyNotice }]));

      let result = false;
      service.save(dummyNotice).subscribe(res => result = res);
      tick(500);

      expect(result).toBeTrue();
      const updatedCache = JSON.parse(localStorage.getItem('notices_data')!);
      expect(updatedCache[0].id).toBe('1');
    }));

    it('save error with new should create in mock data', fakeAsync(() => {
      (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({ id: 'new_id' } as any);
      (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.reject('error'));

      const newNotice = { ...dummyNotice } as any;
      newNotice.id = '';

      let result = false;
      service.save(newNotice).subscribe(res => result = res);
      tick(500);

      expect(result).toBeTrue();
      const updatedCache = JSON.parse(localStorage.getItem('notices_data')!);
      expect(updatedCache.length).toBe(1);
    }));

    it('softDelete should updateDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const updateDocSpy = (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());

      service.softDelete('1').subscribe(res => {
        expect(res).toBeTrue();
        expect(updateDocSpy).toHaveBeenCalled();
        done();
      });
    });

    it('softDelete error should update mock', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.reject('error'));
      
      localStorage.setItem('notices_data', JSON.stringify([{ ...dummyNotice }]));

      let result = false;
      service.softDelete('1').subscribe(res => result = res);
      tick(500);

      expect(result).toBeTrue();
      const cache = JSON.parse(localStorage.getItem('notices_data')!);
      expect(cache[0].deleted).toBeTrue();
    }));

    it('softDelete error not found should throw', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.reject('error'));

      let err: any;
      service.softDelete('1').subscribe({ error: e => err = e });
      tick();

      expect(err.message).toBe('Aviso não encontrado.');
    }));

    it('restore should updateDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const updateDocSpy = (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());

      service.restore('1').subscribe(res => {
        expect(res).toBeTrue();
        expect(updateDocSpy).toHaveBeenCalled();
        done();
      });
    });

    it('restore error should update mock', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.reject('error'));
      
      const delNotice = { ...dummyNotice, deleted: true };
      localStorage.setItem('notices_data', JSON.stringify([delNotice]));

      let result = false;
      service.restore('1').subscribe(res => result = res);
      tick(500);

      expect(result).toBeTrue();
      const cache = JSON.parse(localStorage.getItem('notices_data')!);
      expect(cache[0].deleted).toBeFalse();
    }));

    it('restore error not found should throw', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.reject('error'));

      let err: any;
      service.restore('1').subscribe({ error: e => err = e });
      tick();

      expect(err.message).toBe('Aviso não encontrado.');
    }));

    it('hardDelete should deleteDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const delSpy = (((FbUtils.deleteDoc as any)?.and ? FbUtils.deleteDoc : spyOn(FbUtils, 'deleteDoc')) as any).and.returnValue(Promise.resolve());

      service.hardDelete('1').subscribe(res => {
        expect(res).toBeTrue();
        expect(delSpy).toHaveBeenCalled();
        done();
      });
    });

    it('hardDelete error should update mock', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.deleteDoc as any)?.and ? FbUtils.deleteDoc : spyOn(FbUtils, 'deleteDoc')) as any).and.returnValue(Promise.reject('error'));
      
      localStorage.setItem('notices_data', JSON.stringify([{ ...dummyNotice }]));

      let result = false;
      service.hardDelete('1').subscribe(res => result = res);
      tick(500);

      expect(result).toBeTrue();
      const cache = JSON.parse(localStorage.getItem('notices_data')!);
      expect(cache.length).toBe(0);
    }));

    it('hardDelete error not found should throw', fakeAsync(() => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.deleteDoc as any)?.and ? FbUtils.deleteDoc : spyOn(FbUtils, 'deleteDoc')) as any).and.returnValue(Promise.reject('error'));

      let err: any;
      service.hardDelete('1').subscribe({ error: e => err = e });
      tick();

      expect(err.message).toBe('Aviso não encontrado.');
    }));
  });
});
