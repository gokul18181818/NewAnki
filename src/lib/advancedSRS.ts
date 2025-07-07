// Advanced Spaced Repetition System Engine
// Core scheduling logic for state-based SRS with learning phases

import {
  CardState,
  DeckConfig,
  EnhancedCard,
  SchedulingResult,
  DEFAULT_DECK_CONFIG,
  RATING_MAPPINGS
} from '../types/SRSTypes';
import { EmojiRating } from '../contexts/StudyContext';

// ========================================
// MAIN SRS ENGINE CLASS
// ========================================

export class AdvancedSRSEngine {
  
  /**
   * Main scheduling function - determines next review timing based on card state and rating
   */
  static scheduleCard(
    card: EnhancedCard,
    rating: EmojiRating,
    config: DeckConfig = DEFAULT_DECK_CONFIG
  ): SchedulingResult {
    const ratingValue = this.emojiToRating(rating);
    
    switch (card.cardState) {
      case CardState.NEW:
        return this.scheduleNewCard(card, ratingValue, config);
      case CardState.LEARNING:
        return this.scheduleLearningCard(card, ratingValue, config);
      case CardState.REVIEW:
        return this.scheduleReviewCard(card, ratingValue, config);
      case CardState.RELEARNING:
        return this.scheduleRelearningCard(card, ratingValue, config);
      default:
        throw new Error(`Unknown card state: ${card.cardState}`);
    }
  }

  // ========================================
  // STATE-SPECIFIC SCHEDULING METHODS
  // ========================================

