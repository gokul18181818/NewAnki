import { ResponseTimeBaseline, ResponseTimeData } from '../types/AntiBurnoutTypes';
import { supabase } from './supabaseClient';

/**
 * Response Time Baseline Learning System
 * Learns user's natural response time patterns and adapts thresholds accordingly
 */
export class ResponseTimeBaselineEngine {
  private static readonly MINIMUM_SAMPLES = 10;
  private static readonly OUTLIER_THRESHOLD = 3; // Standard deviations
  private static readonly MAX_SAMPLES_TO_STORE = 1000;

  /**
   * Update user's response time baseline with new data
   */
  static async updateBaseline(userId: string, responseData: ResponseTimeData): Promise<void> {
    try {
      // Store the response time data
      await this.storeResponseTime(userId, responseData);
      
      // Get recent response times for analysis
      const recentData = await this.getRecentResponseTimes(userId, 100);
      
      if (recentData.length >= this.MINIMUM_SAMPLES) {
        const baseline = this.calculateBaseline(recentData);
        await this.saveBaseline(userId, baseline);
      }
    } catch (error) {
      console.error('Error updating response time baseline:', error);
    }
  }

  /**
   * Get user's current response time baseline
   */
  static async getBaseline(userId: string): Promise<ResponseTimeBaseline | null> {
    try {
      const { data, error } = await supabase
        .from('response_time_baselines')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        userId: data.user_id,
        averageTime: data.average_time,
        standardDeviation: data.standard_deviation,
        sampleSize: data.sample_size,
        lastUpdated: new Date(data.last_updated),
        byDifficulty: data.by_difficulty || {}
      };
    } catch (error) {
      console.error('Error getting baseline:', error);
      return null;
    }
  }

  /**
   * Store individual response time data point
   */
  private static async storeResponseTime(userId: string, data: ResponseTimeData): Promise<void> {
    const { error } = await supabase
      .from('response_times')
      .insert({
        user_id: userId,
        card_id: data.cardId,
        time_to_show_answer: data.timeToShowAnswer,
        time_to_rate: data.timeToRate,
        total_time: data.totalTime,
        rating: data.rating,
        difficulty: data.difficulty,
        timestamp: data.timestamp.toISOString()
      });

    if (error) {
      throw error;
    }

    // Clean up old data to prevent table bloat
    await this.cleanupOldData(userId);
  }

  /**
   * Get recent response time data for analysis
   */
  private static async getRecentResponseTimes(userId: string, limit: number): Promise<ResponseTimeData[]> {
    const { data, error } = await supabase
      .from('response_times')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data.map(row => ({
      cardId: row.card_id,
      timeToShowAnswer: row.time_to_show_answer,
      timeToRate: row.time_to_rate,
      totalTime: row.total_time,
      timestamp: new Date(row.timestamp),
      rating: row.rating,
      difficulty: row.difficulty
    }));
  }

  /**
   * Calculate baseline statistics from response time data
   */
  private static calculateBaseline(data: ResponseTimeData[]): ResponseTimeBaseline {
    // Filter out outliers to get more accurate baseline
    const filteredData = this.removeOutliers(data);
    
    // Calculate overall statistics
    const totalTimes = filteredData.map(d => d.totalTime);
    const average = this.calculateMean(totalTimes);
    const stdDev = this.calculateStandardDeviation(totalTimes, average);

    // Calculate by difficulty level
    const byDifficulty: Record<number, { avg: number; std: number; count: number }> = {};
    
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      const difficultyData = filteredData.filter(d => Math.round(d.difficulty) === difficulty);
      if (difficultyData.length >= 3) {
        const times = difficultyData.map(d => d.totalTime);
        byDifficulty[difficulty] = {
          avg: this.calculateMean(times),
          std: this.calculateStandardDeviation(times),
          count: times.length
        };
      }
    }

    return {
      userId: '', // Will be set when saving
      averageTime: average,
      standardDeviation: stdDev,
      sampleSize: filteredData.length,
      lastUpdated: new Date(),
      byDifficulty
    };
  }

  /**
   * Remove statistical outliers from response time data
   */
  private static removeOutliers(data: ResponseTimeData[]): ResponseTimeData[] {
    if (data.length < this.MINIMUM_SAMPLES) {
      return data;
    }

    const times = data.map(d => d.totalTime);
    const mean = this.calculateMean(times);
    const stdDev = this.calculateStandardDeviation(times, mean);
    
    const threshold = stdDev * this.OUTLIER_THRESHOLD;
    
    return data.filter(d => 
      Math.abs(d.totalTime - mean) <= threshold &&
      d.totalTime >= 500 && // Minimum reasonable response time
      d.totalTime <= 60000  // Maximum reasonable response time (1 minute)
    );
  }

  /**
   * Save calculated baseline to database
   */
  private static async saveBaseline(userId: string, baseline: ResponseTimeBaseline): Promise<void> {
    const { error } = await supabase
      .from('response_time_baselines')
      .upsert({
        user_id: userId,
        average_time: baseline.averageTime,
        standard_deviation: baseline.standardDeviation,
        sample_size: baseline.sampleSize,
        last_updated: baseline.lastUpdated.toISOString(),
        by_difficulty: baseline.byDifficulty
      }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }
  }

  /**
   * Clean up old response time data to prevent table bloat
   */
  private static async cleanupOldData(userId: string): Promise<void> {
    // Keep only the most recent entries per user
    const { error } = await supabase.rpc('cleanup_old_response_times', {
      p_user_id: userId,
      p_keep_count: this.MAX_SAMPLES_TO_STORE
    });

    if (error) {
      console.warn('Could not clean up old response time data:', error);
    }
  }

  /**
   * Utility function to calculate mean
   */
  private static calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Utility function to calculate standard deviation
   */
  private static calculateStandardDeviation(values: number[], mean?: number): number {
    const avg = mean ?? this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Get personalized thresholds for a user
   */
  static async getPersonalizedThresholds(userId: string, cardDifficulty?: number): Promise<{
    baseline: number;
    slowWarning: number;
    fatigueThreshold: number;
  }> {
    const baseline = await this.getBaseline(userId);
    
    if (!baseline || baseline.sampleSize < this.MINIMUM_SAMPLES) {
      // Return default thresholds if no baseline available
      return {
        baseline: 3000,
        slowWarning: 6000,
        fatigueThreshold: 10000
      };
    }

    // Use difficulty-specific baseline if available
    let baseTime = baseline.averageTime;
    let stdDev = baseline.standardDeviation;
    
    if (cardDifficulty && baseline.byDifficulty[Math.round(cardDifficulty)]) {
      const diffData = baseline.byDifficulty[Math.round(cardDifficulty)];
      baseTime = diffData.avg;
      stdDev = diffData.std;
    }

    return {
      baseline: baseTime,
      slowWarning: baseTime + stdDev * 1.5,
      fatigueThreshold: baseTime + stdDev * 2.5
    };
  }
}