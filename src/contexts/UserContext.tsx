import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface Preferences {
  timeZone?: string;
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
  /** Optional display name pulled from user_metadata or profile settings. */
  name?: string;
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
    console.log('🔍 Loading user preferences with shorter timeout...');
    
    try {
      // Use shorter timeout and fallback to defaults
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 3000); // 3 second timeout
      });
      
      const queryPromise = supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        console.log('⚠️ Preferences query failed, using defaults:', error.message);
        return {};
      }

      console.log('✅ Preferences loaded successfully');
      return data?.preferences || {};
    } catch (error) {
      console.log('⚠️ Preferences loading timed out, using defaults');
      // Return default preferences without blocking login
      return {
        showProgressPopups: true,
        smartBreakSuggestions: true,
        emojiCelebrations: true,
        soundEffects: false,
        dailyReminders: true,
        reminderTime: '09:00',
        sessionLength: 'auto',
        customSessionLength: 25,
        newCardsPerDay: 20,
        maxDailyCards: 200,
        breakInterval: 25,
        breakDuration: 15,
        adaptiveBreaks: true,
        fontSize: 16,
        animations: true,
      };
    }
  };

  // Listen to auth changes
  useEffect(() => {
    const initializeUser = async () => {
      console.log('🚀 Initializing user session...');
      const { data } = await supabase.auth.getSession();
      console.log('📋 Session data:', data.session ? 'Found session' : 'No session');
      
      if (data.session?.user) {
        console.log('👤 User found:', data.session.user.email);
        try {
          const preferences = await loadUserPreferences(data.session.user.id);
          console.log('✅ Setting user with preferences');
          setUser({
            ...data.session.user,
            preferences
          });
        } catch (error) {
          console.error('❌ Failed to load preferences, using defaults:', error);
          // Use default preferences if loading fails
          setUser({
            ...data.session.user,
            preferences: {}
          });
        }
      } else {
        console.log('🚫 No user session found');
        setUser(null);
      }
    };

    initializeUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      if (session?.user) {
        console.log('👤 Auth change - User:', session.user.email);
        try {
          const preferences = await loadUserPreferences(session.user.id);
          console.log('✅ Auth change - Setting user with preferences');
          setUser({
            ...session.user,
            preferences
          });
        } catch (error) {
          console.error('❌ Auth change - Failed to load preferences:', error);
          // Use default preferences if loading fails
          setUser({
            ...session.user,
            preferences: {}
          });
        }
      } else {
        console.log('🚫 Auth change - No user, setting null');
        setUser(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('🔐 Attempting login for:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
    console.log('✅ Login successful, auth state change should trigger...');
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