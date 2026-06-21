import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';

describe('authGuard', () => {
  let router: jasmine.SpyObj<Router>;
  let mockAuthService: any;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    mockAuthService = { permissions$: of(null) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
  });

  it('should return true if user is logged in', (done) => {
    mockAuthService.permissions$ = of({ modules: {} });

    const result$ = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    if (result$ instanceof Object && 'subscribe' in result$) {
      (result$ as any).subscribe((res: any) => {
        expect(res).toBe(true);
        done();
      });
    } else {
      done();
    }
  });

  it('should return UrlTree to /login if user is not logged in', (done) => {
    const urlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(urlTree);
    
    mockAuthService.permissions$ = of(null);

    const result$ = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    if (result$ instanceof Object && 'subscribe' in result$) {
      (result$ as any).subscribe((res: any) => {
        expect(res).toBe(urlTree);
        expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
        done();
      });
    } else {
      done();
    }
  });
});
