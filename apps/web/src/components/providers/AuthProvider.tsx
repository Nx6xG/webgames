'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabaseClient';
import {
  ensureProfile,
  hasSyncedBefore,
  loadCloudToLocal,
  runInitialSync,
} from '@/lib/cloudSync';

const SYNC_TIMEOUT_MS = 10_000;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  isSupabaseConfigured: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  role: null,
  isLoading: true,
  isSyncing: false,
  isSupabaseConfigured: false,
  signInWithEmail: async () => ({ error: null }),
  verifyOtp: async () => ({ error: null }),
  signOut: async () => {},
});

/** Race a promise against a timeout. Rejects with Error('Sync timeout') on expiry. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync timeout')), ms),
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sb = getSupabase();
  const isConfigured = sb !== null;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [isSyncing, setIsSyncing] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const syncingRef = useRef(false);

  // Restore session on mount + subscribe to auth changes
  useEffect(() => {
    if (!sb) return;
    const client = sb; // narrow for closures

    let mounted = true;

    /**
     * Run cloud sync for a user. Guarded by syncingRef to prevent double-runs.
     * Always resets isSyncing in finally — even on timeout or error.
     */
    async function performSync(u: User) {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (mounted) setIsSyncing(true);

      try {
        const syncWork = hasSyncedBefore(u.id)
          ? (async () => {
              await ensureProfile(client, u.id, u.email);
              await loadCloudToLocal(client, u.id);
            })()
          : runInitialSync(client, u.id, u.email);

        await withTimeout(syncWork, SYNC_TIMEOUT_MS);
      } catch (err) {
        console.error('[AuthProvider] sync error:', err);
      } finally {
        // Always reset — even if unmounted (ref is shared across mounts)
        syncingRef.current = false;
        if (mounted) {
          setIsSyncing(false);
          window.dispatchEvent(new Event('webgames:cloud-sync-done'));
        }
      }

      // Fetch role from profiles table
      try {
        const { data: profile } = await client
          .from('profiles')
          .select('role')
          .eq('id', u.id)
          .single();
        if (mounted && profile?.role) setRole(profile.role);
      } catch { /* ignore */ }
    }

    // 1. Restore session from storage
    sb.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);

      // Run full sync on session restore (not just ensureProfile)
      if (s?.user) {
        performSync(s.user);
      }
    });

    // 2. Listen for auth state changes (fresh sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);

      if (_event === 'SIGNED_IN' && s?.user) {
        performSync(s.user);
      }
    });

    return () => {
      mounted = false;
      syncingRef.current = false; // Reset guard on cleanup (React Strict Mode)
      subscription.unsubscribe();
    };
  }, [sb]);

  const signInWithEmail = useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      if (!sb) return { error: 'Supabase not configured' };
      const { error } = await sb.auth.signInWithOtp({ email });
      return { error: error?.message ?? null };
    },
    [sb],
  );

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<{ error: string | null }> => {
      if (!sb) return { error: 'Supabase not configured' };
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      return { error: error?.message ?? null };
    },
    [sb],
  );

  const signOut = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  }, [sb]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        isSyncing,
        isSupabaseConfigured: isConfigured,
        signInWithEmail,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
