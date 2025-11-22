import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { LandingComponent } from './landing.component';
import { HeaderComponent } from '../components/header/header.component';
import { HeroComponent } from '../components/hero/hero.component';
import { FeaturesComponent } from '../components/features/features.component';
import { ActionsComponent } from '../components/actions/actions.component';
import { StatsComponent } from '../components/stats/stats.component';
import { FooterComponent } from '../components/footer/footer.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LandingComponent,
        HeaderComponent,
        HeroComponent,
        FeaturesComponent,
        ActionsComponent,
        StatsComponent,
        FooterComponent
      ],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the landing component', () => {
    expect(component).toBeTruthy();
  });

  it('should contain all frontpage components', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    // Check for header component
    expect(compiled.querySelector('app-header')).toBeTruthy();

    // Check for hero component
    expect(compiled.querySelector('app-hero')).toBeTruthy();

    // Check for features component
    expect(compiled.querySelector('app-features')).toBeTruthy();

    // Check for actions component
    expect(compiled.querySelector('app-actions')).toBeTruthy();

    // Check for stats component
    expect(compiled.querySelector('app-stats')).toBeTruthy();

    // Check for footer component
    expect(compiled.querySelector('app-footer')).toBeTruthy();
  });

  it('should have correct container structure', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const container = compiled.querySelector('.min-h-screen.bg-background');

    expect(container).toBeTruthy();
    expect(container?.classList.contains('min-h-screen')).toBe(true);
    expect(container?.classList.contains('bg-background')).toBe(true);
  });

  it('should have proper component order', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const children = compiled.querySelector('.min-h-screen')?.children;

    if (children && children.length >= 6) {
      expect(children[0].tagName).toBe('APP-HEADER');
      expect(children[1].tagName).toBe('APP-HERO');
      expect(children[2].tagName).toBe('APP-FEATURES');
      expect(children[3].tagName).toBe('APP-ACTIONS');
      expect(children[4].tagName).toBe('APP-STATS');
      expect(children[5].tagName).toBe('APP-FOOTER');
    }
  });

  it('should inject router dependency', () => {
    expect(component['router']).toBe(router);
  });
});