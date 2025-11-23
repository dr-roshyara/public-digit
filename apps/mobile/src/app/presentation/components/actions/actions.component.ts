import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActionItem {
  title: string;
  description: string;
  type: 'urgent' | 'normal' | 'success';
  deadline?: string;
}

/**
 * Actions Component
 * Displays current actions with status indicators
 * Touch-optimized card layout
 */
@Component({
  selector: 'pd-actions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="actions-section">
      <div class="container">
        <h2 class="section-title">Current Actions</h2>

        <div class="actions-list">
          <div class="action-card" *ngFor="let action of actions"
               [class]="'action-' + action.type">
            <div class="action-badge" *ngIf="action.type === 'urgent'">
              Urgent
            </div>
            <h3 class="action-title">{{action.title}}</h3>
            <p class="action-description">{{action.description}}</p>
            <div class="action-footer">
              <span class="action-deadline" *ngIf="action.deadline">
                {{action.deadline}}
              </span>
              <button class="btn btn-primary action-button">
                Participate
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./actions.component.scss']
})
export class ActionsComponent {
  actions: ActionItem[] = [
    {
      title: 'Voter Registration Drive',
      description: 'Help register new voters before the upcoming municipal elections across multiple districts.',
      type: 'urgent',
      deadline: 'Deadline: 2 days'
    },
    {
      title: 'Policy Forum: Climate Action',
      description: 'Join the discussion on environmental policies with leading NGOs and policymakers.',
      type: 'normal'
    },
    {
      title: 'Member Growth Initiative',
      description: 'Successful campaign with 15,000 new members joined this month across all parties.',
      type: 'success'
    }
  ];
}