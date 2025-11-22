import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ActionsComponent } from './actions.component';
import { ActionItem } from './actions.component';

describe('ActionsComponent', () => {
  let component: ActionsComponent;
  let fixture: ComponentFixture<ActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ActionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the actions component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the section title', () => {
    const titleElement = fixture.debugElement.query(By.css('.section-title'));
    expect(titleElement.nativeElement.textContent).toBe('Current Actions');
  });

  it('should display all action cards', () => {
    const actionCards = fixture.debugElement.queryAll(By.css('.action-card'));
    expect(actionCards.length).toBe(3);
  });

  it('should display correct action titles', () => {
    const actionTitles = fixture.debugElement.queryAll(By.css('.action-title'));
    const titles = actionTitles.map(title => title.nativeElement.textContent);

    expect(titles).toContain('Voter Registration Drive');
    expect(titles).toContain('Policy Forum: Climate Action');
    expect(titles).toContain('Member Growth Initiative');
  });

  it('should display action descriptions', () => {
    const actionDescriptions = fixture.debugElement.queryAll(By.css('.action-description'));
    expect(actionDescriptions.length).toBe(3);

    actionDescriptions.forEach(description => {
      expect(description.nativeElement.textContent.length).toBeGreaterThan(0);
    });
  });

  it('should have correct action data structure', () => {
    expect(component.actions).toBeDefined();
    expect(component.actions.length).toBe(3);

    const urgentAction: ActionItem = component.actions[0];
    expect(urgentAction.title).toBe('Voter Registration Drive');
    expect(urgentAction.type).toBe('urgent');
    expect(urgentAction.deadline).toBe('Deadline: 2 days');
  });

  it('should display urgent badge for urgent actions', () => {
    const urgentBadge = fixture.debugElement.query(By.css('.action-badge'));
    expect(urgentBadge).toBeTruthy();
    expect(urgentBadge.nativeElement.textContent).toBe('Urgent');
  });

  it('should display deadlines for urgent actions', () => {
    const actionDeadlines = fixture.debugElement.queryAll(By.css('.action-deadline'));
    expect(actionDeadlines.length).toBe(1);
    expect(actionDeadlines[0].nativeElement.textContent).toBe('Deadline: 2 days');
  });

  it('should apply correct CSS classes based on action type', () => {
    const actionCards = fixture.debugElement.queryAll(By.css('.action-card'));

    // First card should be urgent
    expect(actionCards[0].classes['action-urgent']).toBeTruthy();

    // Second card should be normal (no specific class)
    expect(actionCards[1].classes['action-urgent']).toBeFalsy();
    expect(actionCards[1].classes['action-success']).toBeFalsy();

    // Third card should be success
    expect(actionCards[2].classes['action-success']).toBeTruthy();
  });

  it('should have participate buttons for all actions', () => {
    const participateButtons = fixture.debugElement.queryAll(By.css('.action-button'));
    expect(participateButtons.length).toBe(3);

    participateButtons.forEach(button => {
      expect(button.nativeElement.textContent).toBe('Participate');
    });
  });

  it('should have proper action footer layout', () => {
    const actionFooters = fixture.debugElement.queryAll(By.css('.action-footer'));
    expect(actionFooters.length).toBe(3);

    actionFooters.forEach(footer => {
      const styles = window.getComputedStyle(footer.nativeElement);
      expect(styles.display).toBe('flex');
      expect(styles.justifyContent).toBe('space-between');
    });
  });

  it('should apply different border colors based on action type', () => {
    const actionCards = fixture.debugElement.queryAll(By.css('.action-card'));

    // Urgent action should have accent color border
    const urgentCardStyles = window.getComputedStyle(actionCards[0].nativeElement);
    expect(urgentCardStyles.borderLeftColor).toBeTruthy();

    // Success action should have success color border
    const successCardStyles = window.getComputedStyle(actionCards[2].nativeElement);
    expect(successCardStyles.borderLeftColor).toBeTruthy();
  });

  it('should have proper section styling', () => {
    const actionsSection = fixture.debugElement.query(By.css('.actions-section'));
    const styles = window.getComputedStyle(actionsSection.nativeElement);

    expect(styles.padding).toBeTruthy();
    expect(styles.background).toContain('var(--color-background)');
  });

  it('should have responsive action list layout', () => {
    const actionsList = fixture.debugElement.query(By.css('.actions-list'));
    const styles = window.getComputedStyle(actionsList.nativeElement);

    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('column');
  });
});