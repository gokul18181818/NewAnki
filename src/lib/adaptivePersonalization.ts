// Adaptive Personalization Engine
// Dynamically adjusts thresholds and recommendations based on user behavior and performance

import { supabase } from './supabaseClient';

export interface UserLearningProfile {
  userId: string;
  totalCardsStudied: number;
  averageSessionLength: number; // in minutes
  averageCardsPerSession: number;
  averageRetentionRate: number;
  preferredStudyTimes: number[]; // hours of day (0-23)
  fatigueThreshold: number; // personalized fatigue warning threshold
  optimalBreakInterval: number; // minutes between breaks
  optimalBreakDuration: number; // minutes for breaks
  celebrationFrequency: number; // how often to celebrate (every X correct answers)
  milestoneProgression: number[]; // personalized milestone thresholds
  studyVelocity: number; // cards per hour when focused
  consistencyScore: number; // 0-1, how consistently they study
  difficultyTolerance: number; // 0-1, how well they handle difficult cards
  lastUpdated: Date;
}

export interface PersonalizedRecommendations {
  nextMilestone: number;
  celebrationTrigger: number;
  fatigueWarningThreshold: number;
  breakInterval: number;
  breakDuration: number;
  sessionLengthRecommendation: number;
  optimalStudyTime: string;
  difficultyAdjustment: number;
}

export class AdaptivePersonalizationEngine {
  private userId: string;
  private profile: UserLearningProfile | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize user profile from historical data
   */
  async initializeProfile(): Promise<UserLearningProfile> {
    try {
      // Try to load existing profile
      const { data: existingProfile } = await supabase
        .from('user_learning_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (existingProfile) {
        this.profile = this.transformDbProfile(existingProfile);
        return this.profile;
      }

      // Create new profile from historical data
      const profile = await this.createProfileFromHistory();
      
      // Use upsert to handle concurrent creation attempts
      try {
        await this.saveProfile(profile);
        this.profile = profile;
        return profile;
      } catch (upsertError: any) {
        // If upsert fails (409 conflict), try to fetch the existing profile again
        if (upsertError.code === '23505' || upsertError.message?.includes('duplicate') || upsertError.message?.includes('409')) {
          const { data: retryProfile } = await supabase
            .from('user_learning_profiles')
            .select('*')
            .eq('user_id', this.userId)
            .single();
          
          if (retryProfile) {
            this.profile = this.transformDbProfile(retryProfile);
            return this.profile;
          }
        }
        throw upsertError;
      }
    } catch (error) {
      console.error('Error initializing user profile:', error);
      // Return default profile
      this.profile = this.getDefaultProfile();
      return this.profile;
    }
  }

