import { Component, ViewChild, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable, combineLatest, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { Auth, signOut, authState } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';

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
    MatMenuModule,
    MatDividerModule,
    MatProgressBarModule,
    AsyncPipe
  ],
  templateUrl: './main-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './main-layout.scss'
})
export class MainLayoutComponent implements OnInit {
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private auth = inject(Auth);
  private authService = inject(AuthService);

  @ViewChild('drawer') drawer!: MatSidenav;
  themeService = inject(ThemeService);

  currentUser$ = authState(this.auth).pipe(shareReplay(1));
  member$ = this.authService.member$;
  isAdmin$ = this.authService.isAdmin$();
  isSidebarOpened = true;

  // Detecta se é tela pequena (<960px) — mostra hamburger
  isSmallScreen$: Observable<boolean> = this.breakpointObserver.observe('(max-width: 959px)')
    .pipe(
      map(result => result.matches),
      tap(isSmall => {
        this.isSidebarOpened = !isSmall;
      }),
      shareReplay()
    );

  // Lista Completa de Menus
  private allMenuItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', module: 'dashboard' },
    { label: 'Membros', icon: 'groups', route: '/members', module: 'members' },
    { label: 'Financeiro', icon: 'attach_money', route: '/finance', module: 'finance' },
    { label: 'Estoque', icon: 'inventory_2', route: '/stock', module: 'stock' },
    { label: 'Vendas (PDV)', icon: 'storefront', route: '/sales', module: 'pdv' },
    { label: 'Avisos', icon: 'campaign', route: '/notices', module: 'notices' },
    { label: 'Configurações', icon: 'settings', route: '/settings', module: 'settings' },
  ];

  menuItems = signal(this.allMenuItems.filter(m => m.module === 'dashboard'));
  menuLoading = signal(true);

  ngOnInit() {
    this.loadMenu();
  }

  loadMenu() {
    const restrictedItems = this.allMenuItems.filter(m => m.module !== 'dashboard');
    
    restrictedItems.forEach(item => {
      this.authService.hasPermission(item.module, 'read').subscribe(hasPerm => {
        if (hasPerm) {
          this.menuItems.update(items => {
            if (!items.find(i => i.module === item.module)) {
              return [...items, item];
            }
            return items;
          });
        }
        // Check if all items have been evaluated
        const checked = restrictedItems.filter(i => 
          this.menuItems().some(m => m.module === i.module) || 
          // Count evaluated items
          this.allMenuItems.some(m => m.module === i.module)
        );
      });
    });

    // Stop loading after all permission checks complete (max ~3s from auth service)
    this.authService.permissions$.subscribe(() => {
      this.menuLoading.set(false);
    });
  }

  closeSideNavIfMobile() {
    this.isSmallScreen$.subscribe(isSmall => {
      if (isSmall) {
        this.drawer.close();
      }
    });
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}