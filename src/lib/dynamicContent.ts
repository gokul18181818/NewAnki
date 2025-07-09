import { supabase } from './supabaseClient';

// Dynamic tip system
export interface Tip {
  id: string;
  content: string;
  category: 'study_technique' | 'motivation' | 'feature_highlight' | 'personalized';
  conditions?: {
    minCardsStudied?: number;
    maxRetentionRate?: number;
    minRetentionRate?: number;
    hasImages?: boolean;
    studyStreakDays?: number;
  };
}

const baseTips: Tip[] = [
  {
    id: 'images_retention',
    content: 'You learn 40% better with images! Try adding visuals to your cards.',
    category: 'study_technique',
    conditions: { hasImages: false }
  },
  {
    id: 'spacing_effect',
    content: 'The spacing effect: Study a little bit every day rather than cramming. Your brain loves consistency!',
    category: 'study_technique'
  },
  {
    id: 'testing_effect',
    content: 'Test yourself before reviewing answers. This "testing effect" strengthens memory formation.',
    category: 'study_technique'
  },
  {
    id: 'interleaving',
    content: 'Mix different types of cards in your study sessions. This "interleaving" improves learning.',
    category: 'study_technique'
  },
  {
    id: 'emotion_memory',
    content: 'Use the emoji ratings authentically - your emotional state affects memory encoding!',
    category: 'feature_highlight'
  },
  {
    id: 'break_suggestion',
    content: 'Taking short breaks during study sessions actually improves retention. Don\'t forget to pause!',
    category: 'study_technique',
    conditions: { minCardsStudied: 20 }
  },
  {
    id: 'difficulty_variety',
    content: 'Having trouble with some cards? That\'s good! Difficulty creates stronger memory traces.',
    category: 'motivation',
    conditions: { maxRetentionRate: 70 }
  },
  {
    id: 'streak_motivation',
    content: 'You\'re on fire! 🔥 Consistency is the key to long-term retention.',
    category: 'motivation',
    conditions: { studyStreakDays: 3 }
  },
  {
    id: 'high_performer',
    content: 'Excellent retention rate! Consider increasing your daily card limit to challenge yourself.',
    category: 'personalized',
    conditions: { minRetentionRate: 85, minCardsStudied: 10 }
  },
  {
    id: 'new_user',
    content: 'Welcome to StudyBuddy! Start small with 10-20 cards per day and build your habit gradually.',
    category: 'motivation',
    conditions: { maxRetentionRate: 100 } // New users haven't failed any cards yet
  }
];

export async function getPersonalizedTip(userId: string): Promise<Tip> {
  try {
    // Get user's recent study data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentSessions } = await supabase
      .from('study_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('session_date', thirtyDaysAgo.toISOString());

    const { data: userCards } = await supabase
      .from('cards')
      .select('front, back, decks!inner(owner_id)')
      .eq('decks.owner_id', userId);

    // Calculate user metrics
    const sessionsArr = recentSessions ?? [];

    const totalCardsStudied = sessionsArr.reduce((sum, session) => sum + session.cards_studied, 0);
    const avgRetentionRate = sessionsArr.length > 0 
      ? sessionsArr.reduce((sum, session) => sum + session.retention_rate, 0) / sessionsArr.length 
      : 0;

    // Check if user has images in cards (simple heuristic)
    const hasImages = userCards?.some(card => 
      card.front?.includes('<img') || card.back?.includes('<img') ||
      card.front?.includes('![') || card.back?.includes('![')
    ) || false;

    // Calculate study streak
    const studyDates = recentSessions?.map(session => 
      new Date(session.session_date).toDateString()
    ) || [];
    const uniqueDates = [...new Set(studyDates)].sort();
    
    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
      streak = 1;
      let checkDate = new Date(uniqueDates[uniqueDates.length - 1]);
      
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        const prevDate = new Date(checkDate);
        prevDate.setDate(prevDate.getDate() - 1);
        
        if (uniqueDates[i] === prevDate.toDateString()) {
          streak++;
          checkDate = new Date(uniqueDates[i]);
        } else {
          break;
        }
      }
    }

    // Filter tips based on user conditions
    const applicableTips = baseTips.filter(tip => {
      if (!tip.conditions) return true;
      
      const conditions = tip.conditions;
      
      if (conditions.minCardsStudied && totalCardsStudied < conditions.minCardsStudied) return false;
      if (conditions.maxRetentionRate && avgRetentionRate > conditions.maxRetentionRate) return false;
      if (conditions.minRetentionRate && avgRetentionRate < conditions.minRetentionRate) return false;
      if (conditions.hasImages !== undefined && hasImages !== conditions.hasImages) return false;
      if (conditions.studyStreakDays && streak < conditions.studyStreakDays) return false;
      
      return true;
    });

    // Return random applicable tip, or fallback to first general tip
    const selectedTips = applicableTips.length > 0 ? applicableTips : [baseTips[0]];
    return selectedTips[Math.floor(Math.random() * selectedTips.length)];

  } catch (error) {
    console.error('Error getting personalized tip:', error);
    // Fallback to random general tip
    return baseTips[Math.floor(Math.random() * baseTips.length)];
  }
}

