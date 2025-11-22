import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { By } from '@angular/platform-browser';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, RouterTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the header component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the Public Digit logo', () => {
    const logoElement = fixture.debugElement.query(By.css('.logo'));
    expect(logoElement.nativeElement.textContent).toContain('Public Digit');
  });

  it('should have a mobile menu toggle button', () => {
    const menuToggle = fixture.debugElement.query(By.css('.menu-toggle'));
    expect(menuToggle).toBeTruthy();
    expect(menuToggle.attributes['aria-label']).toBe('Toggle menu');
  });

  it('should toggle menu when menu button is clicked', () => {
    const menuToggle = fixture.debugElement.query(By.css('.menu-toggle'));

    // Initially menu should be closed
    expect(component.menuOpen).toBe(false);

    // Click to open menu
    menuToggle.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(component.menuOpen).toBe(true);

    // Click again to close menu
    menuToggle.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(component.menuOpen).toBe(false);
  });

  it('should display navigation items when menu is open', () => {
    component.menuOpen = true;
    fixture.detectChanges();

    const navItems = fixture.debugElement.queryAll(By.css('.nav-item'));
    expect(navItems.length).toBeGreaterThan(0);

    const navTexts = navItems.map(item => item.nativeElement.textContent.trim());
    expect(navTexts).toContain('Home');
    expect(navTexts).toContain('Parties');
    expect(navTexts).toContain('NGOs');
  });

  it('should close menu when navigation item is clicked', () => {
    component.menuOpen = true;
    fixture.detectChanges();

    const navItem = fixture.debugElement.query(By.css('.nav-item'));
    navItem.triggerEventHandler('click', null);

    expect(component.menuOpen).toBe(false);
  });

  it('should have login and join buttons in navigation', () => {
    component.menuOpen = true;
    fixture.detectChanges();

    const loginButton = fixture.debugElement.query(By.css('.btn-outline'));
    const joinButton = fixture.debugElement.query(By.css('.btn-primary'));

    expect(loginButton).toBeTruthy();
    expect(joinButton).toBeTruthy();
    expect(loginButton.nativeElement.textContent).toContain('Login');
    expect(joinButton.nativeElement.textContent).toContain('Join');
  });

  it('should apply correct CSS classes for mobile navigation', () => {
    const navElement = fixture.debugElement.query(By.css('.nav'));

    // Initially should not have nav-open class
    expect(navElement.classes['nav-open']).toBeFalsy();

    // When menu is open, should have nav-open class
    component.menuOpen = true;
    fixture.detectChanges();
    expect(navElement.classes['nav-open']).toBeTruthy();
  });

  it('should prevent body scroll when menu is open', () => {
    const originalOverflow = document.body.style.overflow;

    component.toggleMenu();
    expect(document.body.style.overflow).toBe('hidden');

    component.toggleMenu();
    expect(document.body.style.overflow).toBe('');

    // Restore original overflow
    document.body.style.overflow = originalOverflow;
  });
});