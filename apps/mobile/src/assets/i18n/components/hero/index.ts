import en from './en.json';
import np from './np.json';
import de from './de.json';

export interface HeroTranslations {
  title: string;
  subtitle: string;
  features: {
    secure: string;
    transparent: string;
    accessible: string;
    trustworthy: string;
  };
  cta: {
    primary: string;
    secondary: string;
    demo: string;
  };
  stats: {
    organizations: string;
    elections: string;
    votes: string;
    countries: string;
  };
}

export const heroTranslations = {
  en,
  np,
  de
} as const;