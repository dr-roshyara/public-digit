import en from './en.json';
import np from './np.json';
import de from './de.json';

export interface LoginTranslations {
  title: string;
  subtitle: string;
  form: {
    email: {
      label: string;
      placeholder: string;
    };
    password: {
      label: string;
      placeholder: string;
    };
    rememberMe: string;
    forgotPassword: string;
    submit: string;
    loading: string;
  };
  errors: {
    invalidCredentials: string;
    networkError: string;
    requiredField: string;
  };
  links: {
    noAccount: string;
    register: string;
    backToHome: string;
  };
}

export const loginTranslations = {
  en,
  np,
  de
} as const;