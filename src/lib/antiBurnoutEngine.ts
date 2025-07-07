import {
  ResponseTimeData,
  FatigueIndicators,
  PerformanceWindow,
  SessionOptimization,
  BurnoutDetection,
  BurnoutIntervention,
  WorkloadBalance,
  SmartBreakSuggestion,
  TrendAnalysis,
  PatternDetection,
  AntiBurnoutConfig,
  DEFAULT_ANTI_BURNOUT_CONFIG,
  UserBreakPreferences,
  ResponseTimeBaseline,
  createUserAdaptiveConfig,
} from '../types/AntiBurnoutTypes';
import { EmojiRating } from '../contexts/StudyContext';
import { ResponseTimeBaselineEngine } from './responseTimeBaseline';

export class AntiBurnoutEngine {
  private config: AntiBurnoutConfig;
  private responseData: ResponseTimeData[] = [];
  private performanceWindows: PerformanceWindow[] = [];
  private sessionStartTime: Date;
  private userId: string;

  constructor(
    userId: string,
    userPreferences?: UserBreakPreferences,
    learnedBaseline?: ResponseTimeBaseline,
    additionalConfig: Partial<AntiBurnoutConfig> = {}
  ) {
    this.userId = userId;
    
    // Create user-adaptive configuration
    const adaptiveConfig = userPreferences 
      ? createUserAdaptiveConfig(userPreferences, learnedBaseline)
      : DEFAULT_ANTI_BURNOUT_CONFIG;
    
    this.config = { ...adaptiveConfig, ...additionalConfig };
    this.sessionStartTime = new Date();
  }

  // Static factory method for easy creation with user data
  static async createForUser(
    userId: string,
    userPreferences?: UserBreakPreferences,
    additionalConfig: Partial<AntiBurnoutConfig> = {}
  ): Promise<AntiBurnoutEngine> {
    const learnedBaseline = await ResponseTimeBaselineEngine.getBaseline(userId);
    return new AntiBurnoutEngine(userId, userPreferences, learnedBaseline, additionalConfig);
  }

  // Convert emoji rating to numerical score for analysis
  private emojiToScore(emoji: EmojiRating): number {
    const mapping: Record<EmojiRating, number> = {
      '😞': 0,
      '😐': 1,
      '😊': 2,
      '😁': 3,
    };
    return mapping[emoji];
  }

  // Add new response time data
  async addResponseData(data: ResponseTimeData): Promise<void> {
    this.responseData.push(data);
    
    // Update the user's response time baseline asynchronously
    ResponseTimeBaselineEngine.updateBaseline(this.userId, data).catch(error => {
      console.warn('Failed to update response time baseline:', error);
    });
    
    // Update performance windows as we get more data
    if (this.responseData.length >= this.config.performanceWindows.minimumWindow) {
      this.updatePerformanceWindows();
    }
  }

  // Calculate trend analysis for any numeric data series
  private calculateTrend(values: number[]): TrendAnalysis {
    if (values.length < 2) {
      return {
        direction: 'stable',
        strength: 0,
        confidence: 0,
        dataPoints: values.length,
      };
    }

    // Simple linear regression to detect trend
    const n = values.length;
    const xSum = (n * (n - 1)) / 2; // sum of indices 0,1,2...n-1
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, index) => sum + val * index, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6; // sum of squares

    const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
    const correlation = Math.abs(slope) / (Math.max(...values) - Math.min(...values) + 0.001);

