'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_URL_GEO_REVERSE } from '~/config/constants';
import { api } from '~/services/apiClient';

/** Região do usuário para o recorte de preços. Só cidade/UF — nunca a coordenada. */
export interface IUserLocation {
  city: string;
  state: string;
  ibge_code: string | null;
  source: 'gps' | 'manual';
}

export type UserLocationStatus =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'denied'
  | 'unsupported'
  | 'outside'
  | 'error';

const STORAGE_KEY = 'carestia:location';

function readStored(): IUserLocation | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<IUserLocation>;
    if (typeof parsed.city === 'string' && typeof parsed.state === 'string') {
      return {
        city: parsed.city,
        state: parsed.state,
        ibge_code: typeof parsed.ibge_code === 'string' ? parsed.ibge_code : null,
        source: parsed.source === 'gps' ? 'gps' : 'manual',
      };
    }
  } catch {
    // localStorage indisponível (modo privado) ou JSON inválido — segue sem região.
  }
  return null;
}

function writeStored(value: IUserLocation | null): void {
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sem persistência — a região vale só para esta sessão.
  }
}

/**
 * Região do usuário (cidade/UF) para o scanner de preços.
 *
 * Privacy-first: a coordenada do GPS é arredondada a 2 casas (~1 km) ANTES de
 * sair do aparelho, serve só para o servidor resolver o município e não é
 * guardada em lugar nenhum — no `localStorage` fica apenas cidade/UF/IBGE.
 * `locate()` deve ser chamado a partir de um gesto do usuário (clique): o iOS
 * Safari só mostra o pedido de permissão nesse caso.
 */
export function useUserLocation() {
  const [location, setLocation] = useState<IUserLocation | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>('idle');

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setLocation(stored);
      setStatus('ready');
    }
  }, []);

  const save = useCallback((value: IUserLocation | null) => {
    setLocation(value);
    writeStored(value);
    setStatus(value ? 'ready' : 'idle');
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { data } = await api.get<{
            data: { ibge_code: string; city: string; state: string } | null;
          }>(API_URL_GEO_REVERSE, {
            params: {
              lat: position.coords.latitude.toFixed(2),
              lng: position.coords.longitude.toFixed(2),
            },
          });
          if (!data.data) {
            setStatus('outside');
            return;
          }
          save({ ...data.data, source: 'gps' });
        } catch {
          setStatus('error');
        }
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }, [save]);

  const setManual = useCallback(
    (state: string, city: string) => {
      save({ state, city: city.trim(), ibge_code: null, source: 'manual' });
    },
    [save],
  );

  const clear = useCallback(() => save(null), [save]);

  return { location, status, locate, setManual, clear };
}