// Dynamic AI suggestion system
export async function getDynamicAISuggestion(cardData: {
  front: string;
  back: string;
  type: string;
}): Promise<string> {
  const { front, back, type } = cardData;
  
  // Analyze content and provide contextual suggestions
  const frontLower = front.toLowerCase();
  const backLower = back.toLowerCase();
  
  // Language learning suggestions
  if (frontLower.includes('spanish') || frontLower.includes('french') || frontLower.includes('german') ||
      /\b(hola|bonjour|guten tag|привет|你好)\b/i.test(front + ' ' + back)) {
    return 'Add pronunciation guide and example sentence?';
  }
  
  // Science/medical terms
  if (frontLower.includes('anatomy') || frontLower.includes('biology') || frontLower.includes('chemistry') ||
      /\b(cell|organ|molecule|atom|DNA|protein)\b/i.test(front + ' ' + back)) {
    return 'Consider adding a diagram or visual representation?';
  }
  
  // Math/formulas
  if (/[=+\-*/^√∫∑]/.test(front + ' ' + back) || frontLower.includes('formula')) {
    return 'Add step-by-step solution or example calculation?';
  }
  
  // History/dates
  if (/\b(19|20)\d{2}\b/.test(front + ' ' + back) || frontLower.includes('history')) {
    return 'Add context about what else happened during this time?';
  }
  
  // Short answers
  if (back.length < 20) {
    return 'Consider adding more detail or an example?';
  }
  
  // Long answers
  if (back.length > 200) {
    return 'This answer is quite long - consider breaking into multiple cards?';
  }
  
  // Type-specific suggestions
  if (type === 'basic') {
    if (!frontLower.includes('what') && !frontLower.includes('how') && !frontLower.includes('?')) {
      return 'Consider phrasing the front as a question?';
    }
  }
  
  // Default suggestions based on content analysis
  const suggestions = [
    'Add an example or use case?',
    'Include a memory aid or mnemonic?',
    'Consider adding related tags?',
    'Add context or background information?'
  ];
  
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

// Achievement system
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'streak' | 'milestone' | 'mastery' | 'speed' | 'consistency';
  condition: {
    type: 'cards_studied' | 'study_streak' | 'retention_rate' | 'deck_mastery' | 'study_time' | 'consecutive_days';
    value: number;
    period?: 'day' | 'week' | 'month' | 'all_time';
    deckId?: string;
  };
  unlockedAt?: string;
}

const achievementTemplates: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Completed your first study session',
    icon: '🎯',
    category: 'milestone',
    condition: { type: 'cards_studied', value: 1, period: 'all_time' }
  },
  {
    id: 'consistent_learner',
    title: 'Consistent Learner',
    description: 'Studied for 3 consecutive days',
    icon: '📚',
    category: 'streak',
    condition: { type: 'study_streak', value: 3 }
  },
  {
    id: 'week_warrior',
    title: 'Week Warrior',
    description: 'Studied for 7 consecutive days',
    icon: '🏆',
    category: 'streak',
    condition: { type: 'study_streak', value: 7 }
  },
  {
    id: 'retention_master',
    title: 'Retention Master',
    description: 'Achieved 90%+ retention rate in a session',
    icon: '🧠',
    category: 'mastery',
    condition: { type: 'retention_rate', value: 90, period: 'day' }
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Completed 50 cards in under 10 minutes',
    icon: '⚡',
    category: 'speed',
    condition: { type: 'study_time', value: 600 } // 10 minutes in seconds
  },
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Studied 100 cards in a single day',
    icon: '💯',
    category: 'milestone',
    condition: { type: 'cards_studied', value: 100, period: 'day' }
  },
  {
    id: 'monthly_marathon',
    title: 'Monthly Marathon',
    description: 'Studied 1000 cards this month',
    icon: '🏃',
    category: 'milestone',
    condition: { type: 'cards_studied', value: 1000, period: 'month' }
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Completed a study session with 100% retention',
    icon: '⭐',
    category: 'mastery',
    condition: { type: 'retention_rate', value: 100, period: 'day' }
  }
];