    let direction: 'improving' | 'stable' | 'declining';
    if (Math.abs(slope) < 0.1) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'declining'; // for response times and difficulty, increasing is bad
    } else {
      direction = 'improving';
    }

    return {
      direction,
      strength: Math.min(100, Math.abs(slope) * 50),
      confidence: Math.min(100, correlation * 100),
      dataPoints: n,
    };
  }

  // Update performance analysis windows
  private updatePerformanceWindows(): void {
    const windowSize = this.config.performanceWindows.windowSize;
    const overlapSize = this.config.performanceWindows.overlapSize;
    const stepSize = windowSize - overlapSize;

    // Create overlapping windows of recent performance
    for (let start = 0; start <= this.responseData.length - windowSize; start += stepSize) {
      const windowData = this.responseData.slice(start, start + windowSize);
      
      const window: PerformanceWindow = {
        windowStart: start,
        windowEnd: start + windowSize - 1,
        averageResponseTime: windowData.reduce((sum, d) => sum + d.totalTime, 0) / windowData.length,
        averageRating: windowData.reduce((sum, d) => sum + this.emojiToScore(d.rating), 0) / windowData.length,
        ratingDistribution: windowData.reduce((dist, d) => {
          dist[d.rating] = (dist[d.rating] || 0) + 1;
          return dist;
        }, {} as Record<EmojiRating, number>),
        fatigueScore: this.calculateWindowFatigueScore(windowData),
      };

      // Replace or add window
      const existingIndex = this.performanceWindows.findIndex(w => w.windowStart === start);
      if (existingIndex >= 0) {
        this.performanceWindows[existingIndex] = window;
      } else {
        this.performanceWindows.push(window);
      }
    }

    // Keep only recent windows (last 20 windows)
    this.performanceWindows = this.performanceWindows.slice(-20);
  }

  // Calculate fatigue score for a window of cards
  private calculateWindowFatigueScore(windowData: ResponseTimeData[]): number {
    let fatigueScore = 0;

    // Factor 1: Response time increase within window
    const responseTimes = windowData.map(d => d.totalTime);
    const timeIncreaseScore = this.calculateTimeIncreaseScore(responseTimes);
    fatigueScore += timeIncreaseScore * 0.3;

    // Factor 2: Performance decline within window
    const ratings = windowData.map(d => this.emojiToScore(d.rating));
    const performanceDeclineScore = this.calculatePerformanceDeclineScore(ratings);
    fatigueScore += performanceDeclineScore * 0.4;

    // Factor 3: Hesitation patterns (time to show answer increasing)
    const hesitationTimes = windowData.map(d => d.timeToShowAnswer);
    const hesitationScore = this.calculateHesitationScore(hesitationTimes);
    fatigueScore += hesitationScore * 0.3;

    return Math.min(100, Math.max(0, fatigueScore));
  }

  private calculateTimeIncreaseScore(times: number[]): number {
    if (times.length < 2) return 0;
    
    const trend = this.calculateTrend(times);
    if (trend.direction === 'declining') { // declining = times increasing
      return trend.strength * (trend.confidence / 100);
    }
    return 0;
  }

  private calculatePerformanceDeclineScore(ratings: number[]): number {
    if (ratings.length < 2) return 0;
    
    const trend = this.calculateTrend(ratings);
    if (trend.direction === 'declining') {
      return trend.strength * (trend.confidence / 100);
    }
    return 0;
  }

  private calculateHesitationScore(hesitationTimes: number[]): number {
    const averageHesitation = hesitationTimes.reduce((sum, time) => sum + time, 0) / hesitationTimes.length;
    const baselineHesitation = this.config.responseTimeThresholds.baseline / 2; // expect half the total time for hesitation
    
    if (averageHesitation > baselineHesitation * 1.5) {
      return Math.min(100, ((averageHesitation - baselineHesitation) / baselineHesitation) * 50);
    }
    return 0;
  }

  // Get current fatigue indicators
  getFatigueIndicators(): FatigueIndicators {
    if (this.responseData.length < 3) {
      return {
        responseTimeSlowing: false,
        performanceDeclining: false,
        hesitationIncreasing: false,
        consistencyDecreasing: false,
        overallFatigueScore: 0,
      };
    }

    const recentData = this.responseData.slice(-10); // last 10 cards
    const responseTimes = recentData.map(d => d.totalTime);
    const ratings = recentData.map(d => this.emojiToScore(d.rating));
    const hesitationTimes = recentData.map(d => d.timeToShowAnswer);

    const responseTimeTrend = this.calculateTrend(responseTimes);
    const performanceTrend = this.calculateTrend(ratings);
    const hesitationTrend = this.calculateTrend(hesitationTimes);

    // Consistency score (lower is worse)
    const responseTimeVariance = this.calculateVariance(responseTimes);
    const baselineVariance = Math.pow(this.config.responseTimeThresholds.baseline * 0.3, 2);
    const consistencyScore = Math.max(0, 100 - (responseTimeVariance / baselineVariance) * 100);

    const overallFatigueScore = Math.min(100, 
      (responseTimeTrend.direction === 'declining' ? responseTimeTrend.strength * 0.3 : 0) +
      (performanceTrend.direction === 'declining' ? performanceTrend.strength * 0.4 : 0) +
      (hesitationTrend.direction === 'declining' ? hesitationTrend.strength * 0.2 : 0) +
      (100 - consistencyScore) * 0.1
    );

    return {
      responseTimeSlowing: responseTimeTrend.direction === 'declining' && responseTimeTrend.confidence > 60,
      performanceDeclining: performanceTrend.direction === 'declining' && performanceTrend.confidence > 60,
      hesitationIncreasing: hesitationTrend.direction === 'declining' && hesitationTrend.confidence > 60,
      consistencyDecreasing: consistencyScore < 70,
      overallFatigueScore,
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Generate smart break suggestion
  getBreakSuggestion(): SmartBreakSuggestion {
    const fatigue = this.getFatigueIndicators();
    const sessionDuration = (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60; // minutes

    // Check various break triggers
    let triggered = false;
    let trigger: SmartBreakSuggestion['trigger'] = 'scheduled';
    let confidence = 0;
    let message = '';
    let benefits: string[] = [];

    // Fatigue-based trigger
    if (fatigue.overallFatigueScore > this.config.breakTriggers.fatigueScoreThreshold) {
      triggered = true;
      trigger = 'fatigue_detected';
      confidence = Math.min(95, fatigue.overallFatigueScore);
      message = `Your performance is showing signs of fatigue (${Math.round(fatigue.overallFatigueScore)}% fatigue score).`;
      benefits = [
        'Restore cognitive energy',
        'Improve retention of upcoming cards',
        'Prevent performance decline',
        'Maintain learning motivation'
      ];
    }
    // Time-based trigger
    else if (sessionDuration > this.config.breakTriggers.timeBasedBreakInterval) {
      triggered = true;
      trigger = 'time_threshold';
      confidence = Math.min(80, (sessionDuration / this.config.breakTriggers.timeBasedBreakInterval) * 60);
      message = `You've been studying for ${Math.round(sessionDuration)} minutes. A break will help maintain focus.`;
      benefits = [
        'Prevent mental fatigue',
        'Consolidate what you\'ve learned',
        'Return refreshed for better performance'
      ];
    }
    // Performance drop trigger
    else if (this.performanceWindows.length >= 2) {
      const recentWindow = this.performanceWindows[this.performanceWindows.length - 1];
      const previousWindow = this.performanceWindows[this.performanceWindows.length - 2];
      const performanceDrop = ((previousWindow.averageRating - recentWindow.averageRating) / previousWindow.averageRating) * 100;
      
      if (performanceDrop > this.config.breakTriggers.performanceDropThreshold) {
        triggered = true;
        trigger = 'performance_drop';
        confidence = Math.min(90, performanceDrop * 2);
        message = `Your performance has dropped ${Math.round(performanceDrop)}% in recent cards.`;
        benefits = [
          'Recover lost performance',
          'Break negative momentum',
          'Return to peak learning state'
        ];
      }
    }

    return {
      triggered,
      trigger,
      confidence,
      message,
      benefits,
      alternatives: triggered ? [
        'Study 3 more cards then break',
        'Switch to easier cards',
        'Try a different study mode'
      ] : undefined,
      timing: confidence > 80 ? 'immediate' : 'after_current_card',
    };
  }

  // Get session optimization recommendations
  getSessionOptimization(): SessionOptimization {
    const fatigue = this.getFatigueIndicators();
    const breakSuggestion = this.getBreakSuggestion();
    const sessionDuration = (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60;

    let recommendedBreakNow = false;
    let breakUrgency: SessionOptimization['breakUrgency'] = 'low';
    let breakReason: SessionOptimization['breakReason'] = 'schedule_optimization';
    let sessionShouldEnd = false;

    // Determine break urgency
    if (fatigue.overallFatigueScore > 80) {
      recommendedBreakNow = true;
      breakUrgency = 'critical';
      breakReason = 'fatigue_pattern';
    } else if (breakSuggestion.triggered && breakSuggestion.confidence > 75) {
      recommendedBreakNow = true;
      breakUrgency = 'high';
      breakReason = breakSuggestion.trigger === 'performance_drop' ? 'performance_decline' : 
                   breakSuggestion.trigger === 'fatigue_detected' ? 'fatigue_pattern' : 'time_limit';
    } else if (sessionDuration > this.config.workloadLimits.maxSessionLength) {
      sessionShouldEnd = true;
      breakUrgency = 'high';
      breakReason = 'time_limit';
    }

    // Calculate recommended break duration
    let recommendedBreakDuration = 5; // default 5 minutes
    if (fatigue.overallFatigueScore > 70) {
      recommendedBreakDuration = 10;
    }
    if (sessionDuration > 30) {
      recommendedBreakDuration = 15;
    }

    // Next session recommendation
    const nextSessionRecommendation = new Date();
    nextSessionRecommendation.setMinutes(
      nextSessionRecommendation.getMinutes() + 
      Math.max(recommendedBreakDuration, this.config.workloadLimits.minimumBreakBetweenSessions)
    );

    return {
      recommendedBreakNow,
      breakUrgency,
      breakReason,
      recommendedBreakDuration,
      sessionShouldEnd,
      nextSessionRecommendation,
    };
  }

  // Get workload balance assessment
  getWorkloadBalance(cardsStudiedToday: number): WorkloadBalance {
    const dailyCapacity = this.config.workloadLimits.maxDailyCards;
    const fatigue = this.getFatigueIndicators();
    
    // Adjust capacity based on fatigue
    const adjustedCapacity = Math.round(dailyCapacity * (1 - fatigue.overallFatigueScore / 200));
    const remainingCapacity = Math.max(0, adjustedCapacity - cardsStudiedToday);
    
    // Estimate optimal session length based on current performance
    let optimalSessionLength = this.config.workloadLimits.optimalSessionLength;
    if (fatigue.overallFatigueScore > 50) {
      optimalSessionLength = Math.round(optimalSessionLength * 0.7);
    }

    const averageCardsPerMinute = this.responseData.length / 
      Math.max(1, (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
    const recommendedCardCount = Math.round(optimalSessionLength * averageCardsPerMinute);

    return {
      dailyCapacity: adjustedCapacity,
      currentLoad: cardsStudiedToday,
      remainingCapacity,
      optimalSessionLength,
      recommendedCardCount: Math.min(recommendedCardCount, remainingCapacity),
      overloadRisk: cardsStudiedToday > adjustedCapacity * 0.8,
    };
  }

  // Pattern detection for insights
  getPatternDetection(): PatternDetection {
    if (this.responseData.length < 5) {
      return {
        responseTimeTrend: { direction: 'stable', strength: 0, confidence: 0, dataPoints: 0 },
        performanceTrend: { direction: 'stable', strength: 0, confidence: 0, dataPoints: 0 },
        fatigueProgression: { direction: 'stable', strength: 0, confidence: 0, dataPoints: 0 },
        recommendations: ['Need more data for pattern analysis'],
      };
    }

    const responseTimes = this.responseData.map(d => d.totalTime);
    const ratings = this.responseData.map(d => this.emojiToScore(d.rating));
    const fatigueScores = this.performanceWindows.map(w => w.fatigueScore);

    const responseTimeTrend = this.calculateTrend(responseTimes);
    const performanceTrend = this.calculateTrend(ratings);
    const fatigueProgression = this.calculateTrend(fatigueScores);

    const recommendations: string[] = [];

    if (responseTimeTrend.direction === 'declining' && responseTimeTrend.confidence > 60) {
      recommendations.push('Consider shorter study sessions or more frequent breaks');
    }
    if (performanceTrend.direction === 'declining' && performanceTrend.confidence > 60) {
      recommendations.push('Review difficult cards later when you\'re fresher');
    }
    if (fatigueProgression.direction === 'declining' && fatigueProgression.confidence > 60) {
      recommendations.push('Your fatigue is increasing - take a longer break');
    }
    if (recommendations.length === 0) {
      recommendations.push('You\'re maintaining good performance - keep it up!');
    }

    return {
      responseTimeTrend,
      performanceTrend,
      fatigueProgression,
      recommendations,
    };
  }

  // Reset for new session
  reset(): void {
    this.responseData = [];
    this.performanceWindows = [];
    this.sessionStartTime = new Date();
  }

  // Get session summary for storage
  getSessionSummary() {
    return {
      totalCards: this.responseData.length,
      sessionDuration: (Date.now() - this.sessionStartTime.getTime()) / 1000 / 60,
      finalFatigueScore: this.getFatigueIndicators().overallFatigueScore,
      averageResponseTime: this.responseData.reduce((sum, d) => sum + d.totalTime, 0) / this.responseData.length,
      performanceWindows: this.performanceWindows.length,
      patterns: this.getPatternDetection(),
    };
  }
}