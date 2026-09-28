'use client';

import { queryClient } from '~/services/queryClient';

/**
 * Descarta tudo que o navegador guardou da sessão anterior: o cache do TanStack
 * Query (módulo singleton — sobrevive a navegações suaves) e os caches de runtime
 * do service worker. O precache do Workbox (assets do build) é preservado.
 */
async function clearClientState(): Promise<void> {
  queryClient.clear();
  if (typeof caches === 'undefined') {
    return;
  }
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => !n.startsWith('workbox-precache')).map((n) => caches.delete(n)),
    );
  } catch {
    // Cache Storage indisponível (modo privado etc.): nada a limpar.
  }
}

/**
 * Entra na área logada com recarga completa, para que nenhum dado em memória de
 * outra sessão (mesma aba) apareça antes do refetch.
 */
export async function enterApp(path: string): Promise<void> {
  await clearClientState();
  window.location.assign(path);
}

/** Encerra a sessão: apaga o cookie no servidor e limpa o estado do client. */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Mesmo sem rede, limpamos o client e vamos para o login.
  }
  await clearClientState();
  window.location.assign('/login');
}
