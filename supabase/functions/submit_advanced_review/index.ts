// Enhanced Submit Review Function for Advanced SRS
// Handles state transitions, learning phases, and intelligent scheduling

// @ts-ignore - Deno types for Edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SHARED INTERFACES AND CONSTANTS
// ========================================

interface DeckConfig {
  learning_steps: number[];
  graduating_interval: number;
  easy_interval: number;
  relearning_steps: number[];
  new_cards_per_day: number;
  maximum_interval: number;
  starting_ease: number;
  easy_bonus: number;
  hard_penalty: number;
  lapse_penalty: number;
  lapse_threshold: number;
}

interface CardState {
  id: string;
  card_state: string;
  learning_step: number;
  lapse_count: number;
  ease_factor: number;
  interval: number;
  review_count: number;
  last_studied: string | null;
  next_due: string;
  is_leech: boolean;
}

interface SchedulingResult {
  next_due: Date;
  interval: number;
  card_state: string;
  learning_step?: number;
  ease_factor: number;
  lapse_count?: number;
  is_leech?: boolean;
  review_count: number;
  
  // Transition flags
  graduated?: boolean;
  lapsed?: boolean;
  became_leech?: boolean;
}

// CORS headers
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========================================
// ADVANCED SRS SCHEDULING ENGINE
// ========================================

class AdvancedSRSEngine {
  
  static scheduleCard(card: CardState, rating: number, config: DeckConfig): SchedulingResult {
    switch (card.card_state) {
      case 'new':
        return this.scheduleNewCard(card, rating, config);
      case 'learning':
        return this.scheduleLearningCard(card, rating, config);
      case 'review':
        return this.scheduleReviewCard(card, rating, config);
      case 'relearning':
        return this.scheduleRelearningCard(card, rating, config);
      default:
        throw new Error(`Unknown card state: ${card.card_state}`);
    }
  }

  private static scheduleNewCard(card: CardState, rating: number, config: DeckConfig): SchedulingResult {
    const now = new Date();
    
    if (rating === 3) { // Easy - graduate immediately
      return {
        next_due: this.addDays(now, config.easy_interval),
        interval: config.easy_interval,
        card_state: 'review',
        ease_factor: config.starting_ease + config.easy_bonus,
        review_count: card.review_count + 1,
        graduated: true
      };
    }
    
    if (rating === 0) { // Again - start learning
      return {
        next_due: this.addMinutes(now, config.learning_steps[0]),
        interval: config.learning_steps[0] / (24 * 60), // Convert to days for storage
        card_state: 'learning',
        learning_step: 0,
        ease_factor: config.starting_ease,
        review_count: card.review_count + 1
      };
    }
    
    // Good/Hard - start learning
    return {
      next_due: this.addMinutes(now, config.learning_steps[0]),
      interval: config.learning_steps[0] / (24 * 60),
      card_state: 'learning',
      learning_step: 0,
      ease_factor: config.starting_ease,
      review_count: card.review_count + 1
    };
  }

  private static scheduleLearningCard(card: CardState, rating: number, config: DeckConfig): SchedulingResult {
    const now = new Date();
    const currentStep = card.learning_step || 0;
    
    if (rating === 0) { // Failed - restart learning
      return {
        next_due: this.addMinutes(now, config.learning_steps[0]),
        interval: config.learning_steps[0] / (24 * 60),
        card_state: 'learning',
        learning_step: 0,
        ease_factor: card.ease_factor,
        review_count: card.review_count + 1
      };
    }
    
    if (rating === 3) { // Easy - graduate immediately
      return {
        next_due: this.addDays(now, config.easy_interval),
        interval: config.easy_interval,
        card_state: 'review',
        ease_factor: card.ease_factor + config.easy_bonus,
        review_count: card.review_count + 1,
        graduated: true
      };
    }
    
    // Good/Hard - advance step or graduate
    const nextStep = currentStep + 1;
    
    if (nextStep >= config.learning_steps.length) {
      // Graduate to review
      const easeFactor = rating === 1 ? card.ease_factor - config.hard_penalty : card.ease_factor;
      return {
        next_due: this.addDays(now, config.graduating_interval),
        interval: config.graduating_interval,
        card_state: 'review',
        ease_factor: easeFactor,
        review_count: card.review_count + 1,
        graduated: true
      };
    }
    
    // Continue learning
    const nextStepMinutes = config.learning_steps[nextStep];
    const easeFactor = rating === 1 ? card.ease_factor - config.hard_penalty : card.ease_factor;
    
    return {
      next_due: this.addMinutes(now, nextStepMinutes),
      interval: nextStepMinutes / (24 * 60),
      card_state: 'learning',
      learning_step: nextStep,
      ease_factor: easeFactor,
      review_count: card.review_count + 1
    };
  }

