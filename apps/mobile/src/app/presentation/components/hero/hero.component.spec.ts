import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HeroComponent } from './hero.component';

describe('HeroComponent', () => {
  let component: HeroComponent;
  let fixture: ComponentFixture<HeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HeroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the hero component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the main hero title', () => {
    const titleElement = fixture.debugElement.query(By.css('.hero-title'));
    expect(titleElement.nativeElement.textContent).toContain('Building Trust in Democratic Institutions');
  });

  it('should display the hero subtitle', () => {
    const subtitleElement = fixture.debugElement.query(By.css('.hero-subtitle'));
    const subtitleText = subtitleElement.nativeElement.textContent;
    expect(subtitleText).toContain('A secure platform for political parties and NGOs');
    expect(subtitleText).toContain('strengthen democratic processes worldwide');
  });

  it('should have primary and secondary call-to-action buttons', () => {
    const primaryButton = fixture.debugElement.query(By.css('.hero-cta'));
    const secondaryButton = fixture.debugElement.query(By.css('.btn-outline'));

    expect(primaryButton).toBeTruthy();
    expect(secondaryButton).toBeTruthy();
    expect(primaryButton.nativeElement.textContent).toContain('Start Your Digital Transformation');
    expect(secondaryButton.nativeElement.textContent).toContain('Learn More');
  });

  it('should display mobile app preview with phone mockup', () => {
    const phoneMockup = fixture.debugElement.query(By.css('.phone-mockup'));
    const appScreen = fixture.debugElement.query(By.css('.app-screen'));

    expect(phoneMockup).toBeTruthy();
    expect(appScreen).toBeTruthy();
  });

  it('should show app header in phone mockup', () => {
    const appHeader = fixture.debugElement.query(By.css('.app-header'));
    expect(appHeader.nativeElement.textContent).toBe('Public Digit');
  });

  it('should display statistics in the app preview', () => {
    const statCards = fixture.debugElement.queryAll(By.css('.stat-card'));
    expect(statCards.length).toBe(2);

    const statNumbers = fixture.debugElement.queryAll(By.css('.stat-number'));
    const statLabels = fixture.debugElement.queryAll(By.css('.stat-label'));

    expect(statNumbers[0].nativeElement.textContent).toBe('312');
    expect(statLabels[0].nativeElement.textContent).toBe('Parties');
    expect(statNumbers[1].nativeElement.textContent).toBe('2.1K');
    expect(statLabels[1].nativeElement.textContent).toBe('NGOs');
  });

  it('should have proper CSS classes for styling', () => {
    const heroSection = fixture.debugElement.query(By.css('.hero-section'));
    const heroContent = fixture.debugElement.query(By.css('.hero-content'));
    const mobilePreview = fixture.debugElement.query(By.css('.mobile-preview'));

    expect(heroSection).toBeTruthy();
    expect(heroContent).toBeTruthy();
    expect(mobilePreview).toBeTruthy();
  });

  it('should have gradient background styling', () => {
    const heroSection = fixture.debugElement.query(By.css('.hero-section'));
    const styles = window.getComputedStyle(heroSection.nativeElement);

    expect(styles.background).toContain('gradient');
  });

  it('should be responsive with container class', () => {
    const container = fixture.debugElement.query(By.css('.container'));
    expect(container).toBeTruthy();
  });
});