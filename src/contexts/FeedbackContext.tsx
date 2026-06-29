'use client';

import type { AxiosError } from 'axios';
import { createContext, type ReactNode, useContext } from 'react';
import { toaster } from '~/components/ui/toaster';

interface IFeedbackProviderProps {
  children: ReactNode;
}

type FeedbackContextData = {
  // biome-ignore lint/suspicious/noExplicitAny: erro pode vir de várias fontes
  errorFeedbackToast: (title: string, error: any) => void;
  infoFeedbackToast: (title: string, description?: string) => void;
  warningFeedbackToast: (title: string, description?: string) => void;
  successFeedbackToast: (title: string, description?: string) => void;
  dangerFeedbackToast: (title: string, description?: string) => void;
};

const FeedbackContext = createContext({} as FeedbackContextData);

export function FeedbackProvider({ children }: IFeedbackProviderProps) {
  function genericFeedbackToast(
    title: string,
    description?: string,
    type?: 'success' | 'error' | 'warning' | 'loading' | 'info',
  ) {
    toaster.create({ title, description, type });
  }

  function infoFeedbackToast(title: string, description?: string) {
    genericFeedbackToast(title, description, 'info');
  }

  function warningFeedbackToast(title: string, description?: string) {
    genericFeedbackToast(title, description, 'warning');
  }

  function successFeedbackToast(title: string, description?: string) {
    genericFeedbackToast(title, description, 'success');
  }

  function dangerFeedbackToast(title: string, description?: string) {
    genericFeedbackToast(title, description, 'error');
  }

  // biome-ignore lint/suspicious/noExplicitAny: erro pode vir de várias fontes
  function errorFeedbackToast(title: string, error: any): void {
    const axiosError = error as AxiosError<{ message?: string }>;
    if (axiosError?.response) {
      const message = axiosError.response.data?.message;
      if (axiosError.response.status >= 500) {
        dangerFeedbackToast(title, message ?? 'Erro no servidor.');
      } else {
        warningFeedbackToast(title, message ?? 'Requisição inválida.');
      }
    } else if (error?.message) {
      dangerFeedbackToast(title, `Ocorreu um erro: ${error.message}`);
    } else {
      dangerFeedbackToast(title, `Ocorreu um erro: ${error}`);
    }
  }

  return (
    <FeedbackContext.Provider
      value={{
        errorFeedbackToast,
        infoFeedbackToast,
        warningFeedbackToast,
        successFeedbackToast,
        dangerFeedbackToast,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
