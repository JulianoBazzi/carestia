import axios from 'axios';

/**
 * Cliente axios para as rotas internas. Auth é via cookie JWT httpOnly,
 * enviado automaticamente em requests same-origin (`withCredentials`).
 */
export function setupAPIClient() {
  return axios.create({
    baseURL: '',
    withCredentials: true,
  });
}

export const api = setupAPIClient();
