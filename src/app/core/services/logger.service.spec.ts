import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggerService);
    
    spyOn(console, 'log');
    spyOn(console, 'info');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log debug messages when in dev mode', () => {
    // Note: Since we can't easily override isDevMode() in Angular after init, 
    // we'll just test if it calls console.log or not depending on the environment.
    // In typical test environment, isDevMode() is true unless explicitly disabled.
    service.debug('test message', { a: 1 });
    // if dev mode is true in test env:
    const devMode = (service as any).dev;
    if (devMode) {
        expect(console.log).toHaveBeenCalledWith('[DEBUG] test message', { a: 1 });
    } else {
        expect(console.log).not.toHaveBeenCalled();
    }
  });

  it('should log info messages', () => {
    service.info('info message', 123);
    expect(console.info).toHaveBeenCalledWith('[INFO] info message', 123);
  });

  it('should log warn messages', () => {
    service.warn('warn message', 'data');
    expect(console.warn).toHaveBeenCalledWith('[WARN] warn message', 'data');
  });

  it('should log error messages with Error object', () => {
    const error = new Error('test error');
    service.error('error message', error);
    expect(console.error).toHaveBeenCalledWith('[ERROR] error message', 'test error');
  });

  it('should log error messages with string error', () => {
    service.error('error message', 'string error');
    expect(console.error).toHaveBeenCalledWith('[ERROR] error message', 'string error');
  });

  it('should log error messages without err parameter', () => {
    service.error('error message');
    expect(console.error).toHaveBeenCalledWith('[ERROR] error message', '');
  });
});