  private static scheduleReviewCard(card: CardState, rating: number, config: DeckConfig): SchedulingResult {
    const now = new Date();
    
    if (rating === 0) { // Failed - move to relearning
      const newLapseCount = card.lapse_count + 1;
      const newEaseFactor = Math.max(1.3, card.ease_factor - config.lapse_penalty);
      const becameLeech = newLapseCount >= config.lapse_threshold;
      
      return {
        next_due: this.addMinutes(now, config.relearning_steps[0]),
        interval: config.relearning_steps[0] / (24 * 60),
        card_state: 'relearning',
        learning_step: 0,
        ease_factor: newEaseFactor,
        lapse_count: newLapseCount,
        is_leech: becameLeech,
        review_count: card.review_count + 1,
        lapsed: true,
        became_leech: becameLeech && !card.is_leech
      };
    }
    
    // Apply enhanced SM-2
    const newEaseFactor = this.updateEaseFactor(card.ease_factor, rating, config);
    const newInterval = this.calculateReviewInterval(card.interval, newEaseFactor, rating, config);
    
    return {
      next_due: this.addDays(now, Math.min(newInterval, config.maximum_interval)),
      interval: newInterval,
      card_state: 'review',
      ease_factor: newEaseFactor,
      review_count: card.review_count + 1
    };
  }

  private static scheduleRelearningCard(card: CardState, rating: number, config: DeckConfig): SchedulingResult {
    const now = new Date();
    const currentStep = card.learning_step || 0;
    
    if (rating === 0) { // Failed - restart relearning
      const newLapseCount = card.lapse_count + 1;
      const becameLeech = newLapseCount >= config.lapse_threshold;
      
      return {
        next_due: this.addMinutes(now, config.relearning_steps[0]),
        interval: config.relearning_steps[0] / (24 * 60),
        card_state: 'relearning',
        learning_step: 0,
        ease_factor: Math.max(1.3, card.ease_factor - config.lapse_penalty),
        lapse_count: newLapseCount,
        is_leech: becameLeech,
        review_count: card.review_count + 1,
        became_leech: becameLeech && !card.is_leech
      };
    }
    
    if (rating === 3) { // Easy - graduate back to review
      const graduationInterval = Math.max(1, Math.round(card.interval * 0.5));
      return {
        next_due: this.addDays(now, graduationInterval),
        interval: graduationInterval,
        card_state: 'review',
        ease_factor: card.ease_factor + config.easy_bonus,
        review_count: card.review_count + 1,
        graduated: true
      };
    }
    
    // Good/Hard - advance relearning step or graduate
    const nextStep = currentStep + 1;
    
    if (nextStep >= config.relearning_steps.length) {
      // Graduate back to review with reduced interval
      const graduationInterval = Math.max(1, Math.round(card.interval * 0.25));
      const easeFactor = rating === 1 ? card.ease_factor - config.hard_penalty : card.ease_factor;
      
      return {
        next_due: this.addDays(now, graduationInterval),
        interval: graduationInterval,
        card_state: 'review',
        ease_factor: easeFactor,
        review_count: card.review_count + 1,
        graduated: true
      };
    }
    
    // Continue relearning
    const nextStepMinutes = config.relearning_steps[nextStep];
    const easeFactor = rating === 1 ? card.ease_factor - config.hard_penalty : card.ease_factor;
    
    return {
      next_due: this.addMinutes(now, nextStepMinutes),
      interval: nextStepMinutes / (24 * 60),
      card_state: 'relearning',
      learning_step: nextStep,
      ease_factor: easeFactor,
      review_count: card.review_count + 1
    };
  }

  private static updateEaseFactor(currentEase: number, rating: number, config: DeckConfig): number {
    let newEase = currentEase;
    
    switch (rating) {
      case 1: // Hard
        newEase = Math.max(1.3, currentEase - config.hard_penalty);
        break;
      case 2: // Good
        newEase = currentEase + 0.1;
        break;
      case 3: // Easy
        newEase = currentEase + config.easy_bonus;
        break;
    }
    
    return Math.round(newEase * 100) / 100;
  }

