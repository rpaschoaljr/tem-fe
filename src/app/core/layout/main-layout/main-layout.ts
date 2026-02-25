import { Component, ViewChild, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { Auth, signOut, authState } from '@angular/fire/auth';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    AsyncPipe
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayoutComponent {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private auth = inject(Auth);

  @ViewChild('drawer') drawer!: MatSidenav;
  themeService = inject(ThemeService);

  currentUser$ = authState(this.auth);
  // Detecta se é celular (Handset)
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  // Menu de Navegação
  menuItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Membros', icon: 'groups', route: '/members' },
    { label: 'Financeiro', icon: 'attach_money', route: '/finance' }, // Futuro
    { label: 'Estoque', icon: 'inventory_2', route: '/stock' },       // Futuro
  ];

  // Fecha o menu automaticamente no celular ao clicar em um item
  closeSideNavIfMobile() {
    this.isHandset$.subscribe(isHandset => {
      if (isHandset) {
        this.drawer.close();
      }
    });
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}