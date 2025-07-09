import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  EnhancedCard, 
  DeckConfig, 
  CardState, 
  StudyQueueCard, 
  AdvancedReviewResponse,
  StudyQueueResponse,
  DEFAULT_DECK_CONFIG 
} from '../types/SRSTypes';
import { AdvancedSRSEngine } from '../lib/advancedSRS';
import { parseApkg, type ParsedDeck } from '../lib/ankiParser';
import { useUser } from './UserContext';

export type EmojiRating = '😞' | '😐' | '😊' | '😁';

// Add new interface for study calendar data
export interface StudyCalendarDay {
  date: string; // YYYY-MM-DD format
  cardsStudied: number;
  studySessions: number;
  totalTimeMinutes: number;
  avgRetention: number;
  studied: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  lastStudyDate: string | null;
}

// Legacy Card interface for backward compatibility
interface Card {
  id: string;
  type: string;
  front: string;
  back: string;
  deckId: string;
  tags: string[];
  difficulty: number;
  lastStudied: string | null;
  nextDue: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  image?: string;
  hint?: string;
}

// Enhanced interfaces for advanced SRS
interface EnhancedDeck extends Deck {
  learningCount: number;
  relearningCount: number;
  leechCount: number;
  config?: DeckConfig;
}

interface Deck {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  dueCount: number;
  newCount: number;
  color: string;
  emoji: string;
  created: string;
  lastStudied: string | null;
}

interface StudyStats {
  totalCards: number;
  studiedToday: number;
  emojiBreakdown: {
    '😞': number;
    '😐': number;
    '😊': number;
    '😁': number;
  };
  weeklyStats: {
    date: string;
    cards: number;
    positivityRate: number;
  }[];
  streakDays: number;
  currentStreak: number;
  longestStreak: number;
}

export interface ImportResult {
  success: boolean;
  totalCards: number;
  decksCreated: number;
  deckNames: string[];
  errors: string[];
}

interface StudyContextType {
  decks: Deck[];
  currentDeck: Deck | null;
  currentCard: Card | null;
  studyStats: StudyStats;
  setCurrentDeck: (deck: Deck) => void;
  setCurrentCard: (card: Card) => void;
  
  // Legacy methods (maintained for compatibility)
  rateCard: (cardId: string, rating: EmojiRating) => void;
  getDueCards: (deckId: string, limit?: number) => Promise<Card[]>;
  getStudyQueue: () => Promise<Card[]>;
  
  // Enhanced SRS methods
  rateAdvancedCard: (cardId: string, rating: EmojiRating, responseTime?: number, hesitationTime?: number) => Promise<AdvancedReviewResponse>;
  getAdvancedStudyQueue: (deckId: string, newLimit?: number, totalLimit?: number) => Promise<StudyQueueResponse>;
  getDeckConfig: (deckId: string) => Promise<DeckConfig>;
  updateDeckConfig: (deckId: string, config: Partial<DeckConfig>) => Promise<void>;
  getEnhancedDeckStats: (deckId: string) => Promise<EnhancedDeck>;
  
  addDeck: (deck: Omit<Deck, 'id'>) => Promise<Deck>;
  addCard: (card: Omit<Card, 'id' | 'type'> & { type?: string }) => void;
  importDeck: (files: File[]) => Promise<ImportResult>;
  updateStudyStats: (rating: EmojiRating) => void;
  removeDeck: (deckId: string) => void;
  
  // Anti-burnout and workload balancing
  getCardsStudiedToday: () => Promise<number>;
  getWorkloadRecommendation: () => Promise<{ recommendedCards: number; shouldStudy: boolean; reason: string; }>;
  checkBurnoutRisk: () => Promise<{ riskLevel: 'low' | 'medium' | 'high'; recommendations: string[]; }>;
  
  // Study calendar and streak methods (NEW)
  getStudyCalendarData: (daysBack?: number) => Promise<StudyCalendarDay[]>;
  getStreakInfo: () => Promise<StreakInfo>;
  refreshStreakData: () => Promise<void>;
  refreshDecks: () => Promise<void>;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export const useStudy = () => {
  const context = useContext(StudyContext);
  if (context === undefined) {
    throw new Error('useStudy must be used within a StudyProvider');
  }
  return context;
};

export const StudyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const userContext = useUser();
  const user = userContext?.user;

