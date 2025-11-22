import en from './en.json';
import np from './np.json';
import de from './de.json';

export interface DashboardTranslations {
  header: {
    welcome: string;
    userName: string;
    userEmail: string;
    logout: string;
  };
  stats: {
    sectionTitle: string;
    activeElections: string;
    myVotes: string;
    upcomingElections: string;
  };
  navigation: {
    sectionTitle: string;
    elections: {
      title: string;
      description: string;
    };
    profile: {
      title: string;
      description: string;
    };
    results: {
      title: string;
      description: string;
    };
    settings: {
      title: string;
      description: string;
    };
  };
  footer: {
    platform: string;
    version: string;
  };
}

export const dashboardTranslations = {
  en,
  np,
  de
} as const;