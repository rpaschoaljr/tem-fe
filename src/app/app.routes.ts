import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { FirstAccessComponent } from './features/auth/first-access/first-access';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  // Rota Pública (Sem Layout)
  { path: 'login', component: LoginComponent },
  { path: 'first-access', component: FirstAccessComponent, canActivate: [authGuard] },

  // Rotas Protegidas (Dentro do Layout com Menu)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },

      // ── Lazy-loaded features ──
      {
        path: 'members',
        canActivate: [permissionGuard],
        data: { module: 'members', action: 'read' },
        loadComponent: () => import('./features/members/members').then(m => m.MembersComponent),
      },
      {
        path: 'members/new',
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { module: 'members', action: 'write' },
        loadComponent: () => import('./features/members/member-form/member-form').then(m => m.MemberFormComponent),
      },
      {
        path: 'members/edit/:id',
        canActivate: [permissionGuard],
        canDeactivate: [pendingChangesGuard],
        data: { module: 'members', action: 'write' },
        loadComponent: () => import('./features/members/member-form/member-form').then(m => m.MemberFormComponent),
      },
      {
        path: 'finance',
        canActivate: [permissionGuard],
        data: { module: 'finance', action: 'read' },
        loadComponent: () => import('./features/finance/finance').then(m => m.FinanceComponent),
      },
      {
        path: 'finance/report',
        canActivate: [permissionGuard],
        data: { module: 'finance', action: 'read' },
        loadComponent: () => import('./features/finance/finance-report/finance-report').then(m => m.FinanceReport),
      },
      {
        path: 'stock',
        canActivate: [permissionGuard],
        data: { module: 'stock', action: 'read' },
        loadComponent: () => import('./features/stock/stock').then(m => m.StockComponent),
      },
      {
        path: 'pdv',
        canActivate: [permissionGuard],
        data: { module: 'pdv', action: 'read' },
        loadComponent: () => import('./features/pdv/pdv').then(m => m.Pdv),
      },
      {
        path: 'profile',
        canDeactivate: [pendingChangesGuard],
        loadComponent: () => import('./features/profile/profile').then(m => m.ProfileComponent),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard],
        data: { module: 'settings', action: 'read' },
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent),
      },
      {
        path: 'notices',
        canActivate: [permissionGuard],
        data: { module: 'notices', action: 'read' },
        loadComponent: () => import('./features/notices/notices').then(m => m.NoticesComponent),
      },
      {
        path: 'notices/archive',
        canActivate: [permissionGuard],
        data: { module: 'notices', action: 'read' },
        loadComponent: () => import('./features/notices/notices').then(m => m.NoticesComponent),
      },
      {
        path: 'notices/trash',
        canActivate: [permissionGuard],
        data: { module: 'notices', action: 'write' },
        loadComponent: () => import('./features/notices/notices').then(m => m.NoticesComponent),
      },
    ]
  },

  // Redireciona qualquer rota errada para o login
  { path: '**', redirectTo: 'login' }
];
