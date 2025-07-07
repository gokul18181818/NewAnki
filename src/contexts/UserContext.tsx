import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface Preferences {
  showProgressPopups?: boolean;
  smartBreakSuggestions?: boolean;
  emojiCelebrations?: boolean;
  soundEffects?: boolean;
  dailyReminders?: boolean;
  reminderTime?: string;
  sessionLength?: string;
  customSessionLength?: number;
  newCardsPerDay?: number;
  maxDailyCards?: number;
  breakInterval?: number;
  breakDuration?: number;
  adaptiveBreaks?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: number;
  animations?: boolean;
}

interface User extends SupabaseUser {
  preferences?: Preferences;
  studyGoal?: string;
  streak?: number;
  totalCards?: number;
  joinDate?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Load user preferences from Supabase
  const loadUserPreferences = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error loading user preferences:', error);
        return {};
      }

      return data?.preferences || {};
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return {};
    }
  };

  // Listen to auth changes
  useEffect(() => {
    const initializeUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const preferences = await loadUserPreferences(data.session.user.id);
        setUser({
          ...data.session.user,
          preferences
        });
      } else {
        setUser(null);
      }
    };

    initializeUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const preferences = await loadUserPreferences(session.user.id);
        setUser({
          ...session.user,
          preferences
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const updatePreferences = async (newPreferences: Partial<User['preferences']>) => {
    if (!user) return;

    const updatedPreferences = { ...user.preferences, ...newPreferences };
    
    try {
      // Update preferences in Supabase
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving preferences to Supabase:', error);
        throw error;
      }

      // Update local state only after successful database update
      setUser({
        ...user,
        preferences: updatedPreferences,
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      // You might want to show a toast notification here
      throw error;
    }
  };

  const value: UserContextType = {
    user,
    setUser,
    isAuthenticated: !!user,
    login,
    logout,
    updatePreferences,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};