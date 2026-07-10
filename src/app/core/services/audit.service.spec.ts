import { TestBed } from '@angular/core/testing';
import { AuditService } from './audit.service';
import { LoggerService } from './logger.service';
import { provideFirebaseMocks } from './firebase-testing';
import { FbUtils } from '../../shared/utils/firebase-utils';
import { of, throwError } from 'rxjs';

describe('AuditService', () => {
    let service: AuditService;
    let loggerMock: jasmine.SpyObj<LoggerService>;

    beforeEach(() => {
        loggerMock = jasmine.createSpyObj('LoggerService', ['error', 'info', 'warn', 'debug']);

        TestBed.configureTestingModule({
            providers: [
                AuditService,
                provideFirebaseMocks(),
                { provide: LoggerService, useValue: loggerMock }
            ]
        });

        service = TestBed.inject(AuditService);

        // Spy on firestore methods
        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.query as any)?.and ? FbUtils.query : spyOn(FbUtils, 'query')) as any).and.returnValue({} as any);
        (((FbUtils.collectionData as any)?.and ? FbUtils.collectionData : spyOn(FbUtils, 'collectionData')) as any).and.returnValue(of([]));
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getLogs', () => {
        it('should return mapped audit logs', (done) => {
            const mockData = [
                { id: 'log-1', timestamp: new Date('2026-07-09T10:00:00Z').toISOString(), action: 'UPDATE', collection: 'members', documentId: 'member-123', userId: 'uid-1' },
                { id: 'log-2', timestamp: { toDate: () => new Date('2026-07-09T12:00:00Z') }, action: 'CREATE', collection: 'stock', documentId: 'item-456', userId: 'uid-2' }
            ];
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(of(mockData));

            service.getLogs().subscribe(logs => {
                expect(logs.length).toBe(2);
                expect(logs[0].id).toBe('log-1');
                expect(logs[0].timestamp instanceof Date).toBeTrue();
                expect(logs[1].id).toBe('log-2');
                expect(logs[1].timestamp instanceof Date).toBeTrue();
                done();
            });
        });

        it('should handle errors and return a custom error', (done) => {
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(throwError(() => new Error('Error fetching')));

            service.getLogs().subscribe({
                error: (err) => {
                    expect(err.message).toBe('Não foi possível ler os logs de auditoria.');
                    expect(loggerMock.error).toHaveBeenCalled();
                    done();
                }
            });
        });
    });
});
