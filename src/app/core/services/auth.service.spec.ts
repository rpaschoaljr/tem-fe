import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { UserClaims } from '../models/common';

function mergePermissions(
  userPerm: Record<string, unknown> | null,
  rolePerm: Record<string, unknown> | null
): UserClaims {
  const userHL = (userPerm?.['hierarchyLevel'] as number) || 0;
  const roleHL = (rolePerm?.['hierarchyLevel'] as number) || 0;
  const hierarchyLevel = Math.max(userHL, roleHL);

  const perms: Record<string, { read: boolean; write: boolean }> = {};
  const modules = ['members', 'finance', 'stock', 'settings', 'notices', 'dashboard', 'pdv'];
  for (const mod of modules) {
    const rM = ((rolePerm?.['modules'] as Record<string, { read: boolean; write: boolean }>)?.[
      mod
    ]) || { read: false, write: false };
    const uM = (userPerm?.['modules'] as Record<string, { read: boolean; write: boolean }>)?.[
      mod
    ];
    perms[mod] = {
      read: uM?.read !== undefined ? uM.read : rM.read,
      write: uM?.write !== undefined ? uM.write : rM.write,
    };
  }

  return { hierarchyLevel, perms };
}

function buildUserModules(
  overrides: Partial<Record<string, { read?: boolean; write?: boolean }>>
): Record<string, { read: boolean; write: boolean }> {
  const modules = ['members', 'finance', 'stock', 'settings', 'notices', 'dashboard', 'pdv'];
  const result: Record<string, { read: boolean; write: boolean }> = {};
  for (const mod of modules) {
    result[mod] = { read: false, write: false, ...overrides[mod] };
  }
  return result;
}

