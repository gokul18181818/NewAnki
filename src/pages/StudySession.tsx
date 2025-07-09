import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Settings, SkipBack as Skip, HelpCircle, Flag, Volume2, Eye, EyeOff, Filter, Clock, AlertTriangle, Brain } from 'lucide-react';
import { useStudy, EmojiRating } from '../contexts/StudyContext';
import { useUser } from '../contexts/UserContext';
import CardRenderer from '../components/CardRenderer';
import StudyModeSelector from '../components/StudyModeSelector';
import CardStateIndicator, { LearningProgress, BatchStateIndicator } from '../components/CardStateIndicator';
import { Card, StudyMode } from '../types/CardTypes';
import { StudyQueueCard, DeckConfig, CardState, AdvancedReviewResponse } from '../types/SRSTypes';
import { supabase } from '../lib/supabaseClient';
import { AntiBurnoutEngine } from '../lib/antiBurnoutEngine';
import { ResponseTimeData, SmartBreakSuggestion, FatigueIndicators } from '../types/AntiBurnoutTypes';
import RecoveryProtocol from '../components/RecoveryProtocol';
import { RecoveryProtocol as RecoveryProtocolType } from '../types/AntiBurnoutTypes';
import { AdaptivePersonalizationEngine, PersonalizedRecommendations } from '../lib/adaptivePersonalization';

interface PopupNotification {
  id: string;
  type: 'streak' | 'improvement' | 'break' | 'encouragement' | 'fatigue_warning' | 'smart_break';
  message: string;
  emoji: string;
  duration: number;
  priority?: 'low' | 'medium' | 'high';
  actionable?: boolean;
  actions?: Array<{ label: string; action: () => void; }>;
}

