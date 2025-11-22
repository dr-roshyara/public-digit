import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FeaturesComponent } from './features.component';
import { Feature } from './features.component';

describe('FeaturesComponent', () => {
  let component: FeaturesComponent;
  let fixture: ComponentFixture<FeaturesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the features component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the section title', () => {
    const titleElement = fixture.debugElement.query(By.css('.section-title'));
    expect(titleElement.nativeElement.textContent).toBe('Why Choose Public Digit?');
  });

  it('should display the section subtitle', () => {
    const subtitleElement = fixture.debugElement.query(By.css('.section-subtitle'));
    expect(subtitleElement.nativeElement.textContent).toContain('Designed specifically for the unique needs');
  });

  it('should display all feature cards', () => {
    const featureCards = fixture.debugElement.queryAll(By.css('.feature-card'));
    expect(featureCards.length).toBe(4);
  });

  it('should display correct feature titles', () => {
    const featureTitles = fixture.debugElement.queryAll(By.css('.feature-title'));
    const titles = featureTitles.map(title => title.nativeElement.textContent);

    expect(titles).toContain('Secure & Compliant');
    expect(titles).toContain('Global Reach');
    expect(titles).toContain('Advanced Analytics');
    expect(titles).toContain('Member Engagement');
  });

  it('should display feature icons', () => {
    const featureIcons = fixture.debugElement.queryAll(By.css('.feature-icon'));
    expect(featureIcons.length).toBe(4);

    // Check that icons have content (emoji or icon)
    featureIcons.forEach(icon => {
      expect(icon.nativeElement.textContent).toBeTruthy();
    });
  });

  it('should display feature descriptions', () => {
    const featureDescriptions = fixture.debugElement.queryAll(By.css('.feature-description'));
    expect(featureDescriptions.length).toBe(4);

    featureDescriptions.forEach(description => {
      expect(description.nativeElement.textContent.length).toBeGreaterThan(0);
    });
  });

  it('should have correct feature data structure', () => {
    expect(component.features).toBeDefined();
    expect(component.features.length).toBe(4);

    const firstFeature: Feature = component.features[0];
    expect(firstFeature.title).toBe('Secure & Compliant');
    expect(firstFeature.description).toContain('Enterprise-grade security');
    expect(firstFeature.icon).toBe('🔒');
    expect(firstFeature.color).toBe('var(--color-primary)');
  });

  it('should apply border colors from feature data', () => {
    const featureCards = fixture.debugElement.queryAll(By.css('.feature-card'));

    featureCards.forEach((card, index) => {
      const feature = component.features[index];
      const borderColor = card.styles['border-color'];
      expect(borderColor).toBe(feature.color);
    });
  });

  it('should apply background colors to feature icons', () => {
    const featureIcons = fixture.debugElement.queryAll(By.css('.feature-icon'));

    featureIcons.forEach((icon, index) => {
      const feature = component.features[index];
      const backgroundColor = icon.styles['background'];
      expect(backgroundColor).toBe(feature.color);
    });
  });

  it('should have responsive grid layout', () => {
    const featuresGrid = fixture.debugElement.query(By.css('.features-grid'));
    expect(featuresGrid).toBeTruthy();

    const gridStyles = window.getComputedStyle(featuresGrid.nativeElement);
    expect(gridStyles.display).toBe('grid');
  });

  it('should have hover effects on feature cards', () => {
    const featureCard = fixture.debugElement.query(By.css('.feature-card'));
    const styles = window.getComputedStyle(featureCard.nativeElement);

    expect(styles.transition).toContain('transform');
    expect(styles.transition).toContain('box-shadow');
  });

  it('should have proper section styling', () => {
    const featuresSection = fixture.debugElement.query(By.css('.features-section'));
    const styles = window.getComputedStyle(featuresSection.nativeElement);

    expect(styles.padding).toBeTruthy();
    expect(styles.background).toContain('var(--color-surface)');
  });
});