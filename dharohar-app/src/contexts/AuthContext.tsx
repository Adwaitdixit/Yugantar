import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, fetchUserRole, type AppRole } from '../services/supabaseClient';
import { culturalStore } from '../data/culturalStore';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole;
  isNormalUser: boolean;
  isContributor: boolean;
  isReviewer: boolean;
  isExpert: boolean;
  isAdmin: boolean;
  refreshRole: () => Promise<void>;
  switchRoleForTesting: (newRole: AppRole) => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>('normal_user');
  const [loading, setLoading] = useState(true);

  const loadRole = async (userId?: string, userEmail?: string) => {
    if (!userId) {
      setRole('normal_user');
      return;
    }
    // Check if test override exists in sessionStorage for dev testing
    const testRoleOverride = sessionStorage.getItem(`dharohar_test_role_${userId}`);
    if (testRoleOverride && ['normal_user', 'contributor', 'reviewer', 'expert', 'admin'].includes(testRoleOverride)) {
      setRole(testRoleOverride as AppRole);
      return;
    }

    // Default admin for project owner email
    if (userEmail === 'adwaitdixit3546@gmail.com') {
      setRole('admin');
      return;
    }

    const fetchedRole = await fetchUserRole(userId);
    setRole(fetchedRole);
  };

  const refreshRole = async () => {
    if (user?.id) {
      await loadRole(user.id, user.email);
    }
  };

  const switchRoleForTesting = (newRole: AppRole) => {
    if (user?.id) {
      sessionStorage.setItem(`dharohar_test_role_${user.id}`, newRole);
    }
    setRole(newRole);
  };

  useEffect(() => {
    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadRole(session.user.id, session.user.email);
      } else {
        setRole('normal_user');
      }
      setLoading(false);
    }).catch(err => {
      console.warn('[Auth] Error retrieving initial session:', err);
      setLoading(false);
    });

    // 2. Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadRole(session.user.id, session.user.email);
      } else {
        setRole('normal_user');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }
      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
        await loadRole(data.user.id, data.user.email);
        culturalStore.sanitizeForUser(data.user.email, data.user.id, false);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'An unexpected error occurred during sign in.' };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message, needsConfirmation: false };
      }

      const needsConfirmation = !data.session;
      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
        await loadRole(data.user.id, data.user.email);
        culturalStore.sanitizeForUser(data.user.email, data.user.id, false);
      }
      return { error: null, needsConfirmation };
    } catch (err: any) {
      return { error: err.message || 'An unexpected error occurred during registration.', needsConfirmation: false };
    }
  };

  const signInWithOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to send magic sign-in link.' };
    }
  };

  const signOut = async () => {
    try {
      if (user?.id) {
        sessionStorage.removeItem(`dharohar_test_role_${user.id}`);
      }
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('[Auth] Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setRole('normal_user');
      culturalStore.sanitizeForUser(null, null, false);
    }
  };

  const isNormalUser = role === 'normal_user';
  const isContributor = role === 'contributor' || role === 'admin';
  const isReviewer = role === 'reviewer' || role === 'expert' || role === 'admin';
  const isExpert = role === 'expert' || role === 'admin';
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        isNormalUser,
        isContributor,
        isReviewer,
        isExpert,
        isAdmin,
        refreshRole,
        switchRoleForTesting,
        signInWithEmail,
        signUpWithEmail,
        signInWithOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
