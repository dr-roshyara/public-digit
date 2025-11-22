import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FooterComponent } from './footer.component';
import { FooterSection } from './footer.component';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the footer component', () => {
    expect(component).toBeTruthy();
  });

  it('should display all footer sections', () => {
    const footerSections = fixture.debugElement.queryAll(By.css('.footer-section'));
    expect(footerSections.length).toBe(3);
  });

  it('should display correct section titles', () => {
    const sectionTitles = fixture.debugElement.queryAll(By.css('.footer-section h3'));
    const titles = sectionTitles.map(title => title.nativeElement.textContent);

    expect(titles).toContain('Platform');
    expect(titles).toContain('Resources');
    expect(titles).toContain('Company');
  });

  it('should display all footer links', () => {
    const footerLinks = fixture.debugElement.queryAll(By.css('.footer-links a'));
    expect(footerLinks.length).toBeGreaterThan(0);
  });

  it('should have correct footer sections data structure', () => {
    expect(component.footerSections).toBeDefined();
    expect(component.footerSections.length).toBe(3);

    const platformSection: FooterSection = component.footerSections[0];
    expect(platformSection.title).toBe('Platform');
    expect(platformSection.links).toContain('For Political Parties');
    expect(platformSection.links).toContain('For NGOs');
  });

  it('should display copyright information', () => {
    const copyright = fixture.debugElement.query(By.css('.copyright'));
    expect(copyright).toBeTruthy();
    expect(copyright.nativeElement.textContent).toContain('Public Digit');
    expect(copyright.nativeElement.textContent).toContain('strengthening democracy');
  });

  it('should display social media links', () => {
    const socialLinks = fixture.debugElement.queryAll(By.css('.social-link'));
    expect(socialLinks.length).toBe(3);

    const linkTexts = socialLinks.map(link => link.nativeElement.textContent);
    expect(linkTexts).toContain('Twitter');
    expect(linkTexts).toContain('LinkedIn');
    expect(linkTexts).toContain('GitHub');
  });

  it('should have proper footer styling', () => {
    const footer = fixture.debugElement.query(By.css('.footer'));
    const styles = window.getComputedStyle(footer.nativeElement);

    expect(styles.background).toContain('var(--color-primary-dark)');
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(styles.padding).toBeTruthy();
  });

  it('should have responsive grid layout for footer content', () => {
    const footerContent = fixture.debugElement.query(By.css('.footer-content'));
    const styles = window.getComputedStyle(footerContent.nativeElement);

    expect(styles.display).toBe('grid');
    expect(styles.gridTemplateColumns).toBeTruthy();
  });

  it('should have proper section title styling', () => {
    const sectionTitle = fixture.debugElement.query(By.css('.footer-section h3'));
    const styles = window.getComputedStyle(sectionTitle.nativeElement);

    expect(styles.color).toContain('var(--color-secondary)');
    expect(styles.fontWeight).toBe('600');
  });

  it('should have hover effects on footer links', () => {
    const footerLink = fixture.debugElement.query(By.css('.footer-links a'));
    const styles = window.getComputedStyle(footerLink.nativeElement);

    expect(styles.transition).toContain('color');
    expect(styles.transition).toContain('transform');
  });

  it('should have proper footer bottom layout', () => {
    const footerBottom = fixture.debugElement.query(By.css('.footer-bottom'));
    const styles = window.getComputedStyle(footerBottom.nativeElement);

    expect(styles.borderTop).toBeTruthy();
    expect(styles.paddingTop).toBeTruthy();
  });

  it('should have social links properly styled', () => {
    const socialLinks = fixture.debugElement.queryAll(By.css('.social-link'));

    socialLinks.forEach(link => {
      const styles = window.getComputedStyle(link.nativeElement);
      expect(styles.color).toContain('rgba');
      expect(styles.textDecoration).toBe('none');
    });
  });

  it('should have container for proper layout', () => {
    const container = fixture.debugElement.query(By.css('.container'));
    expect(container).toBeTruthy();
  });

  it('should have proper spacing between footer sections', () => {
    const footerContent = fixture.debugElement.query(By.css('.footer-content'));
    const styles = window.getComputedStyle(footerContent.nativeElement);

    expect(styles.gap).toBeTruthy();
  });

  it('should have proper link list styling', () => {
    const footerLinks = fixture.debugElement.query(By.css('.footer-links'));
    const styles = window.getComputedStyle(footerLinks.nativeElement);

    expect(styles.listStyle).toBe('none');
  });
});