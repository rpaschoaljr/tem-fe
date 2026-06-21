import { TestBed } from '@angular/core/testing';
import { pendingChangesGuard, ComponentCanDeactivate } from './pending-changes.guard';
import { of } from 'rxjs';

describe('pendingChangesGuard', () => {
  it('should return true if component.canDeactivate is not defined', () => {
    const component = {} as ComponentCanDeactivate;
    const result = TestBed.runInInjectionContext(() => pendingChangesGuard(component, {} as any, {} as any, {} as any));
    expect(result).toBe(true);
  });

  it('should return the result of component.canDeactivate if it is defined', () => {
    const component = { canDeactivate: () => false } as ComponentCanDeactivate;
    const result = TestBed.runInInjectionContext(() => pendingChangesGuard(component, {} as any, {} as any, {} as any));
    expect(result).toBe(false);
  });

  it('should handle Observable result from component.canDeactivate', (done) => {
    const component = { canDeactivate: () => of(true) } as ComponentCanDeactivate;
    const result$ = TestBed.runInInjectionContext(() => pendingChangesGuard(component, {} as any, {} as any, {} as any));
    if (result$ instanceof Object && 'subscribe' in result$) {
      (result$ as any).subscribe((res: any) => {
        expect(res).toBe(true);
        done();
      });
    } else {
      done.fail('Expected an Observable');
    }
  });
});
