import { Directive, HostListener, Input, ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: '[appInputMask]',
  standalone: true
})
export class InputMaskDirective {
  @Input('appInputMask') maskType: string = '';

  constructor(private el: ElementRef, private control: NgControl) { }

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    const input = event.target;
    // Remove tudo que não é número
    let value = input.value.replace(/\D/g, '');
    let formatted = '';

    // --- MÁSCARA DATA (DD/MM/AAAA ou DD/MM/AA) ---
    if (this.maskType === 'date') {
      // Limite máximo: 8 dígitos (DDMMAAAA)
      if (value.length > 8) value = value.substring(0, 8);

      // Validação básica de Dia e Mês enquanto digita
      // Se tiver pelo menos 2 dígitos (DIA), verifica se é > 31
      if (value.length >= 2) {
        const day = parseInt(value.substring(0, 2));
        if (day > 31) value = '31' + value.substring(2);
        if (day === 0) value = '01' + value.substring(2);
      }

      // Se tiver pelo menos 4 dígitos (MÊS), verifica se é > 12
      if (value.length >= 4) {
        const month = parseInt(value.substring(2, 4));
        if (month > 12) value = value.substring(0, 2) + '12' + value.substring(4);
        if (month === 0) value = value.substring(0, 2) + '01' + value.substring(4);
      }

      // Formatação Visual
      if (value.length > 4) {
        // DD/MM/AAAA
        formatted = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
      } else if (value.length > 2) {
        // DD/MM
        formatted = `${value.slice(0, 2)}/${value.slice(2)}`;
      } else {
        formatted = value;
      }
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