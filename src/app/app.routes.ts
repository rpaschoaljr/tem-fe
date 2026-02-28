import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { MembersComponent } from './features/members/members';
import { FinanceComponent } from './features/finance/finance';
import { StockComponent } from './features/stock/stock';
import { MemberFormComponent } from './features/members/member-form/member-form';
import { ProfileComponent } from './features/profile/profile';
import { NoticesComponent } from './features/notices/notices';
import { pendingChangesGuard } from './core/guards/pending-changes.guard';

export const routes: Routes = [
    // Rota Pública (Sem Layout)
    { path: 'login', component: LoginComponent },

    // Rotas Protegidas (Dentro do Layout com Menu)
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent },
            { path: 'members', component: MembersComponent },
            { path: 'finance', component: FinanceComponent },
            { path: 'stock', component: StockComponent },
            { path: 'profile', component: ProfileComponent, canDeactivate: [pendingChangesGuard] },
            { path: 'notices', component: NoticesComponent },
            { path: 'notices/archive', component: NoticesComponent },
            { path: 'notices/trash', component: NoticesComponent },
            { path: 'members/new', component: MemberFormComponent, canDeactivate: [pendingChangesGuard] },
            { path: 'members/edit/:id', component: MemberFormComponent, canDeactivate: [pendingChangesGuard] },
        ]
    },

    // Redireciona qualquer rota errada para o login
    { path: '**', redirectTo: 'login' }
];