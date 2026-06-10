import { ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';
import { InputMaskDirective } from './input-mask';

describe('InputMaskDirective', () => {
  it('should create an instance', () => {
    const directive = new InputMaskDirective(new ElementRef(null), {} as NgControl);
    expect(directive).toBeTruthy();
  });
});