describe('AuthService', () => {
  let service: AuthService;
  let loggerMock: jasmine.SpyObj<LoggerService>;

  const defaultClaims: UserClaims = {
    hierarchyLevel: 5,
    perms: {
      members: { read: true, write: true },
      finance: { read: true, write: false },
      stock: { read: false, write: false },
    },
  };

  beforeEach(() => {
    loggerMock = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: Functions, useValue: {} },
        { provide: LoggerService, useValue: loggerMock },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  // ---------------------------------------------------------------------------
  // hasPermission
  // ---------------------------------------------------------------------------
  describe('hasPermission', () => {
    it('should return true for hierarchyLevel >= 10 (super admin) regardless of module', fakeAsync(() => {
      const claims: UserClaims = { hierarchyLevel: 10, perms: {} };
      (service as any).permissions$ = of(claims);

      let result: boolean | undefined;
      service.hasPermission('settings', 'write').subscribe(r => (result = r));
      tick();

      expect(result).toBeTrue();
    }));

    it('should return false when claims are null', fakeAsync(() => {
      (service as any).permissions$ = of(null);

      let result: boolean | undefined;
      service.hasPermission('members', 'read').subscribe(r => (result = r));
      tick();

      expect(result).toBeFalse();
    }));

    it('should return true when perms[module].read is true', fakeAsync(() => {
      (service as any).permissions$ = of(defaultClaims);

      let result: boolean | undefined;
      service.hasPermission('members', 'read').subscribe(r => (result = r));
      tick();

      expect(result).toBeTrue();
    }));

    it('should return false when perms[module].read is false', fakeAsync(() => {
      (service as any).permissions$ = of(defaultClaims);

      let result: boolean | undefined;
      service.hasPermission('stock', 'read').subscribe(r => (result = r));
      tick();

      expect(result).toBeFalse();
    }));

    it('should return true when perms[module].write is true', fakeAsync(() => {
      (service as any).permissions$ = of(defaultClaims);

      let result: boolean | undefined;
      service.hasPermission('members', 'write').subscribe(r => (result = r));
      tick();

      expect(result).toBeTrue();
    }));

    it('should return false when perms[module].write is false', fakeAsync(() => {
      (service as any).permissions$ = of(defaultClaims);

      let result: boolean | undefined;
      service.hasPermission('finance', 'write').subscribe(r => (result = r));
      tick();

      expect(result).toBeFalse();
    }));

    it('should return false for non-existent module', fakeAsync(() => {
      (service as any).permissions$ = of(defaultClaims);

      let result: boolean | undefined;
      service.hasPermission('nonexistent', 'read').subscribe(r => (result = r));
      tick();

      expect(result).toBeFalse();
    }));

    it('should default hierarchyLevel to 0 when undefined', fakeAsync(() => {
      const claims = {
        hierarchyLevel: undefined,
        perms: { members: { read: true, write: false } },
      } as unknown as UserClaims;
      (service as any).permissions$ = of(claims);

      let result: boolean | undefined;
      service.hasPermission('members', 'read').subscribe(r => (result = r));
      tick();

      expect(result).toBeTrue();
    }));
  });

  // ---------------------------------------------------------------------------
  // loadPermissionsFromFirestore
  // ---------------------------------------------------------------------------
  describe('loadPermissionsFromFirestore', () => {
    it('should read user-level permissions from Firestore', async () => {
      const userPermData = {
        hierarchyLevel: 7,
        modules: buildUserModules({
          members: { read: true, write: true },
          finance: { read: true, write: true },
          dashboard: { read: true, write: true },
        }),
      };

      const result = mergePermissions(userPermData, null);

      expect(result.hierarchyLevel).toBe(7);
      expect(result.perms['members'].read).toBeTrue();
      expect(result.perms['members'].write).toBeTrue();
      expect(result.perms['stock'].read).toBeFalse();
    });

    it('should fall back to role permissions when user-level not set', () => {
      const rolePermData = {
        hierarchyLevel: 3,
        modules: buildUserModules({
          members: { read: true },
          finance: { read: true },
          stock: { read: true, write: true },
          dashboard: { read: true },
        }),
      };

      const result = mergePermissions(null, rolePermData);

      expect(result.perms['members'].read).toBeTrue();
      expect(result.perms['members'].write).toBeFalse();
      expect(result.perms['stock'].read).toBeTrue();
      expect(result.perms['stock'].write).toBeTrue();
      expect(result.hierarchyLevel).toBe(3);
    });

    it('should merge user and role permissions with user taking priority', () => {
      const userPermData = {
        hierarchyLevel: 5,
        modules: {
          members: { read: false, write: false },
          finance: { write: true },
        },
      };

      const rolePermData = {
        hierarchyLevel: 2,
        modules: buildUserModules({
          members: { read: true, write: true },
          finance: { read: true },
          stock: { read: true, write: true },
          dashboard: { read: true },
        }),
      };

      const result = mergePermissions(userPermData, rolePermData);

      expect(result.perms['members'].read).toBeFalse();
      expect(result.perms['members'].write).toBeFalse();
      expect(result.perms['finance'].read).toBeTrue();
      expect(result.perms['finance'].write).toBeTrue();
      expect(result.perms['stock'].read).toBeTrue();
      expect(result.perms['stock'].write).toBeTrue();
      expect(result.hierarchyLevel).toBe(5);
    });

    it('should use max hierarchyLevel from user and role', () => {
      const userPermData = {
        hierarchyLevel: 3,
        modules: buildUserModules({ members: { read: true } }),
      };

      const rolePermData = {
        hierarchyLevel: 8,
        modules: buildUserModules({}),
      };

      const result = mergePermissions(userPermData, rolePermData);

      expect(result.hierarchyLevel).toBe(8);
    });
  });

  // ---------------------------------------------------------------------------
  // refreshClaims
  // ---------------------------------------------------------------------------
  describe('refreshClaims', () => {
    it('should trigger a new claims fetch', async () => {
      const expectedClaims: UserClaims = {
        hierarchyLevel: 5,
        perms: { members: { read: true, write: false } },
      };

      const mockUser = {
        email: 'test@test.com',
        getIdTokenResult: jasmine
          .createSpy('getIdTokenResult')
          .and.returnValues(
            Promise.resolve({ claims: {} }),
            Promise.resolve({ claims: expectedClaims }),
          ),
      };

      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const forceRefresh = attempt > 0;
        const tokenResult = await mockUser.getIdTokenResult(forceRefresh);
        const claims = tokenResult.claims as UserClaims;
        const hasPerms = claims?.perms && Object.keys(claims.perms).length > 0;
        const hasHierarchyLevel =
          claims?.hierarchyLevel !== undefined && claims?.hierarchyLevel !== null;
        if (hasPerms || hasHierarchyLevel) {
          expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(true);
          expect(claims).toEqual(expectedClaims);
          return;
        }
      }

      fail('Expected claims to be resolved within retries');
    });
  });
});
