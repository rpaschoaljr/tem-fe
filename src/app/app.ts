import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ConfigService } from './core/services/config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private themeService = inject(ThemeService);
  private configService = inject(ConfigService);
  protected readonly title = signal('tem-fe');

  ngOnInit() {
    // Inicializa configurações padrões se o banco estiver vazio
    this.configService.ensureInitialized('stock').subscribe();
    this.configService.ensureInitialized('finance').subscribe();
  }
}
