import { AbstractControl, ValidationErrors, ValidatorFn, FormGroup } from '@angular/forms';

export class CustomValidators {

    // Validador de CPF (Já tínhamos)
    static cpf(control: AbstractControl): ValidationErrors | null {
        const cpf = control.value;
        if (!cpf) return null;
        const cleanCPF = cpf.toString().replace(/[^\d]+/g, '');
        if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) return { invalidCpf: true };
        // ... (lógica do calculo mantida) ...
        let sum = 0, remainder;
        for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleanCPF.substring(9, 10))) return { invalidCpf: true };
        sum = 0;
        for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleanCPF.substring(10, 11))) return { invalidCpf: true };
        return null;
    }

    // Validador para Telefone (Celular ou Fixo)
    static phone(control: AbstractControl): ValidationErrors | null {
        const phone = control.value;
        if (!phone) return null; // Se não houver valor, não valide (use Validators.required para isso)
        const cleanPhone = phone.toString().replace(/\D/g, ''); // Remove tudo que não é dígito

        // Telefones no Brasil têm 10 (fixo) ou 11 (celular) dígitos
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            return null; // Válido
        } else {
            return { invalidPhone: true }; // Inválido
        }
    }

    // Novo: Validador de Data Real (Impede 30/02, etc)
    static dateReal(control: AbstractControl): ValidationErrors | null {
        const value = control.value;
        if (!value) return null;

        // Se for string vinda da máscara (DD/MM/AAAA)
        if (typeof value === 'string' && value.length === 10) {
            const day = parseInt(value.split('/')[0]);
            const month = parseInt(value.split('/')[1]);
            const year = parseInt(value.split('/')[2]);

            const dateObj = new Date(year, month - 1, day);
            if (dateObj.getFullYear() !== year || dateObj.getMonth() + 1 !== month || dateObj.getDate() !== day) {
                return { invalidDate: true };
            }
        }
        return null;
    }

    // Valida que a data não é no futuro
    static dateNotFuture(control: AbstractControl): ValidationErrors | null {
        const value = control.value;
        if (!value || !(value instanceof Date) || isNaN(value.getTime())) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(value); d.setHours(0, 0, 0, 0);
        return d > today ? { futureDate: true } : null;
    }

    // Valida que a data de saída não é anterior à data de entrada
    static exitAfterEntry(control: AbstractControl): ValidationErrors | null {
        if (!control.value || !(control.value instanceof Date)) return null;
        const entryDate = control.root.get('entryDate')?.value;
        if (!entryDate || !(entryDate instanceof Date)) return null;
        const entry = new Date(entryDate); entry.setHours(0, 0, 0, 0);
        const d = new Date(control.value); d.setHours(0, 0, 0, 0);
        return d < entry ? { exitBeforeEntry: true } : null;
    }

    // Valida que data de ritual/consagração não é anterior à data de entrada
    static dateAfterEntry(control: AbstractControl): ValidationErrors | null {
        if (!control.value || !(control.value instanceof Date)) return null;
        const entryDate = control.root.get('entryDate')?.value;
        if (!entryDate || !(entryDate instanceof Date)) return null;
        const entry = new Date(entryDate); entry.setHours(0, 0, 0, 0);
        const d = new Date(control.value); d.setHours(0, 0, 0, 0);
        return d < entry ? { dateBeforeEntry: true } : null;
    }

    // Valida que Batismo 1 Ano não é anterior ao Batismo
    static baptism1AfterBaptism(control: AbstractControl): ValidationErrors | null {
        if (!control.value || !(control.value instanceof Date)) return null;
        const baptism = control.root.get('rituals.baptism')?.value;
        if (!baptism || !(baptism instanceof Date)) return null;
        const b = new Date(baptism); b.setHours(0, 0, 0, 0);
        const d = new Date(control.value); d.setHours(0, 0, 0, 0);
        return d < b ? { baptism1BeforeBaptism: true } : null;
    }

    // Novo: Valida Intervalo (Data Final > Data Inicial)
    static dateRange(startControlName: string, endControlName: string): ValidatorFn {
        return (form: AbstractControl): ValidationErrors | null => {
            const start = form.get(startControlName)?.value;
            const end = form.get(endControlName)?.value;

            if (!start || !end) return null;

            // Função auxiliar para converter string PT-BR ou Date para Time
            const getTime = (val: any) => {
                if (val instanceof Date) return val.getTime();
                if (typeof val === 'string' && val.length === 10) {
                    const parts = val.split('/');
                    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
                }
                return 0;
            };

            const startTime = getTime(start);
            const endTime = getTime(end);

            if (startTime && endTime && endTime < startTime) {
                // Marca erro no campo de fim
                form.get(endControlName)?.setErrors({ dateRange: true });
                return { dateRange: true };
            }

            // Se corrigiu, remove o erro
            if (form.get(endControlName)?.hasError('dateRange')) {
                form.get(endControlName)?.setErrors(null);
            }

            return null;
        };
    }
}