import { Injectable, signal, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private platform = inject(Platform);

    // Começa false (Light) por padrão para testarmos a troca
    darkMode = signal<boolean>(false);

    constructor() {
        this.loadTheme();

        effect(() => {
            const isDark = this.darkMode();
            //console.log('Aplicando tema Escuro?', isDark);

            if (this.platform.isBrowser) {
                localStorage.setItem('theme', isDark ? 'dark' : 'light');

                if (isDark) {
                    document.documentElement.classList.add('dark-theme');
                    document.body.classList.add('dark-theme'); // Garante no body também
                } else {
                    document.documentElement.classList.remove('dark-theme');
                    document.body.classList.remove('dark-theme');
                }
            }
        });
    }

    toggle() {
        //console.log('Botão clicado!'); // <--- Verifique se isso aparece
        this.darkMode.update(val => !val);
    }

    private loadTheme() {
        if (this.platform.isBrowser) {
            const saved = localStorage.getItem('theme');
            if (saved) {
                this.darkMode.set(saved === 'dark');
            } else {
                const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.darkMode.set(systemDark);
            }
        }
    }
}