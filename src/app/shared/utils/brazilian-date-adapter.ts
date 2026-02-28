import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * DateAdapter customizado que aceita digitação no formato DD/MM/AAAA (pt-BR).
 * Registrado globalmente em app.config.ts.
 */
@Injectable()
export class BrazilianDateAdapter extends NativeDateAdapter {
    override parse(value: any): Date | null {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.length === 0) return null;

            // FORMATO RÍGIDO: DD/MM/AAAA
            // Só aceitamos se tiver exatamente 10 caracteres e seguir o padrão brasileiro
            const parts = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (parts) {
                const day = +parts[1];
                const month = +parts[2] - 1;
                const year = +parts[3];
                const date = new Date(year, month, day);
                
                // Validação extra para garantir que o JS não "corrigiu" a data 
                // (ex: 31/02 -> 03/03). Se mudou o dia/mês, a data era inválida.
                if (date.getFullYear() === year && 
                    date.getMonth() === month && 
                    date.getDate() === day) {
                    return date;
                }
            }

            // Bloqueia QUALQUER outro tipo de parsing automático do NativeDateAdapter
            // Isso mata o bug de digitar "12" e ele virar um mês/ano aleatório.
            return null;
        }
        return value instanceof Date ? (isNaN(value.getTime()) ? null : value) : null;
    }

    override format(date: Date, _displayFormat: object): string {
        if (!this.isValid(date)) return '';
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${d}/${m}/${date.getFullYear()}`;
    }
}

export const BR_DATE_FORMATS = {
    parse: { dateInput: 'DD/MM/YYYY' },
    display: {
        dateInput: 'DD/MM/YYYY',
        monthYearLabel: 'MMM YYYY',
        dateA11yLabel: 'DD/MM/YYYY',
        monthYearA11yLabel: 'MMMM YYYY',
    },
};
