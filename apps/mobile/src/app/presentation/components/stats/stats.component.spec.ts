import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { StatsComponent } from './stats.component';
import { Stat } from './stats.component';

describe('StatsComponent', () => {
  let component: StatsComponent;
  let fixture: ComponentFixture<StatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the stats component', () => {
    expect(component).toBeTruthy();
  });

  it('should display all stat items', () => {
    const statItems = fixture.debugElement.queryAll(By.css('.stat-item'));
    expect(statItems.length).toBe(4);
  });

  it('should display correct stat numbers', () => {
    const statNumbers = fixture.debugElement.queryAll(By.css('.stat-number'));
    const numbers = statNumbers.map(number => number.nativeElement.textContent);

    expect(numbers).toContain('312');
    expect(numbers).toContain('2,156');
    expect(numbers).toContain('3.1M');
    expect(numbers).toContain('78');
  });

  it('should display correct stat labels', () => {
    const statLabels = fixture.debugElement.queryAll(By.css('.stat-label'));
    const labels = statLabels.map(label => label.nativeElement.textContent);

    expect(labels).toContain('Political Parties');
    expect(labels).toContain('NGO Partners');
    expect(labels).toContain('Active Members');
    expect(labels).toContain('Countries');
  });

  it('should have correct stats data structure', () => {
    expect(component.stats).toBeDefined();
    expect(component.stats.length).toBe(4);

    const firstStat: Stat = component.stats[0];
    expect(firstStat.number).toBe('312');
    expect(firstStat.label).toBe('Political Parties');
    expect(firstStat.increment).toBe(1);
  });

  it('should have proper section styling with background', () => {
    const statsSection = fixture.debugElement.query(By.css('.stats-section'));
    const styles = window.getComputedStyle(statsSection.nativeElement);

    expect(styles.background).toContain('var(--color-primary)');
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(styles.padding).toBeTruthy();
  });

  it('should have decorative background pattern', () => {
    const statsSection = fixture.debugElement.query(By.css('.stats-section'));
    const styles = window.getComputedStyle(statsSection.nativeElement);

    expect(styles.position).toBe('relative');
    expect(styles.overflow).toBe('hidden');
  });

  it('should have responsive grid layout', () => {
    const statsGrid = fixture.debugElement.query(By.css('.stats-grid'));
    const styles = window.getComputedStyle(statsGrid.nativeElement);

    expect(styles.display).toBe('grid');
    expect(styles.gridTemplateColumns).toBeTruthy();
  });

  it('should have properly styled stat numbers', () => {
    const statNumbers = fixture.debugElement.queryAll(By.css('.stat-number'));

    statNumbers.forEach(number => {
      const styles = window.getComputedStyle(number.nativeElement);
      expect(styles.fontSize).toBeTruthy();
      expect(styles.fontWeight).toBe('800');
      expect(styles.color).toContain('var(--color-secondary)');
    });
  });

  it('should have properly styled stat labels', () => {
    const statLabels = fixture.debugElement.queryAll(By.css('.stat-label'));

    statLabels.forEach(label => {
      const styles = window.getComputedStyle(label.nativeElement);
      expect(styles.fontSize).toBeTruthy();
      expect(styles.opacity).toBeTruthy();
    });
  });

  it('should center align stat items', () => {
    const statItems = fixture.debugElement.queryAll(By.css('.stat-item'));

    statItems.forEach(item => {
      const styles = window.getComputedStyle(item.nativeElement);
      expect(styles.textAlign).toBe('center');
    });
  });

  it('should have proper spacing between stat items', () => {
    const statsGrid = fixture.debugElement.query(By.css('.stats-grid'));
    const styles = window.getComputedStyle(statsGrid.nativeElement);

    expect(styles.gap).toBeTruthy();
  });

  it('should implement OnInit interface', () => {
    expect(component.ngOnInit).toBeDefined();
  });

  it('should have container for proper layout', () => {
    const container = fixture.debugElement.query(By.css('.container'));
    expect(container).toBeTruthy();
  });
});