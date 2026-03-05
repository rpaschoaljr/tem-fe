import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { MembersService } from '../../core/services/members.service';
import { FinanceService } from '../../core/services/finance.service';
import { StockService } from '../../core/services/stock.service';
import { NoticesService } from '../../core/services/notices.service';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin, Observable } from 'rxjs';
import { Notice } from '../../core/models/notice.model';
import { AsyncPipe } from '@angular/common';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    AsyncPipe
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private membersService = inject(MembersService);
  private financeService = inject(FinanceService);
  private stockService = inject(StockService);
  private noticesService = inject(NoticesService);
  private authService = inject(AuthService);

  kpis = { activeMembers: 0, balance: 0, outOfStock: 0 };
  activeNotices$: Observable<Notice[]> | undefined;
  
  // Observables de Permissão
  canManageNotices$: Observable<boolean> = this.authService.canManageNotices();
  canAccessMembers$: Observable<boolean> = this.authService.hasPermission('members', 'read');
  canAccessFinance$: Observable<boolean> = this.authService.hasPermission('finance', 'read');
  canAccessStock$: Observable<boolean> = this.authService.hasPermission('stock', 'read');

  ngOnInit() {
    this.activeNotices$ = this.noticesService.getActiveNotices().pipe(
      tap(notices => console.log('Avisos Ativos (Dashboard):', notices))
    );

    forkJoin({
      members: this.membersService.getMembers(),
      transactions: this.financeService.getTransactions(),
      stock: this.stockService.getStock(),
    }).subscribe(({ members, transactions, stock }) => {
      this.kpis.activeMembers = members.filter(m => !m.deleted).length;

      const active = transactions.filter(t => !t.deleted);
      this.kpis.balance = active.reduce((sum, t) => sum + t.value, 0);

      this.kpis.outOfStock = stock.filter(i => !i.deleted && i.quantity <= 0).length;
    });
  }

  navigate(path: string) {
    this.router.navigate(['/' + path]);
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  getIconForType(type: string): string {
    switch (type) {
      case 'event': return 'event';
      case 'payment': return 'payments';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}