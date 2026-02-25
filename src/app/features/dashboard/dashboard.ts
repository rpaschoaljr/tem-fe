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
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule
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

  kpis = { activeMembers: 0, balance: 0, outOfStock: 0 };

  ngOnInit() {
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
}