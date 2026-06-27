import { TestBed } from '@angular/core/testing';
import { MembersService } from './members.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LoggerService } from './logger.service';
import { provideFirebaseMocks } from './firebase-testing';

import { FbUtils } from '../../shared/utils/firebase-utils';
import { of, throwError } from 'rxjs';
import { Member } from '../models/member.model';

describe('MembersService', () => {
    let service: MembersService;
    let httpMock: HttpTestingController;
    let loggerMock: jasmine.SpyObj<LoggerService>;
    let batchMock: any;

    beforeEach(() => {
        loggerMock = jasmine.createSpyObj('LoggerService', ['error', 'info', 'warn', 'debug']);

        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                MembersService,
                provideFirebaseMocks(),
                { provide: LoggerService, useValue: loggerMock }
            ]
        });

        service = TestBed.inject(MembersService);
        httpMock = TestBed.inject(HttpTestingController);

        batchMock = {
            set: jasmine.createSpy('set'),
            commit: jasmine.createSpy('commit').and.returnValue(Promise.resolve())
        };

        (((FbUtils.collection as any)?.and ? FbUtils.collection : spyOn(FbUtils, 'collection')) as any).and.returnValue({} as any);
        (((FbUtils.doc as any)?.and ? FbUtils.doc : spyOn(FbUtils, 'doc')) as any).and.callFake((...args: any[]) => ({ id: args[2] || 'new-id' }));
        (((FbUtils.writeBatch as any)?.and ? FbUtils.writeBatch : spyOn(FbUtils, 'writeBatch')) as any).and.returnValue(batchMock);
        (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
        (((FbUtils.query as any)?.and ? FbUtils.query : spyOn(FbUtils, 'query')) as any).and.returnValue({} as any);
        (((FbUtils.where as any)?.and ? FbUtils.where : spyOn(FbUtils, 'where')) as any).and.returnValue({} as any);
        (((FbUtils.limit as any)?.and ? FbUtils.limit : spyOn(FbUtils, 'limit')) as any).and.returnValue({} as any);
        (((FbUtils.collectionData as any)?.and ? FbUtils.collectionData : spyOn(FbUtils, 'collectionData')) as any).and.returnValue(of([]));
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getMembers', () => {
        it('should return mapped members with fixed dates', (done) => {
            const mockData = [
                { id: '1', name: 'John', createdAt: new Date('2023-01-01').toISOString(), entryDate: { toDate: () => new Date('2023-01-01') }, exitDate: 'invalid-date' },
                { id: '2', name: 'Jane' }
            ];
            (FbUtils.collectionData as jasmine.Spy).and.returnValue(of(mockData));

            service.getMembers().subscribe(data => {
                expect(data.length).toBe(2);
                expect(data[0].id).toBe('1');
                expect(data[0].createdAt instanceof Date).toBeTrue();
                expect(data[0].entryDate instanceof Date).toBeTrue();
                expect(data[0].exitDate).toBeNull(); // invalid date
                done();
            });
        });
    });

    describe('getById', () => {
        it('should fetch and merge base, private, and spiritual data', (done) => {
            (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.callFake((docRef: any) => {
                if (docRef.id === '1') {
                    // This mock assumes the doc function creates objects like { path: 'members/1', id: '1' }
                    // Actually, let's just return a sequence
                }
                return Promise.resolve({ data: () => ({ someData: true }) });
            });

            let callCount = 0;
            (FbUtils.getDoc as jasmine.Spy).and.callFake(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ data: () => ({ name: 'John', rituals: { 'umbanda': new Date().toISOString() } }) });
                if (callCount === 2) return Promise.resolve({ data: () => ({ cpf: '123' }) });
                if (callCount === 3) return Promise.resolve({ data: () => ({ consecrations: { 'test': { toDate: () => new Date() } } }) });
                return Promise.resolve({ data: () => null });
            });

            service.getById('1').subscribe(member => {
                expect(member).toBeTruthy();
                expect(member?.name).toBe('John');
                expect(member?.cpf).toBe('123');
                expect(member?.rituals?.['umbanda'] instanceof Date).toBeTrue();
                expect(member?.consecrations?.['test'] instanceof Date).toBeTrue();
                done();
            });
        });

        it('should return undefined if base data is not found', (done) => {
            (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.callFake(() => {
                return Promise.resolve({ data: () => undefined });
            });

            service.getById('1').subscribe(member => {
                expect(member).toBeUndefined();
                done();
            });
        });

        it('should handle errors in private or spiritual fetch gracefully', (done) => {
            let callCount = 0;
            (((FbUtils.getDoc as any)?.and ? FbUtils.getDoc : spyOn(FbUtils, 'getDoc')) as any).and.callFake(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ data: () => ({ name: 'John' }) });
                if (callCount === 2) return Promise.reject('Error private');
                if (callCount === 3) return Promise.reject('Error spiritual');
                return Promise.resolve({ data: () => null });
            });

            service.getById('1').subscribe(member => {
                expect(member).toBeTruthy();
                expect(member?.name).toBe('John');
                expect(member?.cpf).toBeUndefined(); // private data missing
                done();
            });
        });
    });

    describe('save', () => {
        it('should save a new member when no duplicates exist', (done) => {
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({ empty: true }));

            const newMember: Member = {
                id: '',
                name: 'John Doe',
                email: 'john@test.com',
                cpf: '12345678900',
                role: 'MEMBRO',
                status: 'Ativo',
                phone: '11999999999',
                address: { cep: '12345678', street: 'Rua', number: '1', city: 'City', state: 'SP', neighborhood: 'Bairro' },
                deleted: false
            } as any;

            service.save(newMember).subscribe(res => {
                expect(res).toBeTrue();
                expect(batchMock.set).toHaveBeenCalledTimes(3); // base, private, spiritual
                expect(batchMock.commit).toHaveBeenCalled();
                done();
            });
        });

        it('should throw error if CPF already exists', (done) => {
            let callCount = 0;
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.callFake(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ empty: false }); // CPF exists
                return Promise.resolve({ empty: true });
            });

            const newMember = { id: '', name: 'John', email: 'john@test.com', cpf: '123', address: {} } as Member;

            service.save(newMember).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('ESTE CPF JÁ ESTÁ CADASTRADO.');
                    done();
                }
            });
        });

        it('should throw error if Email already exists', (done) => {
            let callCount = 0;
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.callFake(() => {
                callCount++;
                if (callCount === 1) return Promise.resolve({ empty: true });
                if (callCount === 2) return Promise.resolve({ empty: false }); // Email exists
                return Promise.resolve({ empty: true });
            });

            const newMember = { id: '', name: 'John', email: 'john@test.com', cpf: '123', address: {} } as Member;

            service.save(newMember).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('ESTE E-MAIL JÁ ESTÁ EM USO.');
                    done();
                }
            });
        });

        it('should update an existing member directly', (done) => {
            const existingMember = { id: 'm1', name: 'John', email: 'john@test.com', cpf: '123', address: {} } as Member;

            service.save(existingMember).subscribe(res => {
                expect(res).toBeTrue();
                expect(batchMock.set).toHaveBeenCalledTimes(3);
                expect(batchMock.commit).toHaveBeenCalled();
                done();
            });
        });

        it('should handle batch commit error on update', (done) => {
            batchMock.commit.and.returnValue(Promise.reject('Batch error'));
            const existingMember = { id: 'm1', name: 'John', email: 'john@test.com', cpf: '123', address: {} } as Member;

            service.save(existingMember).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('FALHA AO ATUALIZAR MEMBRO NO SERVIDOR.');
                    done();
                }
            });
        });

        it('should handle batch commit error on save new', (done) => {
            (((FbUtils.getDocs as any)?.and ? FbUtils.getDocs : spyOn(FbUtils, 'getDocs')) as any).and.returnValue(Promise.resolve({ empty: true }));
            batchMock.commit.and.returnValue(Promise.reject('Batch error'));
            
            const newMember = { id: '', name: 'John', email: 'john@test.com', cpf: '123', address: {} } as Member;

            service.save(newMember).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('ERRO AO SALVAR MEMBRO.');
                    done();
                }
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject if member is null', (done) => {
                service.save(null as any).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Dados do membro inválidos.');
                        done();
                    }
                });
            });

            it('should reject if name is missing', (done) => {
                const member = { email: 'a@a.com', cpf: '123' } as any;
                service.save(member).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Nome é obrigatório.');
                        done();
                    }
                });
            });

            it('should reject if email is missing', (done) => {
                const member = { name: 'John', cpf: '123' } as any;
                service.save(member).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('E-mail é obrigatório.');
                        done();
                    }
                });
            });

            it('should reject if cpf is missing', (done) => {
                const member = { name: 'John', email: 'a@a.com' } as any;
                service.save(member).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('CPF é obrigatório.');
                        done();
                    }
                });
            });
        });
    });

    describe('updateProfileData', () => {
        it('should update profile data successfully', (done) => {
            service.updateProfileData('1', { phone: '11999999999', address: { cep: '123', logradouro: '', numero: '', complemento: '', bairro: '', localidade: '', uf: '' } as any }).subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject if id is invalid', (done) => {
                service.updateProfileData('', { phone: '123', address: { cep: '123' } } as any).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('ID inválido.');
                        done();
                    }
                });
            });

            it('should reject if data is incomplete', (done) => {
                service.updateProfileData('1', null as any).subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('Dados de perfil incompletos.');
                        done();
                    }
                });
            });
        });
    });

    describe('softDelete and restore', () => {
        it('should soft delete a member', (done) => {
            service.softDelete('1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        it('should restore a member', (done) => {
            service.restore('1').subscribe(res => {
                expect(res).toBeTrue();
                expect(FbUtils.updateDoc).toHaveBeenCalled();
                done();
            });
        });

        describe('Zero Trust / Negative Scenarios', () => {
            it('should reject invalid id for softDelete', (done) => {
                service.softDelete('').subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('ID inválido.');
                        done();
                    }
                });
            });

            it('should reject invalid id for restore', (done) => {
                service.restore(' ').subscribe({
                    next: () => fail('Should have failed'),
                    error: (err) => {
                        expect(err.message).toBe('ID inválido.');
                        done();
                    }
                });
            });
        });
    });

    describe('getAddressByCep', () => {
        it('should format cep and make http request', () => {
            const mockResponse = { cep: '12345-678', logradouro: 'Rua' } as any;
            
            service.getAddressByCep('12345-678').subscribe(res => {
                expect(res).toEqual(mockResponse);
            });

            const req = httpMock.expectOne('https://viacep.com.br/ws/12345678/json/');
            expect(req.request.method).toBe('GET');
            req.flush(mockResponse);
        });
    describe('uploadProfilePicture (Zero Trust)', () => {
        let refSpy: jasmine.Spy;
        let uploadBytesSpy: jasmine.Spy;
        let getDownloadURLSpy: jasmine.Spy;
        let updateDocSpy: jasmine.Spy;

        beforeEach(() => {
            refSpy = ((FbUtils.ref as any)?.and ? FbUtils.ref : spyOn(FbUtils, 'ref')) as jasmine.Spy;
            uploadBytesSpy = ((FbUtils.uploadBytes as any)?.and ? FbUtils.uploadBytes : spyOn(FbUtils, 'uploadBytes')) as jasmine.Spy;
            getDownloadURLSpy = ((FbUtils.getDownloadURL as any)?.and ? FbUtils.getDownloadURL : spyOn(FbUtils, 'getDownloadURL')) as jasmine.Spy;
            
            updateDocSpy = FbUtils.updateDoc as jasmine.Spy;
            
            refSpy.and.returnValue({} as any);
            uploadBytesSpy.and.returnValue(Promise.resolve({ ref: {} } as any));
            getDownloadURLSpy.and.returnValue(Promise.resolve('https://url.com/photo.webp'));
            updateDocSpy.and.returnValue(Promise.resolve());
        });

        it('should upload valid image and update firestore doc', (done) => {
            const validBlob = new Blob(['data'], { type: 'image/webp' });
            Object.defineProperty(validBlob, 'size', { value: 1024 });

            service.uploadProfilePicture('member-123', validBlob).subscribe(url => {
                expect(url).toBe('https://url.com/photo.webp');
                expect(uploadBytesSpy).toHaveBeenCalled();
                expect(updateDocSpy).toHaveBeenCalled();
                done();
            });
        });

        it('should throw error if memberId is empty', (done) => {
            const validBlob = new Blob(['data'], { type: 'image/webp' });
            service.uploadProfilePicture('', validBlob).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('ID do membro inválido.');
                    done();
                }
            });
        });

        it('should throw error if imageBlob is null', (done) => {
            service.uploadProfilePicture('member-123', null as any).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Arquivo de imagem inválido.');
                    done();
                }
            });
        });

        it('should throw error if image size exceeds 5MB', (done) => {
            const hugeBlob = new Blob(['data'], { type: 'image/webp' });
            Object.defineProperty(hugeBlob, 'size', { value: 6 * 1024 * 1024 });

            service.uploadProfilePicture('member-123', hugeBlob).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('O arquivo excede o limite de 5MB.');
                    done();
                }
            });
        });

        it('should throw error if file type is not an image', (done) => {
            const textBlob = new Blob(['data'], { type: 'text/plain' });
            
            service.uploadProfilePicture('member-123', textBlob).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Formato de arquivo não permitido. Envie apenas imagens.');
                    done();
                }
            });
        });

        it('should handle storage upload failure', (done) => {
            const validBlob = new Blob(['data'], { type: 'image/webp' });
            Object.defineProperty(validBlob, 'size', { value: 1024 });

            uploadBytesSpy.and.returnValue(Promise.reject(new Error('Storage unavailable')));

            service.uploadProfilePicture('member-123', validBlob).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Falha ao enviar imagem para o servidor.');
                    done();
                }
            });
        });

        it('should handle firestore update failure', (done) => {
            const validBlob = new Blob(['data'], { type: 'image/webp' });
            Object.defineProperty(validBlob, 'size', { value: 1024 });

            updateDocSpy.and.returnValue(Promise.reject(new Error('Permission denied')));

            service.uploadProfilePicture('member-123', validBlob).subscribe({
                next: () => fail('Should have failed'),
                error: (err) => {
                    expect(err.message).toBe('Imagem salva, mas falha ao atualizar o perfil.');
                    done();
                }
            });
        });
    });
});
});
