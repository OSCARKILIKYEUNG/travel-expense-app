import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      supabaseConfigured: !!supabase,
      session,
      user,
      loading,
      async signIn(email, password) {
        if (!supabase) return { error: new Error('Supabase not configured') };
        return supabase.auth.signInWithPassword({ email, password });
      },
      async signUp(email, password) {
        if (!supabase) return { data: null, error: new Error('Supabase not configured') };
        const emailRedirectTo = `${window.location.origin}/`;
        return supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
      },
      async signOut() {
        if (!supabase) return { error: null };
        return supabase.auth.signOut();
      },
      async resendSignUpEmail(email) {
        if (!supabase) return { error: new Error('Supabase not configured') };
        const emailRedirectTo = `${window.location.origin}/`;
        return supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo },
        });
      },
      async signInWithGoogle() {
        if (!supabase) return { error: new Error('Supabase not configured') };
        const redirectTo = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) return { error };
        if (data?.url) {
          window.location.assign(data.url);
        }
        return { error: null };
      },
    }),
    [session, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
