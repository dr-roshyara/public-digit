import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Stat {
  number: string;
  label: string;
  increment: number;
}

/**
 * Stats Component
 * Displays platform statistics with decorative background
 * Responsive grid layout
 */
@Component({
  selector: 'pd-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="stats-section">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-item" *ngFor="let stat of stats">
            <span class="stat-number">{{stat.number}}</span>
            <div class="stat-label">{{stat.label}}</div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {
  stats: Stat[] = [
    { number: '312', label: 'Political Parties', increment: 1 },
    { number: '2,156', label: 'NGO Partners', increment: 5 },
    { number: '3.1M', label: 'Active Members', increment: 1000 },
    { number: '78', label: 'Countries', increment: 1 }
  ];

  ngOnInit() {
    // Animation for stats could be added here
  }
}