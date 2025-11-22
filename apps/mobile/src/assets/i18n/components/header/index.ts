import en from './en.json';
import np from './np.json';
import de from './de.json';

export interface HeaderTranslations {
  brand: {
    name: string;
    tagline: string;
  };
  navigation: {
    home: string;
    elections: string;
    membership: string;
    about: string;
    contact: string;
  };
  auth: {
    login: string;
    register: string;
    logout: string;
    dashboard: string;
  };
  language: {
    switch: string;
    current: string;
  };
}

export const headerTranslations = {
  en,
  np,
  de
} as const;