  // Load decks from Supabase
  const loadDecks = async () => {
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('id,name,description,created_at');

      if (!error && data) {
        const mapped: Deck[] = await Promise.all(
          data.map(async (d: any) => {
            // total cards
            const { count: cardCount } = await supabase
              .from('cards')
              .select('id', { count: 'exact', head: true })
              .eq('deck_id', d.id);

            // due today or earlier
            const { count: dueCount } = await supabase
              .from('cards')
              .select('id', { count: 'exact', head: true })
              .eq('deck_id', d.id)
              .lte('next_due', new Date().toISOString());

            // new cards (review_count = 0)
            const { count: newCount } = await supabase
              .from('cards')
              .select('id', { count: 'exact', head: true })
              .eq('deck_id', d.id)
              .eq('review_count', 0);

            return {
              id: d.id,
              name: d.name,
              description: d.description ?? '',
              cardCount: cardCount ?? 0,
              dueCount: dueCount ?? 0,
              newCount: newCount ?? 0,
              color: 'bg-blue-100',
              emoji: '📚',
              created: d.created_at,
              lastStudied: null,
            } as Deck;
          })
        );

        setDecks(mapped);
        console.log('Loaded decks:', mapped);
      }
    } catch (error) {
      console.error('Error loading decks:', error);
    }
  };

  // Load decks from Supabase on mount
  useEffect(() => {
    loadDecks();
  }, []);

  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [studyStats, setStudyStats] = useState<StudyStats>({
    totalCards: 0,
    studiedToday: 0,
    emojiBreakdown: { '😞': 0, '😐': 0, '😊': 0, '😁': 0 },
    weeklyStats: [],
    streakDays: 0,
    currentStreak: 0,
    longestStreak: 0,
  });

  // Load real-time statistics whenever decks or user change
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      // ------------- Total cards -------------
      const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0);

      // ------------- Cards studied today & emoji breakdown -------------
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const { data: reviewsToday } = await supabase
        .from('reviews')
        .select('rating')
        .eq('owner_id', user.id)
        .gte('reviewed_at', todayStart.toISOString())
        .lt('reviewed_at', tomorrowStart.toISOString());

      const emojiMap: { '😞': number; '😐': number; '😊': number; '😁': number } = {
        '😞': 0, '😐': 0, '😊': 0, '😁': 0,
      };
      (reviewsToday ?? []).forEach(r => {
        const emoji = (['😞', '😐', '😊', '😁'][(r as any).rating] ?? '😞') as keyof typeof emojiMap;
        emojiMap[emoji] += 1;
      });

      // ------------- Weekly stats (last 7 days) -------------
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);

      const { data: recentLogs } = await supabase
        .from('study_logs')
        .select('session_date,cards_studied,avg_response_time_ms,rating')
        .eq('user_id', user.id)
        .gte('session_date', weekAgo.toISOString());

      const weekStatsMap: { [date: string]: { cards: number; positives: number; total: number } } = {};
      (recentLogs ?? []).forEach(log => {
        const day = new Date(log.session_date).toLocaleDateString('en-CA');
        if (!weekStatsMap[day]) weekStatsMap[day] = { cards: 0, positives: 0, total: 0 };
        weekStatsMap[day].cards += log.cards_studied ?? 0;
        weekStatsMap[day].total += 1;
        if ((log.rating ?? 0) >= 2) weekStatsMap[day].positives += 1;
      });

      const weeklyStats = Object.entries(weekStatsMap).map(([date, vals]) => ({
        date,
        cards: vals.cards,
        positivityRate: vals.total ? Math.round((vals.positives / vals.total) * 100) : 0,
      })).sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());

      // ------------- Streak info -------------
      const streak = await getStreakInfo();

      setStudyStats({
        totalCards,
        studiedToday: reviewsToday?.length ?? 0,
        emojiBreakdown: emojiMap,
        weeklyStats,
        streakDays: streak.currentStreak,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
      });
    };

    loadStats();
  }, [user, decks]);

  const rateCard = async (cardId: string, rating: EmojiRating) => {
    const ratingMap: Record<EmojiRating, number> = { '😞': 0, '😐': 1, '😊': 2, '😁': 3 };
    await supabase.functions.invoke('submit_review', {
      body: {
        card_id: cardId,
        rating: ratingMap[rating],
        time_taken: 0,
      },
    });

    updateStudyStats(rating);
  };

  const addDeck = async (deckData: Omit<Deck, 'id'>): Promise<Deck> => {
    // Ensure the new deck row is associated with the currently authenticated user so that
    // it passes the RLS policy which requires `user_id = auth.uid()`.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('Unable to fetch auth session:', sessionError);
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('decks')
      .insert({
        owner_id: session.user.id,
        name: deckData.name,
        description: deckData.description,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new Error('Failed to create deck');
    }

    const newDeck: Deck = {
      ...deckData,
      id: data.id,
    };
    setDecks(prev => [...prev, newDeck]);
    return newDeck;
  };

  const addCard = async (cardData: Omit<Card, 'id' | 'type'> & { type?: string }) => {
    const { data, error } = await supabase
      .from('cards')
      .insert({
        deck_id: cardData.deckId,
        type: cardData.type ?? 'basic',
        front: cardData.front,
        back: cardData.back,
      })
      .select()
      .single();

    if (error) {
      console.error('Card save failed:', error);
      throw new Error(`Failed to save card: ${error.message}`);
    }

    const newCard: Card = {
      ...cardData,
      id: data.id,
      difficulty: 0,
      lastStudied: null,
      nextDue: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
      type: cardData.type ?? 'basic',
    };

    setDecks(prev =>
      prev.map(deck =>
        deck.id === cardData.deckId
          ? { ...deck, cardCount: deck.cardCount + 1, newCount: deck.newCount + 1 }
          : deck
      )
    );
  };

  const importDeck = async (files: File[]): Promise<ImportResult> => {
    try {
      // Check authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Please log in to import decks');
      }

      let totalCards = 0;
      const createdDecks: string[] = [];
      const errors: string[] = [];
      const newDecks: Deck[] = [];
      
      // Process each file
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        
        try {
          // Parse the .apkg file
          const parsedDecks = await parseApkg(file);

          // Create decks in Supabase
          for (const deck of parsedDecks) {
            if (deck.cards.length === 0) {
              errors.push(`Deck "${deck.name}" has no cards, skipping`);
              continue;
            }

            // Create deck
            const { data: newDeck, error: deckError } = await supabase
              .from('decks')
              .insert({
                owner_id: session.user.id,
                name: deck.name || `Imported Deck ${fileIndex + 1}`,
                description: `Imported from ${file.name}`,
              })
              .select()
              .single();

            if (deckError) {
              throw new Error(`Failed to create deck "${deck.name}": ${deckError.message}`);
            }

            const deckId = newDeck.id;
            createdDecks.push(deck.name);

            // Insert cards in batches to avoid timeout
            const batchSize = 500;
            for (let i = 0; i < deck.cards.length; i += batchSize) {
              const batch = deck.cards.slice(i, i + batchSize);
              const cardRows = batch.map((card) => ({
                deck_id: deckId,
                type: 'basic',
                front: card.front || 'No front content',
                back: card.back || 'No back content',
                tags: [],
                difficulty: 0,
                last_studied: null,
                next_due: new Date().toISOString(),
                interval: 1,
                ease_factor: 2.5,
                review_count: 0,
              }));

              const { error: cardsError } = await supabase
                .from('cards')
                .insert(cardRows);

              if (cardsError) {
                throw new Error(`Failed to insert cards for deck "${deck.name}": ${cardsError.message}`);
              }
            }

            totalCards += deck.cards.length;

            // Note: Card counts are computed dynamically in loadDecks(), no need to store them
            // Create local deck object for state update
            const localDeck: Deck = {
              id: deckId,
              name: deck.name || `Imported Deck ${fileIndex + 1}`,
              description: `Imported from ${file.name}`,
              cardCount: deck.cards.length,
              dueCount: 0,
              newCount: deck.cards.length,
              color: 'bg-green-100',
              emoji: '📚',
              created: new Date().toISOString(),
              lastStudied: null,
            };
            newDecks.push(localDeck);
          }
        } catch (fileError) {
          errors.push(`${file.name}: ${(fileError as Error).message}`);
        }
      }

      // Update local state with new decks
      setDecks(prev => [...prev, ...newDecks]);

      // Return results
      const success = createdDecks.length > 0;
      return {
        success,
        totalCards,
        decksCreated: createdDecks.length,
        deckNames: createdDecks,
        errors,
      };

    } catch (error) {
      return {
        success: false,
        totalCards: 0,
        decksCreated: 0,
        deckNames: [],
        errors: [(error as Error).message],
      };
    }
  };

  const getDueCards = async (deckId: string, limit = 30): Promise<Card[]> => {
    const { data, error } = await supabase.rpc('get_due_cards', {
      p_deck: deckId,
      p_limit: limit,
    });
    if (error) {
      console.error(error);
      return [];
    }
    return (data as any[]) as Card[];
  };

  const getStudyQueue = async (): Promise<Card[]> => {
    if (!currentDeck) return [];
    return getDueCards(currentDeck.id, 50);
  };

  const updateStudyStats = (rating: EmojiRating) => {
    setStudyStats(prev => ({
      ...prev,
      studiedToday: prev.studiedToday + 1,
      emojiBreakdown: {
        ...prev.emojiBreakdown,
        [rating]: prev.emojiBreakdown[rating] + 1,
      },
    }));
  };

  const removeDeck = (id: string) => {
    setDecks(prev => prev.filter(d => d.id !== id));
  };

  // Anti-burnout workload balancing functions
  const getCardsStudiedToday = async (): Promise<number> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const { count } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', session.user.id)
        .gte('reviewed_at', todayStart.toISOString())
        .lt('reviewed_at', tomorrowStart.toISOString());

      return count || 0;
    } catch (error) {
      console.error('Error getting cards studied today:', error);
      return 0;
    }
  };

  const getWorkloadRecommendation = async () => {
    const cardsToday = await getCardsStudiedToday();
    const maxDailyCards = user?.preferences?.maxDailyCards || 200;
    const optimalDailyCards = Math.floor(maxDailyCards * 0.5); // 50% of max as optimal
    
    let recommendedCards = user?.preferences?.newCardsPerDay || 20;
    let shouldStudy = true;
    let reason = 'Good time to study!';

    if (cardsToday >= maxDailyCards) {
      shouldStudy = false;
      recommendedCards = 0;
      reason = 'Daily limit reached. Time to rest and consolidate learning.';
    } else if (cardsToday >= optimalDailyCards) {
      recommendedCards = Math.min(10, maxDailyCards - cardsToday);
      reason = 'Approaching daily optimal. Light session recommended.';
    } else if (cardsToday >= optimalDailyCards * 0.8) {
      recommendedCards = Math.min(15, maxDailyCards - cardsToday);
      reason = 'Good progress today. Moderate session recommended.';
    } else {
      recommendedCards = Math.min(25, maxDailyCards - cardsToday);
      reason = 'Great time for focused learning!';
    }

    return { recommendedCards, shouldStudy, reason };
  };

  const checkBurnoutRisk = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return { riskLevel: 'low' as const, recommendations: ['Please log in to track burnout risk'] };
      }

      // Analyze last 7 days of study logs
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: recentLogs } = await supabase
        .from('study_logs')
        .select('cards_studied,time_taken_ms,rating,session_date,fatigue_score,avg_response_time_ms,performance_trend')
        .eq('user_id', session.user.id)
        .gte('session_date', weekAgo.toISOString())
        .order('session_date', { ascending: false });

      if (!recentLogs || recentLogs.length < 3) {
        return { 
          riskLevel: 'low' as const, 
          recommendations: ['Keep building consistent study habits'] 
        };
      }

      // Calculate retention rate from ratings (rating >= 2 is considered successful)
      const calculateRetention = (logs: any[]) => {
        if (logs.length === 0) return 0;
        const successfulReviews = logs.filter(log => log.rating >= 2).length;
        return (successfulReviews / logs.length) * 100;
      };

      // Calculate burnout indicators
      const avgRetention = calculateRetention(recentLogs);
      const recentRetention = calculateRetention(recentLogs.slice(0, 3));
      const retentionDecline = avgRetention - recentRetention;
      
      const dailyCardCounts = recentLogs.map(log => log.cards_studied || 0);
      const avgCards = dailyCardCounts.reduce((sum, count) => sum + count, 0) / dailyCardCounts.length;
      const isOverstudying = avgCards > 150;
      
      // Analyze fatigue scores 
      const fatigueScores = recentLogs
        .map(log => log.fatigue_score)
        .filter(score => score !== null && score !== undefined) as number[];
      const avgFatigue = fatigueScores.length > 0 
        ? fatigueScores.reduce((sum, score) => sum + score, 0) / fatigueScores.length 
        : 0;

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      const recommendations: string[] = [];

      if (retentionDecline > 15 || avgFatigue > 70 || isOverstudying) {
        riskLevel = 'high';
        recommendations.push('Take a rest day to recover');
        recommendations.push('Reduce daily study load by 50%');
        recommendations.push('Focus on review rather than new cards');
      } else if (retentionDecline > 8 || avgFatigue > 50 || avgCards > 120) {
        riskLevel = 'medium';
        recommendations.push('Consider shorter study sessions');
        recommendations.push('Take more frequent breaks');
        recommendations.push('Vary your study content');
      } else {
        recommendations.push('Great job maintaining healthy study habits!');
        recommendations.push('Continue with current study pattern');
      }

      return { riskLevel, recommendations };
    } catch (error) {
      console.error('Error checking burnout risk:', error);
      return { 
        riskLevel: 'low' as const, 
        recommendations: ['Unable to assess burnout risk'] 
      };
    }
  };

  // ========================================
  // ENHANCED SRS METHODS
  // ========================================

  const rateAdvancedCard = async (
    cardId: string, 
    rating: EmojiRating, 
    responseTime?: number, 
    hesitationTime?: number
  ): Promise<AdvancedReviewResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('submit_advanced_review', {
        body: {
          card_id: cardId,
          rating: { '😞': 0, '😐': 1, '😊': 2, '😁': 3 }[rating],
          time_taken: responseTime ? Math.round(responseTime / 1000) : 0,
          response_time_ms: responseTime,
          hesitation_time_ms: hesitationTime,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to submit review');
      }

      // Update local state if successful
      updateStudyStats(rating);
      
      return data as AdvancedReviewResponse;
    } catch (error) {
      console.error('Error submitting advanced review:', error);
      throw error;
    }
  };

  const getAdvancedStudyQueue = async (
    deckId: string, 
    newLimit: number = user?.preferences?.newCardsPerDay || 20, 
    totalLimit: number = user?.preferences?.maxDailyCards || 200
  ): Promise<StudyQueueResponse> => {
    try {
      console.log('Calling get_advanced_study_queue with:', { deckId, newLimit, totalLimit });
      
      const { data, error } = await supabase.rpc('get_advanced_study_queue', {
        p_deck_id: deckId,
        p_new_limit: newLimit,
        p_total_limit: totalLimit,
      });

      console.log('get_advanced_study_queue response:', { data, error });

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to get study queue');
      }

      if (!data || !Array.isArray(data)) {
        console.warn('No data returned from get_advanced_study_queue');
        return {
          success: true,
          cards: [],
          metadata: {
            totalAvailable: 0,
            newCardsRemaining: 0,
            dueReviews: 0,
            learningCards: 0,
            relearningCards: 0
          }
        };
      }

      // Transform database response to StudyQueueCard format with safe handling
      // Note: Function now returns result_* column names to avoid conflicts
      const cards: StudyQueueCard[] = data.map((card: any) => {
        try {
          const baseCard = {
            id: card.result_card_id || card.card_id || card.id,
            deckId: deckId,
            type: card.result_card_type || card.card_type || card.type || 'basic',
            front: card.result_front || card.front || '',
            back: card.result_back || card.back || '',
            tags: card.tags || [],
            difficulty: card.difficulty || 0,
            created: card.created_at || new Date().toISOString(),
            cardState: (card.result_card_state || card.card_state as CardState) || CardState.NEW,
            learningStep: card.result_learning_step || card.learning_step || 0,
            lapseCount: card.result_lapse_count || card.lapse_count || 0,
            isLeech: card.result_is_leech || card.is_leech || false,
            lastStudied: card.last_studied || null,
            nextDue: card.result_next_due || card.next_due || new Date().toISOString(),
            interval: card.result_interval_days || card.interval_days || card.interval || 1,
            easeFactor: card.result_ease_factor || card.ease_factor || 2.5,
            reviewCount: card.review_count || 0,
            priority: card.result_priority || card.priority || 5
          };

          // Handle special card types that store data in JSON format
          if (baseCard.type === 'multiple-choice') {
            try {
              const mcData = JSON.parse(baseCard.back);
              return {
                ...baseCard,
                question: baseCard.front,
                options: mcData.options || [],
                correctAnswer: mcData.correctAnswer || 0,
                explanation: mcData.explanation || ''
              };
            } catch (jsonError) {
              console.warn('Failed to parse multiple choice data:', jsonError);
              // Fall back to basic card if parsing fails
              return { ...baseCard, type: 'basic' };
            }
          } else if (baseCard.type === 'type-in') {
            try {
              const typeInData = JSON.parse(baseCard.back);
              return {
                ...baseCard,
                question: baseCard.front,
                answer: typeInData.answer || '',
                acceptableAnswers: typeInData.acceptableAnswers || [],
                caseSensitive: typeInData.caseSensitive || false
              };
            } catch (jsonError) {
              console.warn('Failed to parse type-in data:', jsonError);
              // Fall back to basic card if parsing fails
              return { ...baseCard, type: 'basic' };
            }
          } else if (baseCard.type === 'cloze') {
            return {
              ...baseCard,
              text: baseCard.front,
              clozes: [{ id: '1', answer: 'cloze', hint: '' }] // Basic cloze structure
            };
          }

          return baseCard;
        } catch (cardError) {
          console.error('Error transforming card:', card, cardError);
          // Return a basic card structure to prevent crashes
          return {
            id: card.result_card_id || card.card_id || card.id || 'unknown',
            deckId: deckId,
            type: 'basic',
            front: card.result_front || card.front || 'Error loading card',
            back: card.result_back || card.back || 'Error loading card',
            tags: [],
            difficulty: 0,
            created: new Date().toISOString(),
            cardState: CardState.NEW,
            learningStep: 0,
            lapseCount: 0,
            isLeech: false,
            lastStudied: null,
            nextDue: new Date().toISOString(),
            interval: 1,
            easeFactor: 2.5,
            reviewCount: 0,
            priority: 5
          };
        }
      }).filter(card => card.id !== 'unknown'); // Remove failed transformations

      // Calculate metadata
      const newCards = cards.filter(c => c.cardState === CardState.NEW).length;
      const learningCards = cards.filter(c => c.cardState === CardState.LEARNING).length;
      const reviewCards = cards.filter(c => c.cardState === CardState.REVIEW).length;
      const relearningCards = cards.filter(c => c.cardState === CardState.RELEARNING).length;

      return {
        success: true,
        cards,
        metadata: {
          totalAvailable: cards.length,
          newCardsRemaining: Math.max(0, newLimit - newCards),
          dueReviews: reviewCards,
          learningCards,
          relearningCards
        }
      };
    } catch (error) {
      console.error('Error getting advanced study queue:', error);
      return {
        success: false,
        cards: [],
        metadata: {
          totalAvailable: 0,
          newCardsRemaining: 0,
          dueReviews: 0,
          learningCards: 0,
          relearningCards: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const getDeckConfig = async (deckId: string): Promise<DeckConfig> => {
    try {
      console.log('Getting deck config for:', deckId);
      
      const { data, error } = await supabase.rpc('get_deck_config', {
        p_deck_id: deckId,
      });

      console.log('get_deck_config response:', { data, error });

      if (error) {
        console.error('Deck config error:', error);
        
        // If it's a duplicate key error, try to get existing config directly
        if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          console.log('Duplicate key error, trying direct query...');
          const { data: directData, error: directError } = await supabase
            .from('deck_configs')
            .select('*')
            .eq('deck_id', deckId)
            .limit(1)
            .single();
            
          if (!directError && directData) {
            console.log('Got config via direct query:', directData);
            return {
              id: directData.id,
              deckId: directData.deck_id,
              learningSteps: directData.learning_steps || [1, 10],
              graduatingInterval: directData.graduating_interval || 1,
              easyInterval: directData.easy_interval || 4,
              relearningSteps: directData.relearning_steps || [10],
              newCardsPerDay: directData.new_cards_per_day || 20,
              maximumInterval: directData.maximum_interval || 36500,
              startingEase: directData.starting_ease || 2.5,
              easyBonus: directData.easy_bonus || 0.15,
              hardPenalty: directData.hard_penalty || 0.15,
              lapsePenalty: directData.lapse_penalty || 0.2,
              lapseThreshold: directData.lapse_threshold || 8,
              createdAt: directData.created_at,
              updatedAt: directData.updated_at
            };
          }
        }
        
        throw new Error(error.message || 'Failed to get deck config');
      }

      if (!data) {
        console.warn('No deck config data returned');
        throw new Error('No deck config returned');
      }

      // Transform database response to DeckConfig format
      const config = {
        id: data.id || '',
        deckId: data.deck_id || deckId,
        learningSteps: data.learning_steps || [1, 10],
        graduatingInterval: data.graduating_interval || 1,
        easyInterval: data.easy_interval || 4,
        relearningSteps: data.relearning_steps || [10],
        newCardsPerDay: data.new_cards_per_day || 20,
        maximumInterval: data.maximum_interval || 36500,
        startingEase: data.starting_ease || 2.5,
        easyBonus: data.easy_bonus || 0.15,
        hardPenalty: data.hard_penalty || 0.15,
        lapsePenalty: data.lapse_penalty || 0.2,
        lapseThreshold: data.lapse_threshold || 8,
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString()
      };
      
      console.log('Transformed config:', config);
      return config;
    } catch (error) {
      console.error('Error getting deck config:', error);
      // Return default config if fetch fails
      const defaultConfig = {
        ...DEFAULT_DECK_CONFIG,
        id: '',
        deckId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      console.log('Returning default config:', defaultConfig);
      return defaultConfig;
    }
  };

  const updateDeckConfig = async (deckId: string, config: Partial<DeckConfig>): Promise<void> => {
    try {
      const { error } = await supabase
        .from('deck_configs')
        .upsert({
          deck_id: deckId,
          learning_steps: config.learningSteps,
          graduating_interval: config.graduatingInterval,
          easy_interval: config.easyInterval,
          relearning_steps: config.relearningSteps,
          new_cards_per_day: config.newCardsPerDay,
          maximum_interval: config.maximumInterval,
          starting_ease: config.startingEase,
          easy_bonus: config.easyBonus,
          hard_penalty: config.hardPenalty,
          lapse_penalty: config.lapsePenalty,
          lapse_threshold: config.lapseThreshold,
          updated_at: new Date().toISOString()
        })
        .eq('deck_id', deckId);

      if (error) {
        throw new Error(error.message || 'Failed to update deck config');
      }
    } catch (error) {
      console.error('Error updating deck config:', error);
      throw error;
    }
  };

  const getEnhancedDeckStats = async (deckId: string): Promise<EnhancedDeck> => {
    try {
      // Get basic deck info
      const deck = decks.find(d => d.id === deckId);
      if (!deck) {
        throw new Error('Deck not found');
      }

      // Get enhanced statistics from deck_stats view
      const { data: stats, error } = await supabase
        .from('deck_stats')
        .select('*')
        .eq('deck_id', deckId)
        .single();

      if (error) {
        console.error('Error getting deck stats:', error);
        // Fallback to basic stats
        return {
          ...deck,
          learningCount: 0,
          relearningCount: 0,
          leechCount: 0
        };
      }

      return {
        ...deck,
        cardCount: stats.total_cards || 0,
        newCount: stats.new_cards || 0,
        dueCount: stats.due_reviews || 0,
        learningCount: stats.learning_cards || 0,
        relearningCount: stats.relearning_cards || 0,
        leechCount: stats.leech_cards || 0
      };
    } catch (error) {
      console.error('Error getting enhanced deck stats:', error);
      const deck = decks.find(d => d.id === deckId);
      return deck ? {
        ...deck,
        learningCount: 0,
        relearningCount: 0,
        leechCount: 0
      } : {
        id: deckId,
        name: 'Unknown Deck',
        description: '',
        cardCount: 0,
        dueCount: 0,
        newCount: 0,
        learningCount: 0,
        relearningCount: 0,
        leechCount: 0,
        color: 'bg-gray-100',
        emoji: '📚',
        created: new Date().toISOString(),
        lastStudied: null
      };
    }
  };

  // ---------------------------------------------------
  // DAILY STREAK CALCULATION (REAL DATA, NOT MOCK)
  // ---------------------------------------------------
  /**
   * Fetch the user's current consecutive-day study streak from the
   * reviews table. Looks back 120 days to keep the query light.
   * Updates studyStats.currentStreak & streakDays in state.
   */
  const fetchCurrentStreak = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return 0;

      // Look back four months – more than enough for streaks we celebrate
      const since = new Date();
      since.setDate(since.getDate() - 120);

      const { data, error } = await supabase
        .from('reviews')
        .select('reviewed_at')
        .gte('reviewed_at', since.toISOString());

      if (error) {
        console.error('Error fetching reviews for streak:', error);
        return 0;
      }

      const daysSet = new Set<string>(
        (data as any[]).map(r => new Date(r.reviewed_at).toDateString())
      );

      let streak = 0;
      for (let i = 0; ; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (daysSet.has(d.toDateString())) {
          streak++;
        } else {
          break;
        }
      }

      setStudyStats(prev => ({
        ...prev,
        currentStreak: streak,
        streakDays: streak,
        longestStreak: Math.max(prev.longestStreak, streak),
      }));

      return streak;
    } catch (err) {
      console.error('Unexpected error calculating streak:', err);
      return 0;
    }
  };

  // Recalculate streak once on mount and after auth/session changes
  useEffect(() => {
    fetchCurrentStreak();
  }, []);

  // ========================================
  // STUDY CALENDAR AND STREAK METHODS (NEW)
  // ========================================
  
  const getStudyCalendarData = async (daysBack: number = 90): Promise<StudyCalendarDay[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('No user session found for calendar data');
        return [];
      }

      const { data, error } = await supabase.rpc('get_study_calendar_data', {
        p_user_id: session.user.id,
      });

      if (error) {
        console.error('Error fetching study calendar data:', error);
        return [];
      }

      console.log('Raw calendar data from DB:', data);
      return (data as any[]).map(row => ({
        date: row.study_date,
        cardsStudied: row.cards_studied,
        studySessions: row.sessions_count,
        totalTimeMinutes: row.total_time_minutes,
        avgRetention: 0, // Will be calculated from other data if needed
        studied: row.cards_studied > 0,
      }));
    } catch (error) {
      console.error('Exception in getStudyCalendarData:', error);
      return [];
    }
  };

  const getStreakInfo = async (): Promise<StreakInfo> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('No user session found for streak info');
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalStudyDays: 0,
          lastStudyDate: null,
        };
      }

      const { data, error } = await supabase.rpc('get_streak_info', { p_user_id: session.user.id });

      if (error) {
        console.error('Error fetching streak info:', error);
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalStudyDays: 0,
          lastStudyDate: null,
        };
      }

      console.log('Raw streak data from DB:', data);
      const result = data[0] || {
        current_streak: 0,
        longest_streak: 0,
        total_study_days: 0,
        last_study_date: null,
      };

      return {
        currentStreak: result.current_streak,
        longestStreak: result.longest_streak,
        totalStudyDays: result.total_study_days,
        lastStudyDate: result.last_study_date,
      };
    } catch (error) {
      console.error('Exception in getStreakInfo:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalStudyDays: 0,
        lastStudyDate: null,
      };
    }
  };

  const refreshStreakData = async (): Promise<void> => {
    try {
      // Refresh both the old streak calculation and new streak info
      await fetchCurrentStreak();
      
      // Also refresh streak info and update studyStats
      const streakInfo = await getStreakInfo();
      setStudyStats(prev => ({
        ...prev,
        currentStreak: streakInfo.currentStreak,
        streakDays: streakInfo.currentStreak,
        longestStreak: streakInfo.longestStreak,
      }));
    } catch (error) {
      console.error('Error refreshing streak data:', error);
    }
  };

  const refreshDecks = async (): Promise<void> => {
    console.log('Refreshing decks...');
    await loadDecks();
  };

  const value: StudyContextType = {
    decks,
    currentDeck,
    currentCard,
    studyStats,
    setCurrentDeck,
    setCurrentCard,
    
    // Legacy methods (maintained for compatibility)
    rateCard,
    getDueCards,
    getStudyQueue,
    
    // Enhanced SRS methods
    rateAdvancedCard,
    getAdvancedStudyQueue,
    getDeckConfig,
    updateDeckConfig,
    getEnhancedDeckStats,
    
    addDeck,
    addCard,
    importDeck,
    updateStudyStats,
    removeDeck,
    
    // Anti-burnout functions
    getCardsStudiedToday,
    getWorkloadRecommendation,
    checkBurnoutRisk,
    
    // Study calendar and streak methods (NEW)
    getStudyCalendarData,
    getStreakInfo,
    refreshStreakData,
    refreshDecks,
  };

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
};