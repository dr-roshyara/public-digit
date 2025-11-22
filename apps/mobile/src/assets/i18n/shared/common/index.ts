import en from './en.json';
import np from './np.json';
import de from './de.json';

export interface CommonTranslations {
  buttons: {
    save: string;
    cancel: string;
    submit: string;
    delete: string;
    edit: string;
    view: string;
    back: string;
    next: string;
    previous: string;
    confirm: string;
    close: string;
    search: string;
    filter: string;
    reset: string;
  };
  labels: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    description: string;
    status: string;
    date: string;
    time: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: {
    loading: string;
    saving: string;
    deleting: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    noData: string;
    noResults: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    minLength: string;
    maxLength: string;
    passwordMismatch: string;
  };
}

export const commonTranslations = {
  en,
  np,
  de
} as const;