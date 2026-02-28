import { Injectable, signal, effect, inject } from '@angular/core';
import { Platform } from '@angular/cdk/platform';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private platform = inject(Platform);

    darkMode = signal<boolean>(this.getInitialTheme());

    constructor() {
        effect(() => {
            const isDark = this.darkMode();
            if (this.platform.isBrowser) {
                localStorage.setItem('theme', isDark ? 'dark' : 'light');

                if (isDark) {
                    document.documentElement.classList.add('dark-theme');
                    document.body.classList.add('dark-theme');
                } else {
                    document.documentElement.classList.remove('dark-theme');
                    document.body.classList.remove('dark-theme');
                }
            }
        });
    }

    private getInitialTheme(): boolean {
        // Se estiver rodando no navegador
        if (typeof window !== 'undefined' && window.localStorage) {
            const saved = localStorage.getItem('theme');
            if (saved) {
                return saved === 'dark';
            }
            // Pega a preferência do navegador/sistema
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    }

    toggle() {
        this.darkMode.update(val => !val);
    }
}