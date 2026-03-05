import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { FirstAccessComponent } from './features/auth/first-access/first-access';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { MembersComponent } from './features/members/members';
import { FinanceComponent } from './features/finance/finance';
import { StockComponent } from './features/stock/stock';
import { MemberFormComponent } from './features/members/member-form/member-form';
import { ProfileComponent } from './features/profile/profile';
import { NoticesComponent } from './features/notices/notices';
import { SettingsComponent } from './features/settings/settings';
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
            
            { 
              path: 'members', 
              component: MembersComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'members', action: 'read' } 
            },
            { 
              path: 'finance', 
              component: FinanceComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'finance', action: 'read' } 
            },
            { 
              path: 'stock', 
              component: StockComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'stock', action: 'read' } 
            },
            { 
              path: 'profile', 
              component: ProfileComponent, 
              canDeactivate: [pendingChangesGuard] 
            },
            { 
              path: 'settings', 
              component: SettingsComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'settings', action: 'read' } 
            },
            { 
              path: 'notices', 
              component: NoticesComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'notices', action: 'read' } 
            },
            { 
              path: 'notices/archive', 
              component: NoticesComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'notices', action: 'read' } 
            },
            { 
              path: 'notices/trash', 
              component: NoticesComponent, 
              canActivate: [permissionGuard], 
              data: { module: 'notices', action: 'write' } 
            },
            
            // Sub-rotas de Escrita
            { 
              path: 'members/new', 
              component: MemberFormComponent, 
              canActivate: [permissionGuard], 
              canDeactivate: [pendingChangesGuard],
              data: { module: 'members', action: 'write' } 
            },
            { 
              path: 'members/edit/:id', 
              component: MemberFormComponent, 
              canActivate: [permissionGuard], 
              canDeactivate: [pendingChangesGuard],
              data: { module: 'members', action: 'write' } 
            },
        ]
    },

    // Redireciona qualquer rota errada para o login
    { path: '**', redirectTo: 'login' }
];
