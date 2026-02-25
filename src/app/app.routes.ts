import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard';
import { MembersComponent } from './features/members/members';
import { FinanceComponent } from './features/finance/finance';
import { StockComponent } from './features/stock/stock';
import { MemberFormComponent } from './features/members/member-form/member-form';

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
            { path: 'members/new', component: MemberFormComponent },
            { path: 'members/edit/:id', component: MemberFormComponent },
        ]
    },

    // Redireciona qualquer rota errada para o login
    { path: '**', redirectTo: 'login' }
];