// Advanced Spaced Repetition System Types
// Comprehensive type definitions for the enhanced SRS implementation

import { EmojiRating } from '../contexts/StudyContext';

// ========================================
// CORE SRS ENUMS AND INTERFACES
// ========================================

export enum CardState {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEW = 'review',
  RELEARNING = 'relearning'
}

export interface DeckConfig {
  id: string;
  deckId: string;
  
  // Learning phase settings (in minutes)
  learningSteps: number[]; // Default: [1, 10]
  graduatingInterval: number; // Days to first review after learning (default: 1)
  easyInterval: number; // Days for easy graduation (default: 4)
  
  // Relearning settings (in minutes)
  relearningSteps: number[]; // Default: [10]
  
  // Daily limits
  newCardsPerDay: number; // Default: 20
  maximumInterval: number; // Maximum days between reviews (default: 36500)
  
  // Ease factor management
  startingEase: number; // Default: 2.5
  easyBonus: number; // Ease bonus for easy ratings (default: 0.15)
  hardPenalty: number; // Ease penalty for hard ratings (default: 0.15)
  lapsePenalty: number; // Ease penalty for lapses (default: 0.2)
  
  // Leech detection
  lapseThreshold: number; // Number of lapses before marking as leech (default: 8)
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface EnhancedCard {
  // Base card properties
  id: string;
  deckId: string;
  type: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: number;
  created: string;
  
  // SRS properties
  cardState: CardState;
  learningStep?: number; // Current step in learning/relearning (0-based)
  lapseCount: number; // Number of times forgotten
  isLeech: boolean; // Marked as problematic card
  
  // Scheduling properties
  lastStudied: string | null;
  nextDue: string;
  interval: number; // Current interval in days
  easeFactor: number; // Current ease factor
  reviewCount: number; // Total number of reviews
  
  // Optional content
  hint?: string;
  image?: string;
}

export interface SchedulingResult {
  // Next review timing
  nextDue: Date;
  interval: number; // In appropriate units (minutes for learning, days for review)
  
  // Card state changes
  cardState: CardState;
  learningStep?: number;
  easeFactor: number;
  
  // Transition flags
  graduated?: boolean; // Moved from learning to review
  isLeech?: boolean; // Card marked as leech
  
  // Additional metadata
  lapseCount?: number;
  reviewCount: number;
}

// ========================================
// STUDY QUEUE AND SESSION TYPES
// ========================================

export interface StudyQueueCard extends EnhancedCard {
  priority: number; // 1=relearning, 2=learning, 3=due review, 4=new
}

export interface StudySessionConfig {
  deckId: string;
  newCardLimit: number;
  totalCardLimit: number;
  enableLearningCards: boolean;
  enableReviewCards: boolean;
  enableRelearningCards: boolean;
}

export interface SessionProgress {
  cardsStudied: number;
  newCardsStudied: number;
  learningCardsStudied: number;
  reviewCardsStudied: number;
  relearningCardsStudied: number;
  
  // State transitions during session
  graduatedCards: number; // Learning → Review
  lapsedCards: number; // Review → Relearning
  leechesCreated: number; // Cards marked as leeches
  
  // Performance metrics
  averageResponseTime: number;
  retentionRate: number; // Percentage of non-lapse ratings
}

// ========================================
// ANALYTICS AND STATISTICS
// ========================================

export interface DeckStatistics {
  deckId: string;
  deckName: string;
  
  // Card counts by state
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  leechCards: number;
  
  // Due cards breakdown
  dueReviews: number;
  overdue: number;
  
  // Performance metrics
  retentionRate: number;
  averageEase: number;
  averageInterval: number;
}

export interface LearningProgress {
  // Learning phase analytics
  learningStepCompletionRates: number[]; // Completion rate for each learning step
  averageTimeToGraduation: number; // Days from new to review
  graduationSuccessRate: number; // Percentage that complete learning
  
  // Review phase analytics
  reviewRetentionByInterval: Map<number, number>; // Retention rate by interval length
  easeFactorDistribution: number[]; // Distribution of ease factors
  
