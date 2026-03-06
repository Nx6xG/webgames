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

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSyncing: boolean;
  isSupabaseConfigured: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isSyncing: false,
  isSupabaseConfigured: false,
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sb = getSupabase();
  const isConfigured = sb !== null;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Restore session on mount + subscribe to auth changes
  useEffect(() => {
    if (!sb) return;

    let mounted = true;

    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);

      // Ensure profile row exists on every session restore
      if (s?.user) {
        await ensureProfile(sb, s.user.id, s.user.email).catch((err) =>
          console.error('[AuthProvider] ensureProfile (restore) error:', err),
        );
      }
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);

      if (_event === 'SIGNED_IN' && s?.user && !syncingRef.current) {
        syncingRef.current = true;
        setIsSyncing(true);
        try {
          if (hasSyncedBefore(s.user.id)) {
            await ensureProfile(sb, s.user.id, s.user.email);
            await loadCloudToLocal(sb, s.user.id);
          } else {
            await runInitialSync(sb, s.user.id, s.user.email);
          }
        } catch (err) {
          console.error('[AuthProvider] sync error:', err);
        } finally {
          if (mounted) {
            setIsSyncing(false);
            syncingRef.current = false;
            window.dispatchEvent(new Event('webgames:cloud-sync-done'));
          }
        }
      }
    });

    return () => {
      mounted = false;
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

  const signOut = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
    setSession(null);
  }, [sb]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isSyncing,
        isSupabaseConfigured: isConfigured,
        signInWithEmail,
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
