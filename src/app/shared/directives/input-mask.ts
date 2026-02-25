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
  onBlur(event: any): void {
    if (this.maskType !== 'date') return;
    const input = event.target;
    const val = (input.value || '').trim();
    // Se a digitação ficou incompleta, limpa o campo e o control
    if (val.length > 0 && val.length < 10) {
      input.value = '';
      this.control?.control?.setValue(null, { emitEvent: true });
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    const input = event.target;
    // Remove tudo que não é número
    let value = input.value.replace(/\D/g, '');
    let formatted = '';

    // --- MÁSCARA DATA (DD/MM/AAAA) ---
    if (this.maskType === 'date') {
      // Limite máximo: 8 dígitos (DDMMAAAA)
      if (value.length > 8) value = value.substring(0, 8);

      // Validação básica de Dia e Mês enquanto digita
      if (value.length >= 2) {
        const day = parseInt(value.substring(0, 2));
        if (day > 31) value = '31' + value.substring(2);
        if (day === 0) value = '01' + value.substring(2);
      }
      if (value.length >= 4) {
        const month = parseInt(value.substring(2, 4));
        if (month > 12) value = value.substring(0, 2) + '12' + value.substring(4);
        if (month === 0) value = value.substring(0, 2) + '01' + value.substring(4);
      }

      // Formatação visual
      if (value.length > 4) {
        formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
      } else if (value.length > 2) {
        formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
      } else {
        formatted = value;
      }

      // Atualiza display sem mover cursor
      input.value = formatted;

      // Para campos com matDatepicker: seta um Date quando completo, null quando vazio.
      // Isso evita o conflito entre a máscara (string) e o datepicker (Date).
      if (this.control?.control) {
        if (formatted.length === 10) {
          const parts = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (parts) {
            const date = new Date(+parts[3], +parts[2] - 1, +parts[1]);
            const ctrl = this.control.control;
            if (!isNaN(date.getTime())) {
              ctrl.setValue(date, { emitEvent: true });
            } else {
              ctrl.setValue(null, { emitEvent: true });
            }
          }
        } else if (formatted.length === 0) {
          this.control.control.setValue(null, { emitEvent: true });
        }
        // Se digitação parcial (< 10 chars): não altera o control — o DateAdapter
        // tentará parsear no blur via matDatepicker
      }
      return;
    }

    // --- CPF ---
    else if (this.maskType === 'cpf') {
      if (value.length > 11) value = value.substring(0, 11);

      if (value.length > 9) formatted = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
      else if (value.length > 6) formatted = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
      else if (value.length > 3) formatted = `${value.slice(0, 3)}.${value.slice(3)}`;
      else formatted = value;
    }

    // --- TELEFONE ---
    else if (this.maskType === 'phone') {
      if (value.length > 11) value = value.substring(0, 11);

      if (value.length > 10) formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`; // Celular
      else if (value.length > 5) formatted = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`; // Fixo/Digitando
      else if (value.length > 2) formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      else formatted = value;
    }

    // --- CEP ---
    else if (this.maskType === 'cep') {
      if (value.length > 8) value = value.substring(0, 8);
      if (value.length > 5) formatted = `${value.slice(0, 5)}-${value.slice(5)}`;
      else formatted = value;
    }

    else {
      formatted = value;
    }

    input.value = formatted;

    // Atualiza o Angular
    if (this.control && this.control.control) {
      this.control.control.setValue(formatted, { emitEvent: false });
    }
  }
}