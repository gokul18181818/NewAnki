import { EmojiRating } from '../contexts/StudyContext';

// Core interfaces for anti-burnout intelligence system
export interface ResponseTimeData {
  cardId: string;
  timeToShowAnswer: number; // milliseconds from card shown to "Show Answer" clicked
  timeToRate: number; // milliseconds from answer shown to rating selected
  totalTime: number; // total time spent on this card
  timestamp: Date;
  rating: EmojiRating;
  difficulty: number; // card difficulty level
}

export interface FatigueIndicators {
  responseTimeSlowing: boolean; // response times increasing over session
  performanceDeclining: boolean; // more negative ratings over time
  hesitationIncreasing: boolean; // longer pauses before showing answers
  consistencyDecreasing: boolean; // more variation in response times
  overallFatigueScore: number; // 0-100, higher = more fatigued
}

export interface PerformanceWindow {
  windowStart: number; // card index
  windowEnd: number; // card index
  averageResponseTime: number;
  averageRating: number; // converted to 0-3 scale
  ratingDistribution: Record<EmojiRating, number>;
  fatigueScore: number;
}

export interface SessionOptimization {
  recommendedBreakNow: boolean;
  breakUrgency: 'low' | 'medium' | 'high' | 'critical';
  breakReason: 'performance_decline' | 'time_limit' | 'response_slow' | 'fatigue_pattern' | 'schedule_optimization';
  recommendedBreakDuration: number; // minutes
  sessionShouldEnd: boolean;
  nextSessionRecommendation: Date;
}

export interface BurnoutDetection {
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  indicators: {
    crossSessionPerformanceDecline: boolean;
    increasingStudyResistance: boolean;
    consistentLowMotivation: boolean;
    negativeEmotionalPatterns: boolean;
  };
  interventionRequired: boolean;
  recommendedActions: BurnoutIntervention[];
}

export interface BurnoutIntervention {
  type: 'rest_day' | 'reduce_load' | 'change_content' | 'motivation_boost' | 'seek_help';
  priority: 'low' | 'medium' | 'high';
  message: string;
  actionable: boolean;
  duration?: string; // e.g., "2-3 days", "1 week"
}

export interface WorkloadBalance {
  dailyCapacity: number; // estimated cards user can handle today
  currentLoad: number; // cards already studied today
  remainingCapacity: number;
  optimalSessionLength: number; // minutes
  recommendedCardCount: number;
  overloadRisk: boolean;
}

export interface RecoveryProtocol {
  breakTaken: boolean;
  breakDuration: number; // actual minutes taken
  breakEffectiveness: number; // 0-100, how much the break helped
  preBreakPerformance: PerformanceWindow;
  postBreakPerformance?: PerformanceWindow;
  recoveryRecommendations: string[];
}

export interface SmartBreakSuggestion {
  triggered: boolean;
  trigger: 'fatigue_detected' | 'time_threshold' | 'performance_drop' | 'scheduled' | 'user_pattern';
  confidence: number; // 0-100, how confident we are this break is needed
  message: string;
  benefits: string[]; // why this break will help
  alternatives?: string[]; // other options besides breaking
  timing: 'immediate' | 'after_current_card' | 'in_5_minutes' | 'flexible';
}

export interface AntiBurnoutSession {
  sessionId: string;
  startTime: Date;
  responseTimeData: ResponseTimeData[];
  performanceWindows: PerformanceWindow[];
  fatigueProgression: FatigueIndicators[];
  breakSuggestions: SmartBreakSuggestion[];
  breaksTaken: RecoveryProtocol[];
  sessionOptimization: SessionOptimization;
  endTime?: Date;
  burnoutAssessment?: BurnoutDetection;
}

export interface AntiBurnoutConfig {
  responseTimeThresholds: {
    baseline: number; // average expected response time in ms
    slowWarning: number; // when to consider responses "slow"
    fatigueThreshold: number; // when responses indicate fatigue
  };
  performanceWindows: {
    windowSize: number; // number of cards to analyze together
    overlapSize: number; // overlap between windows
    minimumWindow: number; // minimum cards before analysis
  };
  breakTriggers: {
    fatigueScoreThreshold: number; // 0-100
    performanceDropThreshold: number; // percentage drop to trigger break
    timeBasedBreakInterval: number; // minutes
    responseTimeSlowingThreshold: number; // percentage increase
  };
  workloadLimits: {
    maxDailyCards: number;
    maxSessionLength: number; // minutes
    optimalSessionLength: number; // minutes
    minimumBreakBetweenSessions: number; // minutes
  };
  burnoutDetection: {
    crossSessionAnalysisPeriod: number; // days to look back
    performanceDeclineThreshold: number; // percentage
    interventionThreshold: number; // risk score 0-100
  };
}

