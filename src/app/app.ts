import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  // Injetar para inicializar o efeito de tema logo no começo (incluindo Login)
  private themeService = inject(ThemeService);
  protected readonly title = signal('tem-fe');
}
