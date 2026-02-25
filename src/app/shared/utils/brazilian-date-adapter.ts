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

            // Formato DD/MM/AAAA (digitado com máscara)
            const parts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (parts) {
                const day = +parts[1];
                const month = +parts[2] - 1;
                const year = +parts[3];
                const date = new Date(year, month, day);
                return isNaN(date.getTime()) ? null : date;
            }

            // Fallback nativo (ISO, etc.)
            const ts = Date.parse(trimmed);
            return isNaN(ts) ? null : new Date(ts);
        }
        return value instanceof Date ? value : null;
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