// Default configuration for anti-burnout system
export const DEFAULT_ANTI_BURNOUT_CONFIG: AntiBurnoutConfig = {
  responseTimeThresholds: {
    baseline: 3000, // 3 seconds average
    slowWarning: 6000, // 6 seconds is slow
    fatigueThreshold: 10000, // 10+ seconds indicates fatigue
  },
  performanceWindows: {
    windowSize: 5, // analyze every 5 cards
    overlapSize: 2, // 2 cards overlap between windows
    minimumWindow: 3, // need at least 3 cards for analysis
  },
  breakTriggers: {
    fatigueScoreThreshold: 65, // 65/100 fatigue score triggers break
    performanceDropThreshold: 25, // 25% performance drop
    timeBasedBreakInterval: 25, // suggest break every 25 minutes
    responseTimeSlowingThreshold: 40, // 40% slower responses
  },
  workloadLimits: {
    maxDailyCards: 200, // reasonable daily limit
    maxSessionLength: 45, // 45 minutes max session
    optimalSessionLength: 20, // 20 minutes is optimal
    minimumBreakBetweenSessions: 15, // 15 minutes between sessions
  },
  burnoutDetection: {
    crossSessionAnalysisPeriod: 14, // look back 2 weeks
    performanceDeclineThreshold: 20, // 20% decline indicates burnout risk
    interventionThreshold: 70, // 70/100 risk score requires intervention
  },
};

// Helper types for pattern analysis
export interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'declining';
  strength: number; // 0-100, how strong the trend is
  confidence: number; // 0-100, how confident we are in the trend
  dataPoints: number; // how many data points used
}

export interface PatternDetection {
  responseTimeTrend: TrendAnalysis;
  performanceTrend: TrendAnalysis;
  fatigueProgression: TrendAnalysis;
  recommendations: string[];
}

// User preferences interface for anti-burnout system
export interface UserBreakPreferences {
  breakInterval?: number;
  breakDuration?: number;
  adaptiveBreaks?: boolean;
  maxDailyCards?: number;
  customSessionLength?: number;
  sessionLength?: string;
}

// Response time baseline learning
export interface ResponseTimeBaseline {
  userId: string;
  averageTime: number; // learned baseline in milliseconds
  standardDeviation: number;
  sampleSize: number;
  lastUpdated: Date;
  byDifficulty: Record<number, { avg: number; std: number; count: number }>;
}

// Function to create user-adaptive anti-burnout config
export function createUserAdaptiveConfig(
  userPreferences: UserBreakPreferences,
  learnedBaseline?: ResponseTimeBaseline
): AntiBurnoutConfig {
  const base = { ...DEFAULT_ANTI_BURNOUT_CONFIG };
  
  // Update break timing based on user preferences
  if (userPreferences.breakInterval && !userPreferences.adaptiveBreaks) {
    base.breakTriggers.timeBasedBreakInterval = userPreferences.breakInterval;
  }
  
  // Update workload limits based on user preferences
  if (userPreferences.maxDailyCards) {
    base.workloadLimits.maxDailyCards = userPreferences.maxDailyCards;
  }
  
  // Update session length based on user preferences
  if (userPreferences.customSessionLength && userPreferences.sessionLength === 'custom') {
    base.workloadLimits.optimalSessionLength = userPreferences.customSessionLength;
    base.workloadLimits.maxSessionLength = Math.max(userPreferences.customSessionLength, userPreferences.customSessionLength * 1.5);
  }
  
  // Update response time thresholds based on learned baseline
  if (learnedBaseline && learnedBaseline.sampleSize >= 10) {
    const baseline = learnedBaseline.averageTime;
    const std = learnedBaseline.standardDeviation;
    
    base.responseTimeThresholds.baseline = baseline;
    base.responseTimeThresholds.slowWarning = baseline + std * 1.5;
    base.responseTimeThresholds.fatigueThreshold = baseline + std * 2.5;
  }
  
  return base;
}