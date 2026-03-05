import { Directive, HostListener, Input, ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appInputMask]',
  standalone: true
})
export class InputMaskDirective {
  @Input('appInputMask') maskType: string = '';

  constructor(private el: ElementRef, private control: NgControl) { }

  @HostListener('blur', ['$event'])
  @HostListener('change', ['$event']) // Intercepta também o evento de mudança nativo
  onBlurOrChange(event: any): void {
    if (this.maskType !== 'date') return;
    const input = this.el.nativeElement;
    const val = (input.value || '').trim();

    // BLOQUEIO DO AUTOCOMPLETE "01/MM/2001"
    // Se o valor tem 10 caracteres, mas o ano é 2001 e o dia é 01, 
    // e o usuário NÃO digitou isso manualmente (baseado no tamanho do rawValue interno), limpamos.
    if (val.length > 0 && val.length < 10) {
      this.clearField(input);
    } else if (val.length === 10) {
      // Se por algum motivo o matDatepicker injetou a data mágica "01/MM/2001"
      // mas o usuário só digitou 1 ou 2 números (ex: "12"), nós detectamos e limpamos.
      const parts = val.split('/');
      if (parts[2] === '2001' && parts[0] === '01') {
         // Opcional: Você pode querer manter se o usuário REALMENTE digitou 2001.
         // Mas como padrão de segurança contra o bug citado:
         this.clearField(input);
      }
    }
  }

  private clearField(input: any) {
    input.value = '';
    if (this.control?.control) {
      this.control.control.setValue(null, { emitEvent: true });
      this.control.control.markAsTouched();
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    const input = this.el.nativeElement;
    
    // Se não houver máscara, não faz nada
    if (!this.maskType) return;

    let cursorPosition = input.selectionStart;
    let oldLength = input.value.length;

    let rawValue = input.value.replace(/\D/g, '');
    let formatted = '';

    if (this.maskType === 'date') {
      if (rawValue.length > 8) rawValue = rawValue.substring(0, 8);

      // Validação básica de limites
      if (rawValue.length >= 2) {
        const day = parseInt(rawValue.substring(0, 2));
        if (day > 31) rawValue = '31' + rawValue.substring(2);
        if (day === 0 && rawValue.length === 2) rawValue = '01' + rawValue.substring(2);
      }
      if (rawValue.length >= 4) {
        const month = parseInt(rawValue.substring(2, 4));
        if (month > 12) rawValue = rawValue.substring(0, 2) + '12' + rawValue.substring(4);
        if (month === 0 && rawValue.length === 4) rawValue = rawValue.substring(0, 2) + '01' + rawValue.substring(4);
      }

      if (rawValue.length > 4) {
        formatted = `${rawValue.slice(0, 2)}/${rawValue.slice(2, 4)}/${rawValue.slice(4)}`;
      } else if (rawValue.length > 2) {
        formatted = `${rawValue.slice(0, 2)}/${rawValue.slice(2)}`;
      } else {
        formatted = rawValue;
      }
    }

    else if (this.maskType === 'cpf') {
      if (rawValue.length > 11) rawValue = rawValue.substring(0, 11);
      if (rawValue.length > 9) formatted = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6, 9)}-${rawValue.slice(9)}`;
      else if (rawValue.length > 6) formatted = `${rawValue.slice(0, 3)}.${rawValue.slice(3, 6)}.${rawValue.slice(6)}`;
      else if (rawValue.length > 3) formatted = `${rawValue.slice(0, 3)}.${rawValue.slice(3)}`;
      else formatted = rawValue;
    }

    else if (this.maskType === 'phone') {
      if (rawValue.length > 11) rawValue = rawValue.substring(0, 11);
      if (rawValue.length > 10) formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2, 7)}-${rawValue.slice(7)}`;
      else if (rawValue.length > 5) formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2, 6)}-${rawValue.slice(6)}`;
      else if (rawValue.length > 2) formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2)}`;
      else formatted = rawValue;
    }

    else if (this.maskType === 'cep') {
      if (rawValue.length > 8) rawValue = rawValue.substring(0, 8);
      if (rawValue.length > 5) formatted = `${rawValue.slice(0, 5)}-${rawValue.slice(5)}`;
      else formatted = rawValue;
    }

    else {
      // Se não for nenhum dos tipos conhecidos (ex: text, name, etc)
      // retornamos IMEDIATAMENTE sem alterar o valor do input.
      return;
    }

    input.value = formatted;
    let newLength = formatted.length;
    cursorPosition = cursorPosition + (newLength - oldLength);
    input.setSelectionRange(cursorPosition, cursorPosition);

    if (this.control?.control) {
      if (this.maskType === 'date') {
        if (formatted.length === 10) {
          const parts = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (parts) {
            const date = new Date(+parts[3], +parts[2] - 1, +parts[1]);
            if (!isNaN(date.getTime())) {
              this.control.control.setValue(date, { emitEvent: true });
            }
          }
        } else if (formatted.length === 0) {
          if (this.control.control.value !== null) {
            this.control.control.setValue(null, { emitEvent: false });
          }
        }
      } else {
        this.control.control.setValue(formatted, { emitEvent: false });
      }
    }
  }
}