  // Lapse analytics
  lapsePatterns: {
    intervalLength: number;
    lapseRate: number;
  }[];
  mostProblematicCards: string[]; // Card IDs with highest lapse rates
}

// ========================================
// CONFIGURATION AND PRESETS
// ========================================

export interface ConfigPreset {
  name: string;
  description: string;
  config: Partial<DeckConfig>;
}

export const DEFAULT_DECK_CONFIG: DeckConfig = {
  id: '',
  deckId: '',
  learningSteps: [1, 10], // 1 minute, 10 minutes
  graduatingInterval: 1, // 1 day
  easyInterval: 4, // 4 days
  relearningSteps: [10], // 10 minutes
  newCardsPerDay: 20,
  maximumInterval: 36500, // ~100 years
  startingEase: 2.5,
  easyBonus: 0.15,
  hardPenalty: 0.15,
  lapsePenalty: 0.2,
  lapseThreshold: 8,
  createdAt: '',
  updatedAt: ''
};

export const CONFIG_PRESETS: ConfigPreset[] = [
  {
    name: 'Conservative',
    description: 'Longer learning phases, more frequent reviews',
    config: {
      learningSteps: [1, 10, 1440], // 1min, 10min, 1day
      graduatingInterval: 3,
      easyInterval: 7,
      newCardsPerDay: 15,
      startingEase: 2.3
    }
  },
  {
    name: 'Balanced',
    description: 'Standard settings for most users',
    config: DEFAULT_DECK_CONFIG
  },
  {
    name: 'Aggressive',
    description: 'Faster progression, more new cards',
    config: {
      learningSteps: [10], // 10 minutes only
      graduatingInterval: 1,
      easyInterval: 3,
      newCardsPerDay: 30,
      startingEase: 2.7
    }
  },
  {
    name: 'Language Learning',
    description: 'Optimized for vocabulary acquisition',
    config: {
      learningSteps: [1, 10, 60, 1440], // 1min, 10min, 1hr, 1day
      graduatingInterval: 2,
      easyInterval: 5,
      newCardsPerDay: 25,
      lapseThreshold: 6 // More forgiving for language cards
    }
  }
];

// ========================================
// UTILITY TYPES
// ========================================

export interface RatingMapping {
  emoji: EmojiRating;
  value: number;
  label: string;
  description: string;
}

export const RATING_MAPPINGS: RatingMapping[] = [
  {
    emoji: '😞',
    value: 0,
    label: 'Again',
    description: 'Complete blackout - show again soon'
  },
  {
    emoji: '😐',
    value: 1,
    label: 'Hard',
    description: 'Difficult recall - reduce ease factor'
  },
  {
    emoji: '😊',
    value: 2,
    label: 'Good',
    description: 'Normal recall - standard progression'
  },
  {
    emoji: '😁',
    value: 3,
    label: 'Easy',
    description: 'Effortless recall - increase interval'
  }
];

// ========================================
// API RESPONSE TYPES
// ========================================

export interface AdvancedReviewResponse {
  success: boolean;
  card: {
    id: string;
    nextDue: string;
    interval: number;
    easeFactor: number;
    cardState: CardState;
    learningStep?: number;
    lapseCount: number;
    isLeech: boolean;
  };
  transitions?: {
    graduated: boolean;
    lapsed: boolean;
    becameLeech: boolean;
  };
  error?: string;
}

export interface StudyQueueResponse {
  success: boolean;
  cards: StudyQueueCard[];
  metadata: {
    totalAvailable: number;
    newCardsRemaining: number;
    dueReviews: number;
    learningCards: number;
    relearningCards: number;
  };
  error?: string;
}

// ========================================
// VALIDATION SCHEMAS
// ========================================

export function validateDeckConfig(config: Partial<DeckConfig>): string[] {
  const errors: string[] = [];
  
  if (config.learningSteps && config.learningSteps.length === 0) {
    errors.push('Learning steps cannot be empty');
  }
  
  if (config.learningSteps && config.learningSteps.some(step => step <= 0)) {
    errors.push('All learning steps must be positive');
  }
  
  if (config.graduatingInterval && config.graduatingInterval <= 0) {
    errors.push('Graduating interval must be positive');
  }
  
  if (config.easyInterval && config.easyInterval <= 0) {
    errors.push('Easy interval must be positive');
  }
  
  if (config.newCardsPerDay && config.newCardsPerDay < 0) {
    errors.push('New cards per day cannot be negative');
  }
  
  if (config.startingEase && config.startingEase < 1.3) {
    errors.push('Starting ease must be at least 1.3');
  }
  
  if (config.lapseThreshold && config.lapseThreshold <= 0) {
    errors.push('Lapse threshold must be positive');
  }
  
  return errors;
}

export function isValidCardState(state: string): state is CardState {
  return Object.values(CardState).includes(state as CardState);
}

export function isValidRating(rating: EmojiRating): boolean {
  return RATING_MAPPINGS.some(mapping => mapping.emoji === rating);
}