import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditProfileDialogComponent } from './edit-profile-dialog';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MembersService } from '../../../core/services/members.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

describe('EditProfileDialogComponent', () => {
  let component: EditProfileDialogComponent;
  let fixture: ComponentFixture<EditProfileDialogComponent>;
  let membersServiceMock: jasmine.SpyObj<MembersService>;
  let notificationMock: jasmine.SpyObj<NotificationService>;
  let dialogRefMock: jasmine.SpyObj<MatDialogRef<EditProfileDialogComponent>>;

  const mockMemberData = {
    id: 'user123',
    phone: '11999999999',
    address: {
      cep: '12345678',
      street: 'Rua Teste',
      number: '123',
      complement: 'Apto 1',
      neighborhood: 'Bairro Teste',
      city: 'São Paulo',
      state: 'SP'
    }
  };

  beforeEach(async () => {
    membersServiceMock = jasmine.createSpyObj('MembersService', ['updateProfileData', 'getAddressByCep']);
    notificationMock = jasmine.createSpyObj('NotificationService', ['showSuccess', 'showError', 'showWarning']);
    dialogRefMock = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [
        EditProfileDialogComponent,
        ReactiveFormsModule,
        BrowserAnimationsModule
      ],
      providers: [
        { provide: MembersService, useValue: membersServiceMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: { member: mockMemberData } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Happy Path', () => {
    it('should save valid profile data successfully', () => {
      membersServiceMock.updateProfileData.and.returnValue(of(true));

      component.form.patchValue({
        phone: '11988888888',
        cep: '01001000',
        street: 'Praça da Sé',
        number: '1',
        complement: 'Lado ímpar',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP'
      });

      component.save();

      expect(membersServiceMock.updateProfileData).toHaveBeenCalled();
      const payload = membersServiceMock.updateProfileData.calls.mostRecent().args[1];
      expect(payload.phone).toBe('11988888888');
      expect(payload.address.cep).toBe('01001000');
      expect(notificationMock.showSuccess).toHaveBeenCalledWith('Dados atualizados com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('should fetch address by valid CEP (ViaCEP integration)', () => {
      membersServiceMock.getAddressByCep.and.returnValue(of({
        cep: '01001-000',
        logradouro: 'Praça da Sé',
        complemento: 'lado ímpar',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
        erro: false
      } as any));

      component.form.patchValue({ cep: '01001000' });
      component.buscarCep();

      expect(membersServiceMock.getAddressByCep).toHaveBeenCalledWith('01001000');
      expect(component.form.get('street')?.value).toBe('Praça da Sé');
      expect(component.form.get('neighborhood')?.value).toBe('Sé');
      expect(component.form.get('city')?.value).toBe('São Paulo');
      expect(component.form.get('state')?.value).toBe('SP');
    });
  });

  describe('Zero Trust / Negative Scenarios', () => {
    it('should block save if form is invalid (missing phone)', () => {
      component.form.patchValue({ phone: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if form has empty spaces in phone', () => {
      component.form.patchValue({ phone: '   ' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if form has missing cep', () => {
      component.form.patchValue({ cep: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if street is missing', () => {
      component.form.patchValue({ street: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if number is missing', () => {
      component.form.patchValue({ number: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if neighborhood is missing', () => {
      component.form.patchValue({ neighborhood: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if city is missing', () => {
      component.form.patchValue({ city: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should block save if state is missing', () => {
      component.form.patchValue({ state: '' });
      component.save();

      expect(notificationMock.showWarning).toHaveBeenCalledWith('Preencha os campos obrigatórios.');
      expect(membersServiceMock.updateProfileData).not.toHaveBeenCalled();
    });

    it('should not search CEP if it does not have 8 digits', () => {
      component.form.patchValue({ cep: '123' });
      component.buscarCep();

      expect(membersServiceMock.getAddressByCep).not.toHaveBeenCalled();
    });

    it('should handle service error on save', () => {
      membersServiceMock.updateProfileData.and.returnValue(throwError(() => new Error('Service failed')));
      component.save();

      expect(notificationMock.showError).toHaveBeenCalledWith('Erro ao atualizar dados: Service failed');
      expect(component.loading).toBeFalse();
    });

    it('should not update address fields if ViaCEP returns erro=true', () => {
      membersServiceMock.getAddressByCep.and.returnValue(of({
        erro: true
      } as any));

      // Set initial values
      component.form.patchValue({ street: 'Rua Inicial' });

      component.form.patchValue({ cep: '99999999' });
      component.buscarCep();

      expect(membersServiceMock.getAddressByCep).toHaveBeenCalledWith('99999999');
      // Should not overwrite
      expect(component.form.get('street')?.value).toBe('Rua Inicial');
    });
  });
});