  private static calculateReviewInterval(currentInterval: number, easeFactor: number, rating: number, config: DeckConfig): number {
    let newInterval: number;
    
    switch (rating) {
      case 1: // Hard
        newInterval = Math.max(1, Math.round(currentInterval * 1.2));
        break;
      case 2: // Good
        newInterval = Math.round(currentInterval * easeFactor);
        break;
      case 3: // Easy
        newInterval = Math.round(currentInterval * easeFactor * 1.3);
        break;
      default:
        newInterval = Math.round(currentInterval * easeFactor);
    }
    
    return Math.min(newInterval, config.maximum_interval);
  }

  private static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// ========================================
// MAIN EDGE FUNCTION
// ========================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { card_id, rating, time_taken, response_time_ms, hesitation_time_ms } = await req.json();
    
    if (!card_id || rating === undefined) {
      throw new Error("Missing 'card_id' or 'rating'");
    }

    if (rating < 0 || rating > 3) {
      throw new Error("Rating must be between 0 and 3");
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Fetch current card state
    const { data: card, error: fetchErr } = await supabase
      .from("cards")
      .select(`
        id, card_state, learning_step, lapse_count, ease_factor, 
        interval, review_count, last_studied, next_due, is_leech, deck_id
      `)
      .eq("id", card_id)
      .single();

    if (fetchErr || !card) {
      throw new Error(fetchErr?.message || "Card not found");
    }

    // Get deck configuration
    const { data: deckConfig, error: configErr } = await supabase
      .rpc('get_deck_config', { p_deck_id: card.deck_id });

    if (configErr) {
      throw new Error(`Failed to get deck config: ${configErr.message}`);
    }

    // Convert database format to internal format
    const cardState: CardState = {
      id: card.id,
      card_state: card.card_state || 'new',
      learning_step: card.learning_step || 0,
      lapse_count: card.lapse_count || 0,
      ease_factor: card.ease_factor || 2.5,
      interval: card.interval || 1,
      review_count: card.review_count || 0,
      last_studied: card.last_studied,
      next_due: card.next_due,
      is_leech: card.is_leech || false
    };

    // Schedule next review using advanced SRS
    const result = AdvancedSRSEngine.scheduleCard(cardState, rating, deckConfig);

    // Insert review record with enhanced data
    const { error: reviewInsertErr } = await supabase
      .from("reviews")
      .insert({
        card_id,
        rating,
        time_taken: time_taken || 0,
        response_time_ms: response_time_ms,
        hesitation_time_ms: hesitation_time_ms,
        card_difficulty: cardState.lapse_count, // Store current difficulty
        interval_before: cardState.interval
      });

    if (reviewInsertErr) {
      throw new Error(`Failed to insert review: ${reviewInsertErr.message}`);
    }

    // Update card with new scheduling information
    const updateData: any = {
      card_state: result.card_state,
      ease_factor: result.ease_factor,
      // Ensure we store a whole-day integer to satisfy the integer column type
      interval: Math.max(0, Math.round(result.interval)),
      next_due: result.next_due.toISOString(),
      review_count: result.review_count,
      last_studied: new Date().toISOString(),
    };

    // Add conditional fields
    if (result.learning_step !== undefined) {
      updateData.learning_step = result.learning_step;
    }
    if (result.lapse_count !== undefined) {
      updateData.lapse_count = result.lapse_count;
    }
    if (result.is_leech !== undefined) {
      updateData.is_leech = result.is_leech;
    }

    const { error: updateErr } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", card_id);

    if (updateErr) {
      throw new Error(`Failed to update card: ${updateErr.message}`);
    }

    // Return response with transition information
    return new Response(
      JSON.stringify({
        success: true,
        card: {
          id: card_id,
          nextDue: result.next_due.toISOString(),
          interval: result.interval,
          easeFactor: result.ease_factor,
          cardState: result.card_state,
          learningStep: result.learning_step,
          lapseCount: result.lapse_count || cardState.lapse_count,
          isLeech: result.is_leech || cardState.is_leech
        },
        transitions: {
          graduated: result.graduated || false,
          lapsed: result.lapsed || false,
          becameLeech: result.became_leech || false
        }
      }),
      { 
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        } 
      }
    );

  } catch (err) {
    console.error("Advanced review submission error:", err);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: String(err) 
      }), 
      {
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
        status: 400,
      }
    );
  }
});