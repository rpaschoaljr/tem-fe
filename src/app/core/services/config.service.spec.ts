import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';
import { provideFirebaseMocks } from './firebase-testing';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { ModuleConfig, PermissionConfig } from '../models/system-config.model';
import { of } from 'rxjs';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConfigService,
        ...provideFirebaseMocks()
      ]
    });
    service = TestBed.inject(ConfigService);
  });

  afterEach(() => {
    // Clean up spies if needed
    jasmine.getEnv().allowRespy(true);
  });

  describe('getConfig', () => {
    it('should return config if doc exists', (done) => {
      const mockSnap = {
        exists: () => true,
        data: () => ({ id: 'stock', fields: [] })
      };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getConfig('stock').subscribe((config) => {
        expect(config.id).toBe('stock');
        done();
      });
    });

    it('should return default config if doc does not exist', (done) => {
      const mockSnap = {
        exists: () => false,
        data: () => null
      };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getConfig('finance').subscribe((config) => {
        expect(config.id).toBe('finance');
        expect(config.fields.length).toBe(1); // Default finance config has 1 field
        done();
      });
    });
  });

  describe('saveConfig', () => {
    it('should call setDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const setDocSpy = (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());

      service.saveConfig({ id: 'test', fields: [], updatedAt: new Date() }).subscribe(() => {
        expect(setDocSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Permissions', () => {
    it('getRolePermission should return existing perm', (done) => {
      const mockSnap = {
        exists: () => true,
        data: () => ({ id: 'role_ADMIN', type: 'role' })
      };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getRolePermission('Admin').subscribe(perm => {
        expect(perm.type).toBe('role');
        done();
      });
    });

    it('getRolePermission should return default perm if not exists', (done) => {
      const mockSnap = { exists: () => false };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getRolePermission('Manager').subscribe(perm => {
        expect(perm.id).toBe('role_MANAGER');
        done();
      });
    });

    it('savePermission should call setDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const setDocSpy = (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());

      service.savePermission({ id: 'perm1', type: 'role', target: 'x', hierarchyLevel: 1, modules: {} as any, updatedAt: new Date() }).subscribe(() => {
        expect(setDocSpy).toHaveBeenCalled();
        done();
      });
    });

    it('getAllRolePermissions should handle empty array', (done) => {
      service.getAllRolePermissions([]).subscribe(res => {
        expect(res.length).toBe(0);
        done();
      });
    });

    it('getAllRolePermissions should combine role permissions', (done) => {
      spyOn(service, 'getRolePermission').and.returnValue(of({ id: 'role_TEST' } as PermissionConfig));
      service.getAllRolePermissions(['Test1', 'Test2']).subscribe(res => {
        expect(res.length).toBe(2);
        expect(res[0].id).toBe('role_TEST');
        done();
      });
    });

    it('getUserPermission should return existing', (done) => {
      const mockSnap = { exists: () => true, data: () => ({ id: 'u1' }) };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getUserPermission('test@test.com').subscribe(res => {
        expect(res.id).toBe('u1');
        done();
      });
    });

    it('getUserPermission should return default', (done) => {
      const mockSnap = { exists: () => false };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));

      service.getUserPermission('test@test.com').subscribe(res => {
        expect(res.id).toBe('test@test.com');
        expect(res.type).toBe('user');
        done();
      });
    });

    it('saveUserPermission should call setDoc', (done) => {
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      const setDocSpy = (((FbUtils.setDoc as any)?.and ? FbUtils.setDoc : spyOn(FbUtils, 'setDoc')) as any).and.returnValue(Promise.resolve());

      service.saveUserPermission({ id: 'u1', type: 'user', target: 'x', hierarchyLevel: 1, modules: {} as any, updatedAt: new Date() }).subscribe(() => {
        expect(setDocSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('ensureInitialized', () => {
    it('should save default config if it does not exist', (done) => {
      const mockSnap = { exists: () => false };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));
      const saveSpy = spyOn(service, 'saveConfig').and.returnValue(of(undefined));

      service.ensureInitialized('members').subscribe(() => {
        expect(saveSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should do nothing if config exists', (done) => {
      const mockSnap = { exists: () => true };
      (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.returnValue({} as any);
      (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.returnValue(Promise.resolve(mockSnap as any));
      const saveSpy = spyOn(service, 'saveConfig');

      service.ensureInitialized('members').subscribe(() => {
        expect(saveSpy).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
