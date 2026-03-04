import { Component, ViewChild, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
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
    AsyncPipe
  ],
  templateUrl: './main-layout.html',
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

  // Detecta se é celular (Handset)
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      tap(isHandset => {
        this.isSidebarOpened = !isHandset;
      }),
      shareReplay()
    );

  // Lista Completa de Menus
  private allMenuItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', module: 'dashboard' },
    { label: 'Membros', icon: 'groups', route: '/members', module: 'members' },
    { label: 'Financeiro', icon: 'attach_money', route: '/finance', module: 'finance' },
    { label: 'Estoque', icon: 'inventory_2', route: '/stock', module: 'stock' },
    { label: 'Avisos', icon: 'campaign', route: '/notices', module: 'notices' },
  ];

  menuItems = signal<any[]>([]);

  ngOnInit() {
    this.loadMenu();
  }

  loadMenu() {
    combineLatest(
      this.allMenuItems.map(item => 
        item.module === 'dashboard' 
          ? of(true) 
          : this.authService.hasPermission(item.module, 'read')
      )
    ).subscribe((results: boolean[]) => {
      const allowed = this.allMenuItems.filter((_, index) => results[index]);
      this.menuItems.set(allowed);
    });
  }

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