export async function checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
  try {
    // Get user's study history
    const { data: studySessions } = await supabase
      .from('study_logs')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false });

    if (!studySessions) return [];

    // Get existing achievements
    const { data: existingAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    const unlockedIds = new Set(existingAchievements?.map(a => a.achievement_id) || []);
    const newAchievements: Achievement[] = [];

    for (const template of achievementTemplates) {
      if (unlockedIds.has(template.id)) continue;

      const earned = await checkAchievementCondition(template, studySessions, userId);
      if (earned) {
        const achievement: Achievement = {
          ...template,
          unlockedAt: new Date().toISOString()
        };

        // Save to database
        await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: template.id,
            unlocked_at: achievement.unlockedAt
          });

        newAchievements.push(achievement);
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

async function checkAchievementCondition(
  template: Omit<Achievement, 'unlockedAt'>, 
  studySessions: any[], 
  userId: string
): Promise<boolean> {
  const { condition } = template;
  
  switch (condition.type) {
    case 'cards_studied': {
      let total = 0;
      const now = new Date();
      
      for (const session of studySessions) {
        const sessionDate = new Date(session.session_date);
        
        if (condition.period === 'day') {
          const isToday = sessionDate.toDateString() === now.toDateString();
          if (isToday) total += session.cards_studied;
        } else if (condition.period === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (sessionDate >= weekAgo) total += session.cards_studied;
        } else if (condition.period === 'month') {
          const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
          if (sessionDate >= monthAgo) total += session.cards_studied;
        } else {
          total += session.cards_studied;
        }
      }
      
      return total >= condition.value;
    }
    
    case 'study_streak': {
      const dates = studySessions.map(s => new Date(s.session_date).toDateString());
      const uniqueDates = [...new Set(dates)].sort();
      
      let streak = 0;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      
      if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
        streak = 1;
        let checkDate = new Date(uniqueDates[uniqueDates.length - 1]);
        
        for (let i = uniqueDates.length - 2; i >= 0; i--) {
          const prevDate = new Date(checkDate);
          prevDate.setDate(prevDate.getDate() - 1);
          
          if (uniqueDates[i] === prevDate.toDateString()) {
            streak++;
            checkDate = new Date(uniqueDates[i]);
          } else {
            break;
          }
        }
      }
      
      return streak >= condition.value;
    }
    
    case 'retention_rate': {
      if (condition.period === 'day') {
        const today = new Date().toDateString();
        const todaySessions = studySessions.filter(s => 
          new Date(s.session_date).toDateString() === today
        );
        return todaySessions.some(session => session.retention_rate >= condition.value);
      }
      return studySessions.some(session => session.retention_rate >= condition.value);
    }
    
    case 'study_time': {
      // For speed achievements - check if any session meets time criteria
      const today = new Date().toDateString();
      const todaySessions = studySessions.filter(s => 
        new Date(s.session_date).toDateString() === today
      );
      
      return todaySessions.some(session => 
        session.cards_studied >= 50 && session.time_spent_seconds <= condition.value
      );
    }
    
    default:
      return false;
  }
}

export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  try {
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (!userAchievements) return [];

    return userAchievements.map(ua => {
      const template = achievementTemplates.find(t => t.id === ua.achievement_id);
      if (!template) return null;
      
      return {
        ...template,
        unlockedAt: ua.unlocked_at
      };
    }).filter(Boolean) as Achievement[];
  } catch (error) {
    console.error('Error getting user achievements:', error);
    return [];
  }
}

export function getRelativeTimeString(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}