  /**
   * Schedule a new card entering the learning phase
   */
  private static scheduleNewCard(
    card: EnhancedCard,
    rating: number,
    config: DeckConfig
  ): SchedulingResult {
    // New cards always start learning regardless of rating
    // Rating affects which step they start at
    
    if (rating === 3) { // Easy - graduate immediately
      return {
        nextDue: this.addDays(new Date(), config.easyInterval),
        interval: config.easyInterval,
        cardState: CardState.REVIEW,
        easeFactor: config.startingEase + config.easyBonus,
        graduated: true,
        reviewCount: card.reviewCount + 1
      };
    }
    
    if (rating === 0) { // Again - start at first learning step
      return {
        nextDue: this.addMinutes(new Date(), config.learningSteps[0]),
        interval: config.learningSteps[0] / (24 * 60), // Convert to days for consistency
        cardState: CardState.LEARNING,
        learningStep: 0,
        easeFactor: config.startingEase,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Good/Hard - start learning progression
    return {
      nextDue: this.addMinutes(new Date(), config.learningSteps[0]),
      interval: config.learningSteps[0] / (24 * 60),
      cardState: CardState.LEARNING,
      learningStep: 0,
      easeFactor: config.startingEase,
      reviewCount: card.reviewCount + 1
    };
  }

  /**
   * Schedule a card in the learning phase
   */
  private static scheduleLearningCard(
    card: EnhancedCard,
    rating: number,
    config: DeckConfig
  ): SchedulingResult {
    const currentStep = card.learningStep || 0;
    
    // Failed - restart learning from beginning
    if (rating === 0) {
      return {
        nextDue: this.addMinutes(new Date(), config.learningSteps[0]),
        interval: config.learningSteps[0] / (24 * 60),
        cardState: CardState.LEARNING,
        learningStep: 0,
        easeFactor: card.easeFactor,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Easy - graduate immediately to review
    if (rating === 3) {
      return {
        nextDue: this.addDays(new Date(), config.easyInterval),
        interval: config.easyInterval,
        cardState: CardState.REVIEW,
        easeFactor: card.easeFactor + config.easyBonus,
        graduated: true,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Good/Hard - advance to next learning step or graduate
    const nextStep = currentStep + 1;
    
    if (nextStep >= config.learningSteps.length) {
      // Graduate to review phase
      return {
        nextDue: this.addDays(new Date(), config.graduatingInterval),
        interval: config.graduatingInterval,
        cardState: CardState.REVIEW,
        easeFactor: rating === 1 ? card.easeFactor - config.hardPenalty : card.easeFactor,
        graduated: true,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Continue learning progression
    const nextStepMinutes = config.learningSteps[nextStep];
    return {
      nextDue: this.addMinutes(new Date(), nextStepMinutes),
      interval: nextStepMinutes / (24 * 60),
      cardState: CardState.LEARNING,
      learningStep: nextStep,
      easeFactor: rating === 1 ? card.easeFactor - config.hardPenalty : card.easeFactor,
      reviewCount: card.reviewCount + 1
    };
  }

  /**
   * Schedule a card in the review phase (standard SM-2 with enhancements)
   */
  private static scheduleReviewCard(
    card: EnhancedCard,
    rating: number,
    config: DeckConfig
  ): SchedulingResult {
    // Failed - move to relearning
    if (rating === 0) {
      const newLapseCount = card.lapseCount + 1;
      const newEaseFactor = Math.max(1.3, card.easeFactor - config.lapsePenalty);
      
      return {
        nextDue: this.addMinutes(new Date(), config.relearningSteps[0]),
        interval: config.relearningSteps[0] / (24 * 60),
        cardState: CardState.RELEARNING,
        learningStep: 0,
        easeFactor: newEaseFactor,
        lapseCount: newLapseCount,
        isLeech: newLapseCount >= config.lapseThreshold,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Apply SM-2 algorithm with modifications
    const newEaseFactor = this.updateEaseFactor(card.easeFactor, rating, config);
    const newInterval = this.calculateReviewInterval(card.interval, newEaseFactor, rating, config);
    
    return {
      nextDue: this.addDays(new Date(), Math.min(newInterval, config.maximumInterval)),
      interval: newInterval,
      cardState: CardState.REVIEW,
      easeFactor: newEaseFactor,
      reviewCount: card.reviewCount + 1
    };
  }

  /**
   * Schedule a card in the relearning phase
   */
  private static scheduleRelearningCard(
    card: EnhancedCard,
    rating: number,
    config: DeckConfig
  ): SchedulingResult {
    const currentStep = card.learningStep || 0;
    
    // Failed - restart relearning
    if (rating === 0) {
      const newLapseCount = card.lapseCount + 1;
      return {
        nextDue: this.addMinutes(new Date(), config.relearningSteps[0]),
        interval: config.relearningSteps[0] / (24 * 60),
        cardState: CardState.RELEARNING,
        learningStep: 0,
        easeFactor: Math.max(1.3, card.easeFactor - config.lapsePenalty),
        lapseCount: newLapseCount,
        isLeech: newLapseCount >= config.lapseThreshold,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Easy - graduate immediately back to review
    if (rating === 3) {
      const graduationInterval = Math.max(1, Math.round(card.interval * 0.5)); // 50% of previous interval
      return {
        nextDue: this.addDays(new Date(), graduationInterval),
        interval: graduationInterval,
        cardState: CardState.REVIEW,
        easeFactor: card.easeFactor + config.easyBonus,
        graduated: true,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Good/Hard - advance relearning step or graduate
    const nextStep = currentStep + 1;
    
    if (nextStep >= config.relearningSteps.length) {
      // Graduate back to review with reduced interval
      const graduationInterval = Math.max(1, Math.round(card.interval * 0.25)); // 25% of previous interval
      return {
        nextDue: this.addDays(new Date(), graduationInterval),
        interval: graduationInterval,
        cardState: CardState.REVIEW,
        easeFactor: rating === 1 ? card.easeFactor - config.hardPenalty : card.easeFactor,
        graduated: true,
        reviewCount: card.reviewCount + 1
      };
    }
    
    // Continue relearning progression
    const nextStepMinutes = config.relearningSteps[nextStep];
    return {
      nextDue: this.addMinutes(new Date(), nextStepMinutes),
      interval: nextStepMinutes / (24 * 60),
      cardState: CardState.RELEARNING,
      learningStep: nextStep,
      easeFactor: rating === 1 ? card.easeFactor - config.hardPenalty : card.easeFactor,
      reviewCount: card.reviewCount + 1
    };
  }

  // ========================================
  // SM-2 ALGORITHM HELPERS
  // ========================================

  /**
   * Update ease factor based on rating (enhanced SM-2)
   */
  private static updateEaseFactor(
    currentEase: number,
    rating: number,
    config: DeckConfig
  ): number {
    let newEase = currentEase;
    
    switch (rating) {
      case 0: // Again - significant penalty (handled in state transitions)
        newEase = Math.max(1.3, currentEase - config.lapsePenalty);
        break;
      case 1: // Hard - small penalty
        newEase = Math.max(1.3, currentEase - config.hardPenalty);
        break;
      case 2: // Good - slight increase
        newEase = currentEase + 0.1;
        break;
      case 3: // Easy - bonus increase
        newEase = currentEase + config.easyBonus;
        break;
    }
    
    return Math.round(newEase * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate next review interval for review cards
   */
  private static calculateReviewInterval(
    currentInterval: number,
    easeFactor: number,
    rating: number,
    config: DeckConfig
  ): number {
    let newInterval: number;
    
    switch (rating) {
      case 1: // Hard - reduced interval
        newInterval = Math.max(1, Math.round(currentInterval * 1.2));
        break;
      case 2: // Good - standard SM-2
        newInterval = Math.round(currentInterval * easeFactor);
        break;
      case 3: // Easy - bonus multiplier
        newInterval = Math.round(currentInterval * easeFactor * 1.3);
        break;
      default:
        newInterval = Math.round(currentInterval * easeFactor);
    }
    
    return Math.min(newInterval, config.maximumInterval);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Convert emoji rating to numerical value
   */
  private static emojiToRating(emoji: EmojiRating): number {
    const mapping = RATING_MAPPINGS.find(m => m.emoji === emoji);
    if (!mapping) {
      throw new Error(`Unknown rating emoji: ${emoji}`);
    }
    return mapping.value;
  }

  /**
   * Add minutes to a date
   */
  private static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  /**
   * Add days to a date
   */
  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // ========================================
  // PREDICTION AND ANALYTICS
  // ========================================

  /**
   * Predict when card will be due again for each possible rating
   */
  static predictNextDue(
    card: EnhancedCard,
    config: DeckConfig = DEFAULT_DECK_CONFIG
  ): Record<EmojiRating, { nextDue: Date; interval: number; newState: CardState }> {
    const predictions: Record<string, any> = {};
    
    RATING_MAPPINGS.forEach(({ emoji }) => {
      const result = this.scheduleCard(card, emoji, config);
      predictions[emoji] = {
        nextDue: result.nextDue,
        interval: result.interval,
        newState: result.cardState
      };
    });
    
    return predictions as Record<EmojiRating, { nextDue: Date; interval: number; newState: CardState }>;
  }

  /**
   * Calculate retention probability for a card at current time
   */
  static calculateRetentionProbability(card: EnhancedCard): number {
    if (!card.lastStudied) return 0;
    
    const lastStudied = new Date(card.lastStudied);
    const daysSince = (Date.now() - lastStudied.getTime()) / (1000 * 60 * 60 * 24);
    const intervalDays = card.interval;
    
    // Simple exponential decay model
    // This could be enhanced with more sophisticated algorithms
    const stabilityFactor = card.easeFactor / 2.5; // Normalize around default ease
    const retentionRate = Math.exp(-daysSince / (intervalDays * stabilityFactor));
    
    return Math.max(0, Math.min(1, retentionRate));
  }

  /**
   * Estimate time to mastery (reaching a target ease factor and interval)
   */
  static estimateTimeToMastery(
    card: EnhancedCard,
    targetEase: number = 3.0,
    targetInterval: number = 30,
    config: DeckConfig = DEFAULT_DECK_CONFIG
  ): { days: number; reviews: number } {
    let currentEase = card.easeFactor;
    let currentInterval = card.interval;
    let days = 0;
    let reviews = 0;
    
    // Simulate successful reviews (rating 2 - Good)
    while (currentEase < targetEase || currentInterval < targetInterval) {
      currentEase = this.updateEaseFactor(currentEase, 2, config);
      currentInterval = this.calculateReviewInterval(currentInterval, currentEase, 2, config);
      days += currentInterval;
      reviews++;
      
      // Safety break to prevent infinite loops
      if (reviews > 100) break;
    }
    
    return { days, reviews };
  }
}

// ========================================
// DECK CONFIGURATION UTILITIES
// ========================================

export class DeckConfigManager {
  
  /**
   * Merge partial config with defaults
   */
  static mergeWithDefaults(partialConfig: Partial<DeckConfig>): DeckConfig {
    return {
      ...DEFAULT_DECK_CONFIG,
      ...partialConfig,
      id: partialConfig.id || '',
      deckId: partialConfig.deckId || '',
      createdAt: partialConfig.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate configuration values
   */
  static validateConfig(config: Partial<DeckConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.learningSteps) {
      if (config.learningSteps.length === 0) {
        errors.push('Learning steps cannot be empty');
      }
      if (config.learningSteps.some(step => step <= 0)) {
        errors.push('All learning steps must be positive');
      }
    }
    
    if (config.graduatingInterval !== undefined && config.graduatingInterval <= 0) {
      errors.push('Graduating interval must be positive');
    }
    
    if (config.startingEase !== undefined && config.startingEase < 1.3) {
      errors.push('Starting ease must be at least 1.3');
    }
    
    // Add more validations as needed
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate optimized config based on user performance data
   */
  static optimizeConfig(
    currentConfig: DeckConfig,
    performanceData: {
      averageRetention: number;
      averageResponseTime: number;
      lapseRate: number;
    }
  ): DeckConfig {
    const optimized = { ...currentConfig };
    
    // Adjust based on retention rate
    if (performanceData.averageRetention < 0.8) {
      // Low retention - make more conservative
      optimized.graduatingInterval = Math.min(currentConfig.graduatingInterval + 1, 3);
      optimized.startingEase = Math.max(currentConfig.startingEase - 0.1, 2.0);
    } else if (performanceData.averageRetention > 0.95) {
      // High retention - can be more aggressive
      optimized.graduatingInterval = Math.max(currentConfig.graduatingInterval - 1, 1);
      optimized.startingEase = Math.min(currentConfig.startingEase + 0.1, 3.0);
    }
    
    // Adjust based on lapse rate
    if (performanceData.lapseRate > 0.3) {
      // High lapse rate - add more learning steps
      if (optimized.learningSteps.length < 3) {
        optimized.learningSteps = [...optimized.learningSteps, 60]; // Add 1 hour step
      }
    }
    
    return optimized;
  }
}