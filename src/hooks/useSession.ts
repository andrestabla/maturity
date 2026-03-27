import { startTransition, useEffect, useState } from 'react';
import type { AuthSession } from '../types.js';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface LoginPayload {
  email: string;
  password: string;
}

export function useSession() {
  const [session, setSession] = useState<AuthSession>({
    authenticated: false,
    user: null,
  });
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  async function refreshSession() {
    setStatus((current) => (current === 'authenticated' ? 'loading' : current));

    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = (await response.json()) as AuthSession | { error?: string };

    if (!response.ok) {
      throw new Error('session_fetch_failed');
    }

    const nextSession = payload as AuthSession;

    startTransition(() => {
      setSession(nextSession);
      setStatus(nextSession.authenticated ? 'authenticated' : 'unauthenticated');
      setError(null);
    });
  }

  useEffect(() => {
    refreshSession().catch(() => {
      setSession({
        authenticated: false,
        user: null,
      });
      setStatus('unauthenticated');
    });
  }, []);

  async function login(payload: LoginPayload) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as AuthSession | { error?: string };

    if (!response.ok) {
      throw new Error((body as { error?: string }).error ?? 'login_failed');
    }

    const nextSession = body as AuthSession;

    startTransition(() => {
      setSession(nextSession);
      setStatus('authenticated');
      setError(null);
    });
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });

    startTransition(() => {
      setSession({
        authenticated: false,
        user: null,
      });
      setStatus('unauthenticated');
      setError(null);
    });
  }

  return {
    session,
    status,
    error,
    login,
    logout,
    refreshSession,
  };
}