  /**
   * Create user profile by analyzing historical study data
   */
  private async createProfileFromHistory(): Promise<UserLearningProfile> {
    const defaultProfile = this.getDefaultProfile();

    try {
      // Get recent study sessions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: sessions } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', this.userId)
        .gte('session_date', thirtyDaysAgo.toISOString());

      if (!sessions || sessions.length === 0) {
        return defaultProfile;
      }

      // Analyze patterns
      const totalCards = sessions.reduce((sum, session) => sum + (session.cards_studied || 0), 0);
      const totalTime = sessions.reduce((sum, session) => sum + (session.time_spent_seconds || 0), 0);
      const totalRetention = sessions.reduce((sum, session) => sum + (session.retention_rate || 0), 0);
      
      const avgSessionLength = totalTime / sessions.length / 60; // minutes
      const avgCardsPerSession = totalCards / sessions.length;
      const avgRetentionRate = totalRetention / sessions.length / 100; // 0-1 scale
      const studyVelocity = (totalTime > 0) ? (totalCards / (totalTime / 3600)) : 5; // cards per hour

      // Analyze study times
      const studyHours = sessions.map(session => {
        const hour = new Date(session.session_date).getHours();
        return hour;
      });
      const preferredTimes = this.findPreferredStudyTimes(studyHours);

      // Calculate fatigue patterns
      const fatigueScores = sessions
        .map(s => s.fatigue_score)
        .filter(score => score !== null && score !== undefined) as number[];
      
      const avgFatigueAtWarning = fatigueScores.length > 0 
        ? fatigueScores.reduce((sum, score) => sum + score, 0) / fatigueScores.length 
        : 65;

      // Personalized fatigue threshold (slightly below their average warning point)
      const personalizedFatigueThreshold = Math.max(50, Math.min(80, avgFatigueAtWarning - 10));

      // Calculate consistency (how regularly they study)
      const uniqueStudyDays = new Set(
        sessions.map(s => new Date(s.session_date).toDateString())
      ).size;
      const consistencyScore = Math.min(1, uniqueStudyDays / 30);

      // Difficulty tolerance based on retention vs speed
      const difficultyTolerance = avgRetentionRate > 0.8 ? 
        Math.min(1, avgRetentionRate * 1.2) : 0.6;

      return {
        userId: this.userId,
        totalCardsStudied: totalCards,
        averageSessionLength: Math.max(10, Math.min(120, avgSessionLength)),
        averageCardsPerSession: Math.max(5, avgCardsPerSession),
        averageRetentionRate: avgRetentionRate,
        preferredStudyTimes: preferredTimes,
        fatigueThreshold: personalizedFatigueThreshold,
        optimalBreakInterval: this.calculateOptimalBreakInterval(avgSessionLength, fatigueScores),
        optimalBreakDuration: this.calculateOptimalBreakDuration(avgSessionLength),
        celebrationFrequency: this.calculateCelebrationFrequency(avgCardsPerSession, avgRetentionRate),
        milestoneProgression: this.generatePersonalizedMilestones(totalCards, studyVelocity),
        studyVelocity,
        consistencyScore,
        difficultyTolerance,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error creating profile from history:', error);
      return defaultProfile;
    }
  }

  /**
   * Get default profile for new users
   */
  private getDefaultProfile(): UserLearningProfile {
    return {
      userId: this.userId,
      totalCardsStudied: 0,
      averageSessionLength: 25,
      averageCardsPerSession: 15,
      averageRetentionRate: 0.75,
      preferredStudyTimes: [9, 14, 19], // 9am, 2pm, 7pm
      fatigueThreshold: 65,
      optimalBreakInterval: 25,
      optimalBreakDuration: 10,
      celebrationFrequency: 5,
      milestoneProgression: [25, 75, 150, 300, 500],
      studyVelocity: 5,
      consistencyScore: 0.5,
      difficultyTolerance: 0.7,
      lastUpdated: new Date()
    };
  }

  /**
   * Update profile based on recent session
   */
  async updateProfile(sessionData: {
    cardsStudied: number;
    timeSpent: number; // seconds
    retentionRate: number; // 0-100
    fatigueScore: number;
    studyHour: number;
  }): Promise<void> {
    if (!this.profile) {
      await this.initializeProfile();
    }

    if (!this.profile) return;

    const sessionMinutes = sessionData.timeSpent / 60;
    const retentionRate = sessionData.retentionRate / 100;

    // Update running averages with exponential smoothing
    const alpha = 0.1; // Learning rate
    
    this.profile.averageSessionLength = 
      (1 - alpha) * this.profile.averageSessionLength + alpha * sessionMinutes;
    
    this.profile.averageCardsPerSession = 
      (1 - alpha) * this.profile.averageCardsPerSession + alpha * sessionData.cardsStudied;
    
    this.profile.averageRetentionRate = 
      (1 - alpha) * this.profile.averageRetentionRate + alpha * retentionRate;

    this.profile.totalCardsStudied += sessionData.cardsStudied;

    // Update preferred study times
    if (!this.profile.preferredStudyTimes.includes(sessionData.studyHour)) {
      // Add this hour if it's not already in top 3 and performance is good
      if (retentionRate > 0.8 && this.profile.preferredStudyTimes.length < 3) {
        this.profile.preferredStudyTimes.push(sessionData.studyHour);
      }
    }

    // Adapt fatigue threshold
    if (sessionData.fatigueScore > this.profile.fatigueThreshold && retentionRate < 0.7) {
      // Lower threshold if they performed poorly at current threshold
      this.profile.fatigueThreshold = Math.max(50, this.profile.fatigueThreshold - 2);
    } else if (sessionData.fatigueScore < this.profile.fatigueThreshold && retentionRate > 0.85) {
      // Raise threshold if they're performing well
      this.profile.fatigueThreshold = Math.min(80, this.profile.fatigueThreshold + 1);
    }

    // Update break recommendations
    this.profile.optimalBreakInterval = this.calculateOptimalBreakInterval(
      this.profile.averageSessionLength, [sessionData.fatigueScore]
    );

    this.profile.optimalBreakDuration = this.calculateOptimalBreakDuration(
      this.profile.averageSessionLength
    );

    // Update celebration frequency
    this.profile.celebrationFrequency = this.calculateCelebrationFrequency(
      this.profile.averageCardsPerSession, this.profile.averageRetentionRate
    );

    // Update milestones
    this.profile.milestoneProgression = this.generatePersonalizedMilestones(
      this.profile.totalCardsStudied, this.profile.studyVelocity
    );

    this.profile.lastUpdated = new Date();

    // Save updated profile
    await this.saveProfile(this.profile);
  }

  /**
   * Get personalized recommendations
   */
  getRecommendations(): PersonalizedRecommendations {
    if (!this.profile) {
      // Return defaults if profile not loaded
      const defaultProfile = this.getDefaultProfile();
      return this.generateRecommendations(defaultProfile);
    }

    return this.generateRecommendations(this.profile);
  }

  private generateRecommendations(profile: UserLearningProfile): PersonalizedRecommendations {
    const currentTotal = profile.totalCardsStudied;
    const nextMilestone = profile.milestoneProgression.find(m => m > currentTotal) 
      || profile.milestoneProgression[profile.milestoneProgression.length - 1] + 500;

    // Calculate optimal study time
    const currentHour = new Date().getHours();
    const closestPreferredTime = profile.preferredStudyTimes
      .reduce((closest, time) => {
        const timeDiff = Math.abs(time - currentHour);
        const closestDiff = Math.abs(closest - currentHour);
        return timeDiff < closestDiff ? time : closest;
      });

    const formatTime = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    return {
      nextMilestone,
      celebrationTrigger: profile.celebrationFrequency,
      fatigueWarningThreshold: profile.fatigueThreshold,
      breakInterval: profile.optimalBreakInterval,
      breakDuration: profile.optimalBreakDuration,
      sessionLengthRecommendation: Math.round(profile.averageSessionLength),
      optimalStudyTime: formatTime(closestPreferredTime),
      difficultyAdjustment: profile.difficultyTolerance
    };
  }

  // Helper methods for calculations

  private findPreferredStudyTimes(studyHours: number[]): number[] {
    const hourCounts = studyHours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculateOptimalBreakInterval(avgSessionLength: number, fatigueScores: number[]): number {
    const basedOnSession = Math.max(15, Math.min(45, avgSessionLength * 0.8));
    
    if (fatigueScores.length > 0) {
      const avgFatigue = fatigueScores.reduce((sum, score) => sum + score, 0) / fatigueScores.length;
      if (avgFatigue > 70) return Math.max(15, basedOnSession - 5);
      if (avgFatigue < 50) return Math.min(45, basedOnSession + 5);
    }
    
    return Math.round(basedOnSession);
  }

  private calculateOptimalBreakDuration(avgSessionLength: number): number {
    if (avgSessionLength < 20) return 5;
    if (avgSessionLength < 30) return 8;
    if (avgSessionLength < 45) return 12;
    return 15;
  }

  private calculateCelebrationFrequency(avgCardsPerSession: number, avgRetentionRate: number): number {
    // More frequent celebrations for beginners or those with lower retention
    if (avgCardsPerSession < 10 || avgRetentionRate < 0.7) return 3;
    if (avgCardsPerSession < 20 || avgRetentionRate < 0.8) return 4;
    if (avgCardsPerSession < 30 || avgRetentionRate < 0.9) return 5;
    return 7; // Less frequent for advanced users
  }

  private generatePersonalizedMilestones(totalCards: number, studyVelocity: number): number[] {
    const baseProgression = [25, 75, 150, 300, 500, 750, 1000, 1500, 2000];
    
    // Adjust based on user's study velocity and current progress
    if (studyVelocity > 8) {
      // Fast learner - bigger jumps
      return baseProgression.map(m => Math.round(m * 1.2));
    } else if (studyVelocity < 3) {
      // Slower learner - smaller, more frequent milestones
      return baseProgression.map(m => Math.round(m * 0.7));
    }
    
    return baseProgression;
  }

  private async saveProfile(profile: UserLearningProfile): Promise<void> {
    const { error } = await supabase
      .from('user_learning_profiles')
      .upsert({
        user_id: profile.userId,
        total_cards_studied: profile.totalCardsStudied,
        average_session_length: profile.averageSessionLength,
        average_cards_per_session: profile.averageCardsPerSession,
        average_retention_rate: profile.averageRetentionRate,
        preferred_study_times: profile.preferredStudyTimes,
        fatigue_threshold: profile.fatigueThreshold,
        optimal_break_interval: profile.optimalBreakInterval,
        optimal_break_duration: profile.optimalBreakDuration,
        celebration_frequency: profile.celebrationFrequency,
        milestone_progression: profile.milestoneProgression,
        study_velocity: profile.studyVelocity,
        consistency_score: profile.consistencyScore,
        difficulty_tolerance: profile.difficultyTolerance,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  }

  private transformDbProfile(dbProfile: any): UserLearningProfile {
    return {
      userId: dbProfile.user_id,
      totalCardsStudied: dbProfile.total_cards_studied || 0,
      averageSessionLength: dbProfile.average_session_length || 25,
      averageCardsPerSession: dbProfile.average_cards_per_session || 15,
      averageRetentionRate: dbProfile.average_retention_rate || 0.75,
      preferredStudyTimes: dbProfile.preferred_study_times || [9, 14, 19],
      fatigueThreshold: dbProfile.fatigue_threshold || 65,
      optimalBreakInterval: dbProfile.optimal_break_interval || 25,
      optimalBreakDuration: dbProfile.optimal_break_duration || 10,
      celebrationFrequency: dbProfile.celebration_frequency || 5,
      milestoneProgression: dbProfile.milestone_progression || [25, 75, 150, 300, 500],
      studyVelocity: dbProfile.study_velocity || 5,
      consistencyScore: dbProfile.consistency_score || 0.5,
      difficultyTolerance: dbProfile.difficulty_tolerance || 0.7,
      lastUpdated: new Date(dbProfile.updated_at || new Date())
    };
  }

  /**
   * Check if profile needs refreshing
   */
  shouldRefreshProfile(): boolean {
    if (!this.profile) return true;
    
    const daysSinceUpdate = (Date.now() - this.profile.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7; // Refresh weekly
  }

  /**
   * Get adaptive session length based on user patterns and current context
   */
  getAdaptiveSessionLength(timeOfDay: number, availableTime?: number): number {
    if (!this.profile) return 25;

    let baseLength = this.profile.averageSessionLength;

    // Adjust based on time of day
    if (this.profile.preferredStudyTimes.includes(timeOfDay)) {
      baseLength *= 1.1; // 10% longer during preferred times
    }

    // Adjust based on consistency
    if (this.profile.consistencyScore > 0.8) {
      baseLength *= 1.2; // Reward consistent users with longer recommendations
    }

    // Cap by available time if specified
    if (availableTime) {
      baseLength = Math.min(baseLength, availableTime * 0.9);
    }

    return Math.max(10, Math.min(90, Math.round(baseLength)));
  }
}