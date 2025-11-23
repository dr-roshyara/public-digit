import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FooterSection {
  title: string;
  links: string[];
}

/**
 * Footer Component
 * Responsive footer with multiple sections
 * Mobile-optimized layout
 */
@Component({
  selector: 'pd-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section" *ngFor="let section of footerSections">
            <h3>{{section.title}}</h3>
            <ul class="footer-links">
              <li *ngFor="let link of section.links">
                <a href="#">{{link}}</a>
              </li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <div class="copyright">
            &copy; 2024 Public Digit. Committed to strengthening democracy through technology.
          </div>
          <div class="footer-social">
            <a href="#" class="social-link">Twitter</a>
            <a href="#" class="social-link">LinkedIn</a>
            <a href="#" class="social-link">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  footerSections: FooterSection[] = [
    {
      title: 'Platform',
      links: ['For Political Parties', 'For NGOs', 'Election Management', 'Member Engagement', 'Security Features']
    },
    {
      title: 'Resources',
      links: ['Documentation', 'Case Studies', 'Compliance Guide', 'API Reference', 'Help Center']
    },
    {
      title: 'Company',
      links: ['About Us', 'Transparency Report', 'Careers', 'Contact', 'Security']
    }
  ];
}