const StudySession: React.FC = () => {
  const navigate = useNavigate();
  const { deckId } = useParams<{ deckId: string }>();
  const { user, isAuthenticated } = useUser();
  const { 
    decks, 
    rateCard, 
    rateAdvancedCard, 
    getAdvancedStudyQueue, 
    getDeckConfig, 
    updateStudyStats, 
    getDueCards,
    studyStats, // access real streak data
  } = useStudy();
  
  const deck = decks.find(d => d.id === deckId);

  // Authentication and loading states
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    cardsStudied: 0,
    streak: 0,
    startTime: new Date(),
    performance: {
      '😞': 0,
      '😐': 0,
      '😊': 0,
      '😁': 0,
    },
  });
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [buriedCards, setBuriedCards] = useState<string[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  
  // Enhanced SRS state
  const [advancedCards, setAdvancedCards] = useState<StudyQueueCard[]>([]);
  const [deckConfig, setDeckConfig] = useState<DeckConfig | null>(null);
  const [useAdvancedSRS, setUseAdvancedSRS] = useState(true);
  const [lastReviewResult, setLastReviewResult] = useState<AdvancedReviewResponse | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Anti-burnout intelligence state  
  const [antiBurnoutEngine, setAntiBurnoutEngine] = useState<AntiBurnoutEngine | null>(null);
  const [cardShownTime, setCardShownTime] = useState<Date | null>(null);
  const [answerShownTime, setAnswerShownTime] = useState<Date | null>(null);
  const [currentFatigueIndicators, setCurrentFatigueIndicators] = useState<FatigueIndicators | null>(null);
  const [lastBreakSuggestion, setLastBreakSuggestion] = useState<SmartBreakSuggestion | null>(null);
  const [breakSuggestionDismissed, setBreakSuggestionDismissed] = useState(false);
  const fatigueCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // NEW — Break tracking & protocol UI state
  const [showRecoveryProtocol, setShowRecoveryProtocol] = useState(false);
  const [currentBreakSuggestion, setCurrentBreakSuggestion] = useState<SmartBreakSuggestion | null>(null);
  const [breakSuggestionsTriggered, setBreakSuggestionsTriggered] = useState(0);
  const [breaksTaken, setBreaksTaken] = useState(0);
  const [preBreakFatigueScore, setPreBreakFatigueScore] = useState(0);
  const breakStartTimeRef = useRef<Date | null>(null);

  // Celebration helpers & state
  // Consecutive correct-answer streak within this session
  const correctStreakRef = useRef<number>(0);
  const lastCorrectStreakPopupRef = useRef<number>(0);

  // Adaptive personalization
  const [personalizationEngine, setPersonalizationEngine] = useState<AdaptivePersonalizationEngine | null>(null);
  const [personalizedRecommendations, setPersonalizedRecommendations] = useState<PersonalizedRecommendations | null>(null);
  
  // Dynamic milestone tracking (replaces static thresholds)
  const [masteredCount, setMasteredCount] = useState<number>(0);
  const nextMilestoneRef = useRef<number>(100); // Will be updated by personalization engine

  // Track which day-streak celebrations we've shown this session
  const shownDayStreakCelebrations = useRef<Set<number>>(new Set());

  // Store previous ratings per card for improvement detection
  const previousRatings = useRef<Record<string, EmojiRating>>({});

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!isAuthenticated || !user) {
          setAuthError('Please log in to study cards');
          navigate('/login');
          return;
        }
        setIsLoadingAuth(false);
      } catch (error) {
        setAuthError('Authentication error');
        console.error('Auth check failed:', error);
      }
    };
    
    checkAuth();
  }, [isAuthenticated, user, navigate]);

  // Initialize personalization engine and anti-burnout engine
  useEffect(() => {
    const initializeEngines = async () => {
      if (!user?.id) return;
      
      try {
        // Initialize personalization engine
        const personEngine = new AdaptivePersonalizationEngine(user.id);
        await personEngine.initializeProfile();
        setPersonalizationEngine(personEngine);
        
        const recommendations = personEngine.getRecommendations();
        setPersonalizedRecommendations(recommendations);
        nextMilestoneRef.current = recommendations.nextMilestone;

        // Initialize anti-burnout engine with adaptive recommendations
        const userPreferences = {
          breakInterval: recommendations.breakInterval,
          breakDuration: recommendations.breakDuration,
          adaptiveBreaks: user.preferences?.adaptiveBreaks ?? true,
          maxDailyCards: user.preferences?.maxDailyCards,
          customSessionLength: recommendations.sessionLengthRecommendation,
          sessionLength: user.preferences?.sessionLength,
        };
        
        const engine = await AntiBurnoutEngine.createForUser(user.id, userPreferences);
        setAntiBurnoutEngine(engine);
      } catch (error) {
        console.error('Failed to initialize engines:', error);
        // Fallback to default engines
        setAntiBurnoutEngine(new AntiBurnoutEngine(user.id));
        
        // Set default recommendations
        setPersonalizedRecommendations({
          nextMilestone: 100,
          celebrationTrigger: 5,
          fatigueWarningThreshold: 65,
          breakInterval: 25,
          breakDuration: 10,
          sessionLengthRecommendation: 25,
          optimalStudyTime: '9:00 AM',
          difficultyAdjustment: 0.7
        });
      }
    };

    initializeEngines();
  }, [user?.id, user?.preferences]);

  // Load real cards from Supabase for this deck (only after authentication)
  useEffect(() => {
    if (isLoadingAuth || authError || !deckId || deckId.length !== 36) return;
    
    const fetchCards = async () => {
      setIsLoadingCards(true);
      try {
        // Load deck configuration
        const config = await getDeckConfig(deckId);
        setDeckConfig(config);

        if (useAdvancedSRS) {
          // Use advanced SRS study queue
          const response = await getAdvancedStudyQueue(deckId, config.newCardsPerDay, 50);
          if (response.success) {
            setAdvancedCards(response.cards);
            
            // Convert to legacy Card format for backward compatibility
            const nowIso = new Date().toISOString();
            const legacyCards: Card[] = (response.cards.map(card => ({
              id: card.id,
              type: card.type,
              front: card.front,
              back: card.back,
              deckId: card.deckId,
              tags: card.tags,
              difficulty: card.difficulty,
              lastStudied: card.lastStudied,
              nextDue: card.nextDue,
              interval: card.interval,
              easeFactor: card.easeFactor,
              reviewCount: card.reviewCount,
              created: nowIso,
              modified: nowIso,
              image: card.image,
              hint: card.hint
            })) as unknown) as Card[];
            
            setAllCards(legacyCards);
            
            // default session cards list
            if (!selectedMode) {
              setSessionCards(legacyCards);
            }
          } else {
            console.error('Failed to load advanced study queue:', response.error);
            // Fallback to legacy system
            setUseAdvancedSRS(false);
          }
        } else {
          // Legacy card loading
          const dueCardsRaw = await getDueCards(deckId, 100);
          const dueCards = dueCardsRaw as unknown as Card[];
          setAllCards(dueCards);

          // default session cards list
          if (!selectedMode) {
            setSessionCards(dueCards);
          }
        }
      } catch (error) {
        console.error('Error loading cards:', error);
        // Fallback to legacy system
        setUseAdvancedSRS(false);
        const dueCardsRaw = await getDueCards(deckId, 100);
        const dueCards = dueCardsRaw as unknown as Card[];
        setAllCards(dueCards);
        if (!selectedMode) {
          setSessionCards(dueCards);
        }
      } finally {
        setIsLoadingCards(false);
      }
    };

    fetchCards();
  }, [isLoadingAuth, authError, deckId, useAdvancedSRS, getDeckConfig, getAdvancedStudyQueue, getDueCards, selectedMode]);

  // Apply study mode filtering when mode changes
  useEffect(() => {
    if (!selectedMode || allCards.length === 0) return;
    
    let filteredCards = selectedMode.filter(allCards);
    
    // Apply card limits if specified
    if (selectedMode.settings?.cardLimit && filteredCards.length > selectedMode.settings.cardLimit) {
      filteredCards = filteredCards.slice(0, selectedMode.settings.cardLimit);
    }
    
    // Shuffle for cram mode or if specified
    if (selectedMode.id === 'cram-mode' || selectedMode.id === 'filtered-deck') {
      filteredCards = [...filteredCards].sort(() => Math.random() - 0.5);
    }
    
    setSessionCards(filteredCards);
    setCurrentCardIndex(0); // Reset to first card
    setShowAnswer(false);
    setShowHint(false);
    
    // Set up time limit if specified
    if (selectedMode.settings?.timeLimit) {
      setSessionStartTime(new Date());
      setTimeRemaining(selectedMode.settings.timeLimit * 60); // Convert minutes to seconds
    } else {
      setTimeRemaining(null);
    }
  }, [selectedMode, allCards]);

  // Timer for time-limited modes
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (!prev || prev <= 1) {
          // Time's up! End session
          const sessionData = calculateSessionData();
          saveSessionToDatabase(sessionData); // Fire and forget - don't await in timer
          navigate('/session-results', { state: { sessionData } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining, navigate]);

  const currentCard = sessionCards[currentCardIndex];
  const totalCards = sessionCards.length;
  const rawProgress = totalCards ? ((currentCardIndex + 1) / totalCards) * 100 : 0;
  const progress = Math.min(100, rawProgress);

  // Compute deck statistics for mode selector (based on all cards, not filtered session cards)
  const deckStats = useMemo(() => {
    return {
      totalCards: allCards.length,
      dueCards: allCards.filter(c => new Date(c.nextDue) <= new Date()).length,
      newCards: allCards.filter(c => c.reviewCount === 0).length,
      weakCards: allCards.filter((c: any) => c.difficulty && c.difficulty > 3).length,
      leechCards: allCards.filter((c: any) => c.leech).length,
    };
  }, [allCards]);

  // Anti-burnout monitoring - check fatigue indicators every few cards
  useEffect(() => {
    if (sessionStats.cardsStudied > 0 && sessionStats.cardsStudied % 3 === 0) {
      const fatigueIndicators = antiBurnoutEngine.getFatigueIndicators();
      setCurrentFatigueIndicators(fatigueIndicators);
      
      // Check for smart break suggestions
      const breakSuggestion = antiBurnoutEngine.getBreakSuggestion();
      if (breakSuggestion.triggered && !breakSuggestionDismissed) {
        setLastBreakSuggestion(breakSuggestion);
        showSmartBreakPopup(breakSuggestion);
      }
      
      // Show fatigue warning using adaptive threshold
      const fatigueThreshold = personalizedRecommendations?.fatigueWarningThreshold ?? 65;
      if (fatigueIndicators.overallFatigueScore > fatigueThreshold && fatigueIndicators.overallFatigueScore < (fatigueThreshold + 15)) {
        showPopup({
          id: `fatigue-${Date.now()}`,
          type: 'fatigue_warning',
          message: `Fatigue detected (${Math.round(fatigueIndicators.overallFatigueScore)}%). Consider taking a break soon.`,
          emoji: '😴',
          duration: 4000,
          priority: 'medium',
        });
      }
    }
  }, [sessionStats.cardsStudied, breakSuggestionDismissed]);

  // Start timing when a new card is shown
  useEffect(() => {
    if (currentCard && !showAnswer) {
      setCardShownTime(new Date());
      setAnswerShownTime(null);
    }
  }, [currentCardIndex, currentCard, showAnswer]);

  useEffect(() => {
    // Adaptive celebration frequency (replaces static every-5-cards)
    const celebrationTrigger = personalizedRecommendations?.celebrationTrigger ?? 5;
    if (sessionStats.cardsStudied > 0 && sessionStats.cardsStudied % celebrationTrigger === 0) {
      showPopup({
        id: Date.now().toString(),
        type: 'streak',
        message: `${sessionStats.cardsStudied} cards completed! Keep it up! 🚀`,
        emoji: '🔥',
        duration: 3000,
      });
    }
  }, [sessionStats.cardsStudied, personalizedRecommendations?.celebrationTrigger]);

  const showPopup = (popup: PopupNotification) => {
    setPopups(prev => [...prev, popup]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== popup.id));
    }, popup.duration);
  };

  // Smart break suggestion popup with actions
  const showSmartBreakPopup = (breakSuggestion: SmartBreakSuggestion) => {
    // Track suggestion count
    setBreakSuggestionsTriggered(prev => prev + 1);

    const handleTakeBreak = () => {
      setPreBreakFatigueScore(currentFatigueIndicators?.overallFatigueScore || 0);
      setCurrentBreakSuggestion(breakSuggestion);
      breakStartTimeRef.current = new Date();
      setShowRecoveryProtocol(true);
      // Dismiss current popup
      setPopups(prev => prev.filter(p => p.type !== 'smart_break'));
    };

    const handleDismissBreak = () => {
      setBreakSuggestionDismissed(true);
      setPopups(prev => prev.filter(p => p.type !== 'smart_break'));
    };

    const handleContinue = () => {
      setBreakSuggestionDismissed(true);
      setPopups(prev => prev.filter(p => p.type !== 'smart_break'));
      showPopup({
        id: `continue-monitoring-${Date.now()}`,
        type: 'encouragement',
        message: 'Continuing study - monitoring fatigue closely',
        emoji: '👁️',
        duration: 3000,
      });
    };

    showPopup({
      id: `smart-break-${Date.now()}`,
      type: 'smart_break',
      message: breakSuggestion.message,
      emoji: '🧠',
      duration: 10000,
      priority: 'high',
      actionable: true,
      actions: [
        { label: `Take ${antiBurnoutEngine.getSessionOptimization().recommendedBreakDuration}min break`, action: handleTakeBreak },
        { label: 'Continue for now', action: handleContinue },
        { label: 'Dismiss', action: handleDismissBreak },
      ],
    });
  };

  // Track response time data for anti-burnout analysis
  const recordResponseTime = async (rating: EmojiRating) => {
    if (!cardShownTime || !currentCard || !antiBurnoutEngine) return;

    const now = new Date();
    const timeToShowAnswer = answerShownTime 
      ? answerShownTime.getTime() - cardShownTime.getTime()
      : now.getTime() - cardShownTime.getTime(); // If they rated without showing answer
    
    const timeToRate = answerShownTime 
      ? now.getTime() - answerShownTime.getTime()
      : 1000; // Default 1 second if they rated immediately
    
    const totalTime = now.getTime() - cardShownTime.getTime();

    const responseData: ResponseTimeData = {
      cardId: currentCard.id,
      timeToShowAnswer,
      timeToRate,
      totalTime,
      timestamp: now,
      rating,
      difficulty: currentCard.difficulty || 0,
    };

    try {
      await antiBurnoutEngine.addResponseData(responseData);
    } catch (error) {
      console.warn('Failed to record response time:', error);
    }
  };

  const calculateSessionData = () => {
    const endTime = new Date();
    const timeSpent = Math.round((endTime.getTime() - sessionStats.startTime.getTime()) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const totalCards = Object.values(sessionStats.performance).reduce((sum, count) => sum + count, 0);
    const retentionRate = totalCards > 0 ? Math.round(((sessionStats.performance['😊'] + sessionStats.performance['😁']) / totalCards) * 100) : 0;
    
    // Calculate cards per minute
    const cardsPerMinute = minutes > 0 ? Math.round((totalCards / minutes) * 10) / 10 : totalCards;
    
    // Calculate tomorrow's forecast based on SM-2 algorithm
    const reviewCards = allCards.filter(card => {
      const nextDue = new Date(card.nextDue);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return nextDue.toDateString() === tomorrow.toDateString();
    }).length;
    
    const newCards = Math.max(0, 20 - reviewCards); // Cap new cards to maintain reasonable daily load
    const tomorrowForecast = reviewCards + newCards;
    
    // Generate insights based on actual performance
    const improvements: string[] = [];
    const weakestCards: string[] = [];
    
    if (retentionRate >= 90) {
      improvements.push("Outstanding retention rate! 🎯");
    } else if (retentionRate >= 80) {
      improvements.push("Strong performance this session");
    }
    
    if (cardsPerMinute >= 2) {
      improvements.push(`Great pace: ${cardsPerMinute} cards/minute`);
    }
    
    if (selectedMode) {
      improvements.push(`Completed ${selectedMode.name} successfully`);
    }
    
    if (sessionStats.performance['😞'] > 0) {
      weakestCards.push(`${sessionStats.performance['😞']} cards need more practice`);
      weakestCards.push("Consider reviewing these cards tomorrow");
    }
    
    if (sessionStats.performance['😐'] > sessionStats.performance['😊']) {
      weakestCards.push("Many cards were marked as 'Hard' - good learning opportunity");
    }
    
    // Get actual streak from user context
    const currentStreak = studyStats?.currentStreak || 0;
    
    // Add anti-burnout insights to session data
    const antiBurnoutSummary = antiBurnoutEngine.getSessionSummary();
    const finalFatigueIndicators = antiBurnoutEngine.getFatigueIndicators();
    const patternDetection = antiBurnoutEngine.getPatternDetection();
    
    return {
      cardsStudied: sessionStats.cardsStudied,
      timeSpent: timeString,
      performance: sessionStats.performance,
      retentionRate,
      streak: currentStreak,
      tomorrowForecast,
      deckName: deck?.name ?? 'Deck',
      improvements: improvements.length > 0 ? improvements : ["Session completed successfully!"],
      weakestCards,
      sessionMode: selectedMode?.name || 'Normal Study',
      cardsPerMinute,
      totalTimeSeconds: timeSpent,
      deckId: deckId || '',
      sessionDate: new Date().toISOString(),
      fatigueScore: finalFatigueIndicators.overallFatigueScore,
      fatigueIndicators: finalFatigueIndicators,
      antiBurnoutSummary,
      patternDetection,
      breakSuggestionTriggered: lastBreakSuggestion?.triggered || false,
      smartBreakTaken: false,
      breakSuggestionsTriggered,
      breaksTaken,
      averageResponseTime: antiBurnoutEngine.getSessionSummary().averageResponseTime,
      performanceTrend: antiBurnoutEngine.getPatternDetection().performanceTrend.direction,
    };
  };

  const handleRating = async (rating: EmojiRating, userAnswer?: string) => {
    // Prevent double-clicking
    if (isRating) return;
    setIsRating(true);
    
    try {
      // Record response time for anti-burnout analysis
      await recordResponseTime(rating);
      
      if (currentCard) {
        try {
          if (useAdvancedSRS && deckConfig) {
            // Use advanced SRS rating with response time tracking
            const responseTime = cardShownTime ? Date.now() - cardShownTime.getTime() : undefined;
            const hesitationTime = answerShownTime && cardShownTime 
              ? answerShownTime.getTime() - cardShownTime.getTime() 
              : undefined;
            
            const result = await rateAdvancedCard(
              currentCard.id, 
              rating, 
              responseTime, 
              hesitationTime
            );
            
            setLastReviewResult(result);
            
            // Show transition notifications
            if (result.success && result.transitions) {
              if (result.transitions.graduated) {
                showPopup({
                  id: `graduated-${Date.now()}`,
                  type: 'improvement',
                  message: 'Card graduated to review! 🎓',
                  emoji: '🎓',
                  duration: 3000,
                });
              }
              
              if (result.transitions.becameLeech) {
                showPopup({
                  id: `leech-${Date.now()}`,
                  type: 'fatigue_warning',
                  message: 'Card marked as leech - consider reviewing or editing',
                  emoji: '⚠️',
                  duration: 5000,
                  priority: 'medium'
                });
              }
              
              if (result.transitions.lapsed) {
                showPopup({
                  id: `lapsed-${Date.now()}`,
                  type: 'encouragement',
                  message: 'Card moved to relearning - you\'ll see it again soon',
                  emoji: '🔄',
                  duration: 3000,
                });
              }
            }
        } else {
          // Fallback to legacy rating
          await rateCard(currentCard.id, rating);
        }
      } catch (error) {
        console.error('Error rating card:', error);
        // Fallback to legacy rating on error
        await rateCard(currentCard.id, rating);
      }
    }

    // ----------------------------------------------
    // Celebration logic: correct-answer streak
    // ----------------------------------------------
    if (rating === '😊' || rating === '😁') {
      correctStreakRef.current += 1;
    } else {
      correctStreakRef.current = 0;
    }

    // Adaptive streak celebration frequency
    const streakCelebrationTrigger = personalizedRecommendations?.celebrationTrigger ?? 5;
    if (
      correctStreakRef.current > 0 &&
      correctStreakRef.current % streakCelebrationTrigger === 0 &&
      lastCorrectStreakPopupRef.current !== correctStreakRef.current
    ) {
      showPopup({
        id: `correct-streak-${correctStreakRef.current}`,
        type: 'streak',
        message: `🔥 ${correctStreakRef.current} correct in a row! Outstanding!`,
        emoji: '🔥',
        duration: 3000,
        priority: 'medium',
      });
      lastCorrectStreakPopupRef.current = correctStreakRef.current;
    }

    // ----------------------------------------------
    // Improvement recognition – leech/difficult → good
    // ----------------------------------------------
    const prevRating = previousRatings.current[currentCard?.id || ''];
    if (
      prevRating &&
      (prevRating === '😞' || prevRating === '😐') &&
      (rating === '😊' || rating === '😁')
    ) {
      showPopup({
        id: `improvement-${Date.now()}`,
        type: 'improvement',
        message: '💪 Nice! That tricky card just improved!',
        emoji: '💪',
        duration: 3000,
      });
    }

    if (currentCard) {
      previousRatings.current[currentCard.id] = rating;
    }

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      cardsStudied: prev.cardsStudied + 1,
      streak: rating === '😊' || rating === '😁' ? prev.streak + 1 : 0,
      performance: {
        ...prev.performance,
        [rating]: prev.performance[rating] + 1,
      },
    }));

    // ----------------------------------------------
    // Adaptive milestone celebration – mastered cards
    // ----------------------------------------------
    if (lastReviewResult?.success && lastReviewResult.transitions?.graduated) {
      const newTotal = masteredCount + 1;
      setMasteredCount(newTotal);

      if (newTotal >= nextMilestoneRef.current) {
        showPopup({
          id: `milestone-${newTotal}`,
          type: 'improvement',
          message: `🎉 ${nextMilestoneRef.current} cards mastered! Amazing progress!`,
          emoji: '🎉',
          duration: 4000,
          priority: 'high',
        });
        
        // Update to next adaptive milestone
        if (personalizedRecommendations?.nextMilestone) {
          const milestones = personalizationEngine?.getRecommendations().nextMilestone;
          nextMilestoneRef.current = milestones || (nextMilestoneRef.current + 250);
        } else {
          nextMilestoneRef.current = nextMilestoneRef.current + 250; // Fallback increment
        }
      }
    }

    // Update global stats
    updateStudyStats(rating);
    
    // Move to next card or end session
    if (currentCardIndex < sessionCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setShowHint(false);
    } else {
      // End session - save data and navigate to results
      const sessionData = calculateSessionData();
      await saveSessionToDatabase(sessionData);
      
      // Update personalization engine with session data
      if (personalizationEngine) {
        try {
          await personalizationEngine.updateProfile({
            cardsStudied: sessionStats.cardsStudied,
            timeSpent: (new Date().getTime() - sessionStats.startTime.getTime()) / 1000,
            retentionRate: sessionData.retentionRate,
            fatigueScore: sessionData.fatigueScore || 0,
            studyHour: new Date().getHours()
          });
        } catch (error) {
          console.error('Failed to update personalization profile:', error);
        }
      }
      
      navigate('/session-results', { state: { sessionData } });
    }
    } catch (error) {
      console.error('Error in handleRating:', error);
    } finally {
      setIsRating(false);
    }
  };

  const handleShowAnswer = () => {
    setAnswerShownTime(new Date()); // Track when answer was shown for response time analysis
    setShowAnswer(true);
  };

  const handleSkip = async () => {
    if (currentCardIndex < sessionCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setShowHint(false);
    } else {
      // End session if this is the last card
      const sessionData = calculateSessionData();
      await saveSessionToDatabase(sessionData);
      
      // Update personalization engine with session data
      if (personalizationEngine) {
        try {
          await personalizationEngine.updateProfile({
            cardsStudied: sessionStats.cardsStudied,
            timeSpent: (new Date().getTime() - sessionStats.startTime.getTime()) / 1000,
            retentionRate: sessionData.retentionRate,
            fatigueScore: sessionData.fatigueScore || 0,
            studyHour: new Date().getHours()
          });
        } catch (error) {
          console.error('Failed to update personalization profile:', error);
        }
      }
      
      navigate('/session-results', { state: { sessionData } });
    }
  };

  const handleBuryCard = () => {
    if (currentCard) {
      setBuriedCards(prev => [...prev, currentCard.id]);
      showPopup({
        id: Date.now().toString(),
        type: 'encouragement',
        message: 'Card buried until tomorrow',
        emoji: '📦',
        duration: 2000,
      });
      handleSkip();
    }
  };

  const handleSelectMode = (mode: StudyMode) => {
    setSelectedMode(mode);
    setShowModeSelector(false);
    
    // Show mode-specific popup
    showPopup({
      id: Date.now().toString(),
      type: 'encouragement',
      message: `${mode.name} mode activated!`,
      emoji: mode.icon,
      duration: 2000,
    });
  };

  const resetToNormalMode = () => {
    setSelectedMode(null);
    const dueCards = allCards.filter(card => new Date(card.nextDue) <= new Date());
    setSessionCards(dueCards.length > 0 ? dueCards : allCards.slice(0, 10));
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setShowHint(false);
  };

  const saveSessionToDatabase = async (sessionData: any) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        console.error('No authenticated user for session save');
        return;
      }

      const { error } = await supabase
        .from('study_logs')
        .insert({
          user_id: session.user.id,
          deck_id: deckId,
          cards_studied: sessionData.cardsStudied,
          time_spent_seconds: sessionData.totalTimeSeconds,
          performance_data: {
            ...sessionData.performance,
            fatigue_score: sessionData.fatigueScore,
            fatigue_indicators: sessionData.fatigueIndicators,
            pattern_detection: sessionData.patternDetection,
            break_suggestion_triggered: sessionData.breakSuggestionTriggered,
          },
          retention_rate: sessionData.retentionRate,
          session_mode: sessionData.sessionMode,
          session_date: sessionData.sessionDate,
          fatigue_score: sessionData.fatigueScore,
          break_suggestions_triggered: sessionData.breakSuggestionsTriggered,
          breaks_taken: sessionData.breaksTaken,
          avg_response_time_ms: Math.round(sessionData.averageResponseTime || 0),
          performance_trend: sessionData.performanceTrend,
        });

      if (error) {
        console.error('Failed to save session:', error);
      } else {
        console.log('Session saved successfully');
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const emojiButtons = [
    { emoji: '😞', label: 'Again', color: 'from-error-500 to-error-600', shortcut: '1' },
    { emoji: '😐', label: 'Hard', color: 'from-warning-500 to-warning-600', shortcut: '2' },
    { emoji: '😊', label: 'Good', color: 'from-primary-500 to-primary-600', shortcut: '3' },
    { emoji: '😁', label: 'Easy', color: 'from-success-500 to-success-600', shortcut: '4' },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!showAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleShowAnswer();
        }
      } else {
        const ratingMap: { [key: string]: EmojiRating } = {
          '1': '😞',
          '2': '😐',
          '3': '😊',
          '4': '😁',
        };
        
        if (ratingMap[e.key]) {
          e.preventDefault();
          handleRating(ratingMap[e.key]);
        }
      }
      
      if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        handleSkip();
      }
      
      if (e.key === 'b' && e.ctrlKey) {
        e.preventDefault();
        handleBuryCard();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAnswer, currentCard]);

  // --------------------------------------------------
  // Fetch initial mastered-card count for milestone detection
  // --------------------------------------------------
  useEffect(() => {
    if (!deckId) return;
    const fetchMasteredCount = async () => {
      try {
        // Check authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          console.log('No authenticated user for mastered count');
          return;
        }

        // First verify deck ownership
        const { data: deckData, error: deckError } = await supabase
          .from('decks')
          .select('id')
          .eq('id', deckId)
          .eq('owner_id', session.user.id)
          .single();

        if (deckError || !deckData) {
          console.log('Deck not found or not owned by user');
          return;
        }

        // Query cards for mastered count
        const { count, error } = await supabase
          .from('cards')
          .select('id', { count: 'exact', head: true })
          .eq('deck_id', deckId)
          .gte('interval', 21); // Consider mastered if interval ≥ 21 days

        if (error) {
          console.error('Error fetching mastered count:', error);
          return;
        }

        const total = count || 0;
        setMasteredCount(total);
        
        // Set next milestone using adaptive recommendations
        if (personalizedRecommendations?.nextMilestone) {
          nextMilestoneRef.current = personalizedRecommendations.nextMilestone;
        } else {
          // Fallback to calculated milestone
          const defaultMilestones = [100, 250, 500, 1000, 1500, 2000];
          nextMilestoneRef.current = defaultMilestones.find(m => m > total) || total + 500;
        }
      } catch (err) {
        console.error('Unexpected error fetching mastered count:', err);
      }
    };
    fetchMasteredCount();
  }, [deckId]);

  // --------------------------------------------------
  // Day-streak celebration (7-, 30-, 100-day, etc.)
  // --------------------------------------------------
  useEffect(() => {
    const thresholds = [7, 30, 100];
    const curr = studyStats?.currentStreak || 0;
    if (thresholds.includes(curr) && !shownDayStreakCelebrations.current.has(curr)) {
      showPopup({
        id: `day-streak-${curr}`,
        type: 'streak',
        message: `📅 ${curr}-day study streak! Keep it up!`,
        emoji: '📅',
        duration: 4000,
        priority: 'high',
      });
      shownDayStreakCelebrations.current.add(curr);
    }
  }, [studyStats?.currentStreak]);

  // -------------------------
  // RecoveryProtocol handlers
  // -------------------------
  const handleRecoveryComplete = async (protocol: RecoveryProtocolType) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && session?.user) {
        await supabase.from('study_breaks').insert({
          user_id: session.user.id,
          session_id: null,
          break_trigger: currentBreakSuggestion?.trigger || 'manual',
          break_taken: true,
          break_duration_minutes: Math.round(protocol.breakDuration),
          pre_break_fatigue_score: preBreakFatigueScore,
          post_break_fatigue_score: antiBurnoutEngine.getFatigueIndicators().overallFatigueScore,
          effectiveness_score: Math.round(protocol.breakEffectiveness),
          break_started_at: breakStartTimeRef.current?.toISOString() || new Date().toISOString(),
          break_ended_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to log study break:', e);
    }

    setBreaksTaken(prev => prev + 1);
    setShowRecoveryProtocol(false);
    setBreakSuggestionDismissed(false);
    antiBurnoutEngine.reset();
  };

  const handleSkipRecovery = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && session?.user) {
        await supabase.from('study_breaks').insert({
          user_id: session.user.id,
          session_id: null,
          break_trigger: currentBreakSuggestion?.trigger || 'manual',
          break_taken: false,
          break_started_at: breakStartTimeRef.current?.toISOString() || new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to log skipped break:', e);
    }
    setShowRecoveryProtocol(false);
    setBreakSuggestionDismissed(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
      {/* Show loading state while authenticating */}
      {isLoadingAuth && (
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Checking authentication...</p>
          </motion.div>
        </div>
      )}

      {/* Show error state */}
      {authError && (
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-error-200 dark:border-error-800 shadow-lg"
          >
            <div className="text-error-500 text-6xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold text-error-700 dark:text-error-300 mb-2">Authentication Required</h3>
            <p className="text-error-600 dark:text-error-400 mb-6">{authError}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              Go to Login
            </button>
          </motion.div>
        </div>
      )}

      {/* Show loading state while cards are loading */}
      {!isLoadingAuth && !authError && isLoadingCards && (
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Loading study cards...</p>
          </motion.div>
        </div>
      )}

      {/* Main study interface - only show when authenticated and cards loaded */}
      {!isLoadingAuth && !authError && !isLoadingCards && (
        <>
          {/* Header */}
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-b border-primary-100 dark:border-neutral-700 sticky top-0 z-40"
          >
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
                      {deck?.name ?? 'Study Session'}
                    </h1>
                    <div className="flex items-center space-x-4 text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      <span>{currentCardIndex + 1} of {totalCards}</span>
                      {timeRemaining && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <Calendar className="w-4 h-4" />
                    <span>Day {studyStats?.currentStreak || 0}</span>
                  </div>
                  <button
                    onClick={() => setShowModeSelector(true)}
                    className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    title="Study Modes"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => navigate('/settings')}
                    className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Study Mode Indicator */}
              {selectedMode && (
                <div className="mt-4">
                  <div className="text-center">
                    <span className="text-sm text-primary-600 dark:text-primary-400 font-medium bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full">
                      {selectedMode.name} Mode
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto px-4 py-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full"
                />
              </div>
            </div>

            {/* Encouragement */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <p className="text-lg text-neutral-700 dark:text-neutral-300">
                You're doing great! 
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-2"
                >
                  💪
                </motion.span>
              </p>
            </motion.div>

            {/* Card State Indicator */}
            {currentCard && useAdvancedSRS && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mb-6"
              >
                {(() => {
                  const advancedCard = advancedCards.find(ac => ac.id === currentCard.id);
                  return advancedCard ? (
                    <div className="space-y-3">
                      <CardStateIndicator 
                        card={advancedCard} 
                        config={deckConfig || undefined}
                        showDetails={true}
                      />
                      <LearningProgress 
                        card={advancedCard} 
                        config={deckConfig || undefined}
                      />
                    </div>
                  ) : null;
                })()}
              </motion.div>
            )}

            {/* Card or Empty State */}
            <AnimatePresence mode="wait">
              {currentCard ? (
                <CardRenderer
                  key={currentCard.id}
                  card={currentCard}
                  showAnswer={showAnswer}
                  onShowAnswer={handleShowAnswer}
                  onAnswer={(userAnswer) => {
                    // Handle type-in or multiple choice answers
                    console.log('User answer:', userAnswer);
                  }}
                  className="mb-8"
                />
              ) : sessionCards.length === 0 && allCards.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-8"
                >
                  <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-12 border border-primary-100 dark:border-neutral-700 shadow-lg">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
                      No cards match your filter
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                      {selectedMode 
                        ? `No cards available for "${selectedMode.name}" mode right now.`
                        : "No cards are ready for study at the moment."
                      }
                    </p>
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowModeSelector(true)}
                        className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium mr-3"
                      >
                        Try Different Mode
                      </button>
                      {selectedMode && (
                        <button
                          onClick={resetToNormalMode}
                          className="px-6 py-3 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-colors font-medium"
                        >
                          Reset to Normal
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Controls */}
            {currentCard && (
              <div className="flex justify-center space-x-4 mb-8">
              <button
                onClick={handleSkip}
                className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                title="Skip (Ctrl+S)"
              >
                <Skip className="w-4 h-4" />
                <span>Skip</span>
              </button>
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Hint</span>
              </button>
              <button 
                onClick={handleBuryCard}
                className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                title="Bury until tomorrow (Ctrl+B)"
              >
                <Flag className="w-4 h-4" />
                <span>Bury</span>
              </button>
            </div>
            )}

            {/* Rating Buttons */}
            <AnimatePresence>
              {showAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
                    How did you do?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                    {emojiButtons.map((button, index) => (
                      <motion.button
                        key={button.emoji}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        onClick={() => handleRating(button.emoji as EmojiRating)}
                        disabled={isRating}
                        className={`p-6 bg-gradient-to-r ${button.color} text-white rounded-2xl hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl relative ${isRating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-4xl mb-2">{button.emoji}</div>
                        <div className="text-sm font-medium">{button.label}</div>
                        <div className="absolute top-2 right-2 text-xs opacity-75">
                          {button.shortcut}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">
                    Use keyboard shortcuts 1-4 or spacebar to show answer
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Study Mode Selector */}
          <AnimatePresence>
            {showModeSelector && (
              <StudyModeSelector
                onSelectMode={handleSelectMode}
                onClose={() => setShowModeSelector(false)}
                deckStats={deckStats}
              />
            )}
          </AnimatePresence>

          {/* Popup Notifications */}
          <div className="fixed top-20 right-4 space-y-4 z-30">
            <AnimatePresence>
              {popups.map((popup) => (
                <motion.div
                  key={popup.id}
                  initial={{ opacity: 0, x: 100, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 100, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-2xl p-4 border border-primary-100 dark:border-neutral-700 shadow-2xl min-w-[280px]"
                >
                  <div className={`${popup.priority === 'high' ? 'border-l-4 border-l-warning-500 pl-3' : ''} flex items-start space-x-3`}>
                    <div className="text-2xl flex-shrink-0">{popup.emoji}</div>
                    <div className="flex-1">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">{popup.message}</p>
                      
                      {popup.type === 'streak' && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">You're building momentum! 🚀</p>
                      )}
                      
                      {popup.type === 'fatigue_warning' && (
                        <div className="mt-2">
                          <p className="text-sm text-warning-600 dark:text-warning-400">Consider taking a break soon to maintain performance.</p>
                        </div>
                      )}
                      
                      {popup.type === 'smart_break' && lastBreakSuggestion && (
                        <div className="mt-2">
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                            Confidence: {lastBreakSuggestion.confidence}% • {lastBreakSuggestion.trigger.replace('_', ' ')}
                          </p>
                          {lastBreakSuggestion.benefits && (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                              Benefits: {lastBreakSuggestion.benefits.slice(0, 2).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Actionable buttons for smart breaks and other actionable popups */}
                      {popup.actionable && popup.actions && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {popup.actions.map((action, index) => (
                            <button
                              key={index}
                              onClick={action.action}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                index === 0 ? 'bg-primary-500 text-white hover:bg-primary-600' :
                                index === 1 ? 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-900/50' :
                                'bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-500'
                              }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Legacy break popup for backwards compatibility */}
                      {popup.type === 'break' && !popup.actionable && (
                        <div className="flex space-x-2 mt-2">
                          <button className="px-3 py-1 bg-primary-500 text-white rounded-lg text-sm">
                            5-min break
                          </button>
                          <button className="px-3 py-1 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm">
                            Keep going
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Recovery Protocol */}
          <RecoveryProtocol
            isVisible={showRecoveryProtocol}
            breakDuration={antiBurnoutEngine?.getSessionOptimization()?.recommendedBreakDuration || 15}
            preFatigueScore={preBreakFatigueScore}
            onRecoveryComplete={handleRecoveryComplete}
            onSkip={handleSkipRecovery}
          />
        </>
      )}
    </div>
  );
};

export default StudySession;