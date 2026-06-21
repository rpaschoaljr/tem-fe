import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ConfigService } from './core/services/config.service';
import { AuthService } from './core/services/auth.service';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private themeService = inject(ThemeService);
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  protected readonly title = signal('tem-fe');

  ngOnInit() {
    // Inicializa configurações padrões apenas se o usuário estiver logado
    this.authService.user$.pipe(
      filter(u => !!u),
      take(1)
    ).subscribe(() => {
      this.configService.ensureInitialized('stock').subscribe();
      this.configService.ensureInitialized('finance').subscribe();
    });
  }
}
