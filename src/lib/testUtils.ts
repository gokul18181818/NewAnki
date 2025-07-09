// Test utilities for adaptive personalization features

import { supabase } from './supabaseClient';

export class AdaptiveTestingUtils {
  
  /**
   * Simulate an experienced user profile for testing
   */
  static async simulateExperiencedUser(userId: string) {
    try {
      console.log('🔄 Deleting existing profile...');
      // First delete any existing profile
      await supabase.from('user_learning_profiles').delete().eq('user_id', userId);
      
      console.log('📝 Inserting experienced user profile...');
      // Then insert the new profile
      const { data, error } = await supabase.from('user_learning_profiles').insert({
        user_id: userId,
        total_cards_studied: 450,
        average_session_length: 35.0,
        average_cards_per_session: 25.0,
        average_retention_rate: 0.85,
        preferred_study_times: [9, 14, 19],
        fatigue_threshold: 72.0,
        optimal_break_interval: 30,
        optimal_break_duration: 12,
        celebration_frequency: 7,
        milestone_progression: [120, 300, 600, 1200, 2000],
        study_velocity: 8.5,
        consistency_score: 0.8,
        difficulty_tolerance: 0.85,
        updated_at: new Date().toISOString()
      });
      
      if (error) {
        console.error('❌ Error inserting experienced user profile:', error);
      } else {
        console.log('✅ Simulated experienced user profile successfully');
        console.log('📊 Profile data:', {
          sessionLength: 35,
          celebrationFreq: 7,
          fatigueThreshold: 72,
          breakInterval: 30,
          breakDuration: 12
        });
      }
    } catch (error) {
      console.error('❌ Failed to simulate experienced user:', error);
    }
  }

  /**
   * Simulate a struggling user profile for testing
   */
  static async simulateStrugglingUser(userId: string) {
    try {
      console.log('🔄 Deleting existing profile...');
      // First delete any existing profile
      await supabase.from('user_learning_profiles').delete().eq('user_id', userId);
      
      console.log('📝 Inserting struggling user profile...');
      // Then insert the new profile
      const { data, error } = await supabase.from('user_learning_profiles').insert({
        user_id: userId,
        total_cards_studied: 85,
        average_session_length: 12.0,
        average_cards_per_session: 8.0,
        average_retention_rate: 0.55,
        preferred_study_times: [20, 21], // Late night studying
        fatigue_threshold: 55.0, // Lower tolerance
        optimal_break_interval: 15,
        optimal_break_duration: 8,
        celebration_frequency: 3, // More frequent encouragement
        milestone_progression: [15, 40, 80, 150, 250],
        study_velocity: 3.2,
        consistency_score: 0.3,
        difficulty_tolerance: 0.45,
        updated_at: new Date().toISOString()
      });
      
      if (error) {
        console.error('❌ Error inserting struggling user profile:', error);
      } else {
        console.log('✅ Simulated struggling user profile successfully');
        console.log('📊 Profile data:', {
          sessionLength: 12,
          celebrationFreq: 3,
          fatigueThreshold: 55,
          breakInterval: 15,
          breakDuration: 8
        });
      }
    } catch (error) {
      console.error('❌ Failed to simulate struggling user:', error);
    }
  }

  /**
   * Reset user profile to defaults
   */
  static async resetUserProfile(userId: string) {
    try {
      await supabase.from('user_learning_profiles').delete().eq('user_id', userId);
      console.log('✅ Reset user profile to defaults');
    } catch (error) {
      console.error('❌ Failed to reset user profile:', error);
    }
  }

  /**
   * Add fake study history for testing
   */
  static async addFakeStudyHistory(userId: string, sessions: Array<{
    cardsStudied: number;
    timeSpentMinutes: number;
    retentionRate: number;
    daysAgo: number;
  }>) {
    try {
      const logs = sessions.map(session => {
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - session.daysAgo);
        
        return {
          user_id: userId,
          deck_id: 'test-deck-' + Math.random().toString(36).substr(2, 9),
          cards_studied: session.cardsStudied,
          time_spent_seconds: session.timeSpentMinutes * 60,
          retention_rate: session.retentionRate,
          session_date: sessionDate.toISOString(),
          session_mode: 'Normal Study',
          fatigue_score: Math.random() * 100,
          performance_data: {
            '😞': Math.floor(session.cardsStudied * (1 - session.retentionRate / 100) * 0.3),
            '😐': Math.floor(session.cardsStudied * (1 - session.retentionRate / 100) * 0.7),
            '😊': Math.floor(session.cardsStudied * (session.retentionRate / 100) * 0.8),
            '😁': Math.floor(session.cardsStudied * (session.retentionRate / 100) * 0.2),
          }
        };
      });

      await supabase.from('study_logs').insert(logs);
      console.log(`✅ Added ${sessions.length} fake study sessions`);
    } catch (error) {
      console.error('❌ Failed to add fake study history:', error);
    }
  }

  /**
   * Quick test scenarios
   */
  static async runQuickTests(userId: string) {
    console.log('🧪 Running adaptive personalization tests...');
    
    // Test 1: New user (no history)
    console.log('\n📋 Test 1: New User Experience');
    await this.resetUserProfile(userId);
    
    // Test 2: Add some study history and check adaptation
    console.log('\n📋 Test 2: User with History');
    await this.addFakeStudyHistory(userId, [
      { cardsStudied: 15, timeSpentMinutes: 20, retentionRate: 75, daysAgo: 5 },
      { cardsStudied: 22, timeSpentMinutes: 30, retentionRate: 82, daysAgo: 3 },
      { cardsStudied: 18, timeSpentMinutes: 25, retentionRate: 68, daysAgo: 1 },
    ]);
    
    // Test 3: Experienced user
    console.log('\n📋 Test 3: Experienced User');
    await this.simulateExperiencedUser(userId);
    
    // Test 4: Struggling user
    console.log('\n📋 Test 4: Struggling User');
    await this.simulateStrugglingUser(userId);
    
    console.log('\n✅ Test setup complete! Refresh the page to see adaptive recommendations.');
  }

  /**
   * Debug current personalization state
   */
  static async debugPersonalization(userId: string) {
    try {
      console.log('🔍 Debugging personalization for user:', userId);
      
      // Check profile
      const { data: profile } = await supabase
        .from('user_learning_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      console.log('👤 User Profile:', profile);
      
      // Check recent study logs
      const { data: logs } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', userId)
        .order('session_date', { ascending: false })
        .limit(5);
      
      console.log('📚 Recent Study Sessions:', logs);
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }
}

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).AdaptiveTestUtils = AdaptiveTestingUtils;
  console.log('🧪 Adaptive testing utils available globally as AdaptiveTestUtils');
  console.log('💡 Try: AdaptiveTestUtils.runQuickTests("your-user-id")');
}