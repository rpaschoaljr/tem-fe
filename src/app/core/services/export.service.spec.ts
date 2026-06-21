import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { LoggerService } from './logger.service';

describe('ExportService', () => {
  let service: ExportService;
  let loggerMock: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    loggerMock = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);

    TestBed.configureTestingModule({
      providers: [
        ExportService,
        { provide: LoggerService, useValue: loggerMock }
      ]
    });
    service = TestBed.inject(ExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('exportToCsv', () => {
    let createElementSpy: jasmine.Spy;
    let appendChildSpy: jasmine.Spy;
    let removeChildSpy: jasmine.Spy;
    let createObjectURLSpy: jasmine.Spy;
    let mockLink: any;

    beforeEach(() => {
      mockLink = {
        setAttribute: jasmine.createSpy('setAttribute'),
        click: jasmine.createSpy('click'),
        style: {}
      };
      createElementSpy = spyOn(document, 'createElement').and.returnValue(mockLink as any);
      appendChildSpy = spyOn(document.body, 'appendChild');
      removeChildSpy = spyOn(document.body, 'removeChild');
      createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:url');
    });

    it('should do nothing if data is empty or null', () => {
      service.exportToCsv(null as any, 'test', []);
      expect(createElementSpy).not.toHaveBeenCalled();

      service.exportToCsv([], 'test', []);
      expect(createElementSpy).not.toHaveBeenCalled();
    });

    it('should generate and download CSV file with valid data', () => {
      const data = [
        { name: 'John Doe', age: 30, active: true },
        { name: 'Jane "Smith"', age: 25, active: false }
      ];
      const columns = [
        { key: 'name', label: 'Nome' },
        { key: 'age', label: 'Idade' },
        { key: 'active', label: 'Ativo' }
      ];

      service.exportToCsv(data, 'usuarios', columns);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download',
        jasmine.stringMatching(/usuarios_\d{4}-\d{2}-\d{2}\.csv/)
      );
      expect(mockLink.style.visibility).toBe('hidden');
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    });
  });

  describe('resolveValue', () => {
    it('should resolve nested paths', () => {
      const obj = { a: { b: { c: 'nested' } } };
      const val = (service as any).resolveValue(obj, 'a.b.c');
      expect(val).toBe('nested');
    });

    it('should return empty string for null or undefined obj', () => {
      expect((service as any).resolveValue(null, 'a')).toBe('');
      expect((service as any).resolveValue(undefined, 'a')).toBe('');
    });

    it('should return empty string if resolved value is null or undefined', () => {
      const obj = { a: null, b: undefined };
      expect((service as any).resolveValue(obj, 'a')).toBe('');
      expect((service as any).resolveValue(obj, 'b')).toBe('');
      expect((service as any).resolveValue(obj, 'c.d')).toBe('');
    });

    it('should format Date values correctly', () => {
      const date = new Date(2023, 0, 15); // 15/01/2023
      const val = (service as any).resolveValue({ d: date }, 'd');
      expect(val).toContain('15/01/2023'); // toLocaleDateString might vary slightly by timezone, but generally matches
    });

    it('should format boolean values correctly', () => {
      expect((service as any).resolveValue({ v: true }, 'v')).toBe('Sim');
      expect((service as any).resolveValue({ v: false }, 'v')).toBe('Não');
    });

    it('should format numbers with comma correctly', () => {
      expect((service as any).resolveValue({ v: 1234.56 }, 'v')).toBe('1234,56');
    });

    it('should fallback to string representation for other types', () => {
      expect((service as any).resolveValue({ v: { prop: 1 } }, 'v')).toBe('[object Object]');
    });
  });

  describe('escapeCsvValue', () => {
    it('should return simple string as is', () => {
      expect((service as any).escapeCsvValue('simple')).toBe('simple');
    });

    it('should escape quotes by doubling them and wrapping in quotes', () => {
      // original: value "with" quotes
      // inside CSV: "value ""with"" quotes"
      expect((service as any).escapeCsvValue('value "with" quotes')).toBe('"value ""with"" quotes"');
    });

    it('should wrap in quotes if contains semicolon', () => {
      expect((service as any).escapeCsvValue('a;b')).toBe('"a;b"');
    });

    it('should wrap in quotes if contains newline', () => {
      expect((service as any).escapeCsvValue('a\nb')).toBe('"a\nb"');
    });
  });
});
