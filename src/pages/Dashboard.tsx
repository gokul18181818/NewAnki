import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { 
  Brain, 
  Settings, 
  User, 
  Calendar, 
  TrendingUp,
  Plus,
  Upload,
  BookOpen,
  BarChart3,
  Play,
  Flame,
  Target,
  Clock,
  Heart,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useStudy } from '../contexts/StudyContext';
import ThemeToggle from '../components/ThemeToggle';
import { supabase } from '../lib/supabaseClient';
import { getPersonalizedTip } from '../lib/dynamicContent';
import AchievementsList from '../components/AchievementsList';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { decks, getCardsStudiedToday, getWorkloadRecommendation, checkBurnoutRisk, getStudyCalendarData, getStreakInfo, refreshStreakData } = useStudy();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workloadRecommendation, setWorkloadRecommendation] = useState<{
    recommendedCards: number;
    shouldStudy: boolean;
    reason: string;
  } | null>(null);
  const [burnoutRisk, setBurnoutRisk] = useState<{
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  } | null>(null);

  interface EmojiMap { '😞': number; '😐': number; '😊': number; '😁': number }
  const [stats, setStats] = useState<{ totalCards: number; studiedToday: number; emojiBreakdown: EmojiMap }>({
    totalCards: 0,
    studiedToday: 0,
    emojiBreakdown: { '😞': 0, '😐': 0, '😊': 0, '😁': 0 },
  });
  const [cardsStudiedToday, setCardsStudiedToday] = useState<number>(0);
  const [insights, setInsights] = useState<{
    best_hour: string | null;
    positivity: number | null;
    fastest_topic?: string | null;
    hardest_topic?: string | null;
    optimal_cards?: number | null;
  } | null>(null);

  // NEW: Real study calendar data
  const [studyCalendarData, setStudyCalendarData] = useState<{ [key: string]: boolean }>({});
  const [streakInfo, setStreakInfo] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [dynamicTip, setDynamicTip] = useState<string>('');

  useEffect(() => {
    const loadStats = async () => {
      // Early authentication check
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('No authenticated user, redirecting to login');
        navigate('/login');
        return;
      }

      // total cards in all decks
      const { count: totalCards } = await supabase
        .from('cards')
        .select('id', { head: true, count: 'exact' });

      // today timeframe
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate()+1);

      const { data: reviewsToday } = await supabase
        .from('reviews')
        .select('rating')
        .gte('reviewed_at', todayStart.toISOString())
        .lt('reviewed_at', tomorrowStart.toISOString());

      const breakdown: EmojiMap = { '😞':0,'😐':0,'😊':0,'😁':0 };
      (reviewsToday as { rating: number }[] | null)?.forEach((r) => {
        const emoji = (['😞','😐','😊','😁'][r.rating] ?? '😞') as keyof EmojiMap;
        breakdown[emoji] += 1;
      });

      setStats({
        totalCards: totalCards ?? 0,
        studiedToday: reviewsToday?.length ?? 0,
        emojiBreakdown: breakdown,
      });
      
      // Load anti-burnout data
      const cardsToday = await getCardsStudiedToday();
      setCardsStudiedToday(cardsToday);
      
      const workload = await getWorkloadRecommendation();
      console.log('Workload recommendation:', workload);
      setWorkloadRecommendation(workload);
      
      const burnout = await checkBurnoutRisk();
      console.log('Burnout risk:', burnout);
      setBurnoutRisk(burnout);

      // NEW: Load real study calendar data
      const calendarData = await getStudyCalendarData(90); // Get last 90 days
      const calendarMap: { [key: string]: boolean } = {};
      calendarData.forEach(day => {
        calendarMap[day.date] = day.studied;
      });
      setStudyCalendarData(calendarMap);
      console.log('Loaded study calendar data:', { calendarData: calendarData.slice(0, 5), total: calendarData.length });

      // NEW: Load real streak info
      const streak = await getStreakInfo();
      setStreakInfo(streak);
      console.log('Loaded streak info:', streak);
      
      // Load personalized tip
      if (session?.user) {
        const tip = await getPersonalizedTip(session.user.id);
        setDynamicTip(tip.content);
      }
    };
    loadStats();
  }, [decks, getCardsStudiedToday, getWorkloadRecommendation, checkBurnoutRisk, getStudyCalendarData, getStreakInfo]);

  useEffect(() => {
    const fetchInsights = async () => {
      // Try user-level insights first (requires new SQL func)
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;

      if (uid) {
        const { data: userData, error: userErr } = await supabase.rpc('user_learning_insights', { p_user_id: uid });
        if (!userErr && userData) {
          setInsights(userData as any);
          return; // done
        }
      }

      // Fallback: primary deck-level insights
      if (!decks.length) return;
      const primaryDeckId = decks[0].id;
      const { data: deckData, error: deckErr } = await supabase.rpc('deck_learning_insights', { p_deck_id: primaryDeckId });
      if (!deckErr) setInsights(deckData as any);
    };
    fetchInsights();
  }, [decks]);

  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Build array of days with leading blanks so that the 1st of the month
  // aligns with the correct weekday column (0 = Sunday).
  const monthStartDay = monthStart.getDay(); // 0-6, Sunday = 0
  const monthDaysUnpadded = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthDays = [
    ...Array(monthStartDay).fill(null), // placeholders for previous month
    ...monthDaysUnpadded,
  ];

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good morning';
    if (hour < 17) return '☀️ Good afternoon';
    return '🌙 Good evening';
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const studied = studyCalendarData[dateStr] || false;
    if (studied) return 'studied';
    if (isToday(date)) return 'today';
    return 'none';
  };

  const sortedDecks = [...decks].sort((a,b)=> new Date(b.created).getTime() - new Date(a.created).getTime());
  const totalDueCards = sortedDecks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const positivityRate = Math.round(
    ((stats.emojiBreakdown['😊'] + stats.emojiBreakdown['😁']) / 
     (stats.emojiBreakdown['😞'] + stats.emojiBreakdown['😐'] + stats.emojiBreakdown['😊'] + stats.emojiBreakdown['😁'])) * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-b border-primary-100 dark:border-neutral-700 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                StudyBuddy
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <button
                onClick={() => navigate('/progress')}
                className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                title="Progress"
              >
                <BarChart3 className="w-6 h-6" />
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
              <div className="flex items-center space-x-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-primary-700 dark:text-primary-300 font-medium">{user?.user_metadata?.full_name ?? user?.email}</span>
                <ChevronDown className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
            {getTimeGreeting()}, {user?.user_metadata?.full_name ?? user?.email}!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-lg">
            Ready for day {streakInfo?.currentStreak ?? 0} of your streak? 
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="ml-2"
            >
              🔥
            </motion.span>
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Calendar Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary-500" />
                {format(currentMonth, 'MMMM')}
              </h3>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-neutral-600 dark:text-neutral-400 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={`${day}-${idx}`} className="text-center py-1 font-medium">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((date, idx) => {
                if (!date) {
                  return <div key={`blank-${idx}`} className="aspect-square" />; // empty cell
                }
                const status = getDayStatus(date);
                return (
                  <div
                    key={date.toISOString()}
                    className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-all duration-200 ${
                      status === 'studied'
                        ? 'bg-primary-500 text-white'
                        : status === 'today'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                        : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {format(date, 'd')}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-3 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-full">
                <Flame className="w-4 h-4 text-primary-600 dark:text-primary-400 mr-1" />
                <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {streakInfo?.currentStreak}-day streak!
                </span>
              </div>
            </div>
          </motion.div>

          {/* Today's Study */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-secondary-100 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-secondary-500" />
              Today's Study
            </h3>
            <div className="space-y-3">
              {sortedDecks.map(deck => (
                <div
                  key={deck.id}
                  className="flex items-center justify-between w-full px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      deck.dueCount > 10 ? 'bg-error-500' : 
                      deck.dueCount > 5 ? 'bg-warning-500' : 
                      'bg-success-500'
                    }`} />
                    <div>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200 max-w-[140px] truncate">{deck.name}</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">{deck.dueCount} due</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/deck/${deck.id}`)}
                      className="p-1 text-neutral-500 hover:text-primary-600 transition-colors"
                      title="Edit deck"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/study/${deck.id}`)}
                      className="p-1 text-neutral-500 hover:text-secondary-600 transition-colors"
                      title="Study deck"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                // Find the first deck with due cards
                const deckWithDueCards = decks.find(deck => deck.dueCount > 0);
                if (deckWithDueCards) {
                  navigate(`/study/${deckWithDueCards.id}`);
                } else {
                  // If no due cards, navigate to create cards
                  navigate('/create');
                }
              }}
              disabled={totalDueCards === 0}
              className={`w-full mt-4 px-4 py-3 rounded-xl transition-all duration-200 transform font-medium shadow-lg flex items-center justify-center space-x-2 ${
                totalDueCards > 0 
                  ? 'bg-secondary-500 text-white hover:bg-secondary-600 hover:scale-105' 
                  : 'bg-neutral-300 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5" />
              <span>
                {totalDueCards > 0 
                  ? `Start ${totalDueCards} cards` 
                  : 'No cards due - Create some first!'
                }
              </span>
            </button>
          </motion.div>

          {/* This Week */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-accent-100 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-accent-500" />
              This Week
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">😊</span>
                <div className="flex-1 mx-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Happy</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{stats.emojiBreakdown['😊']}</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                    <div 
                      className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(stats.emojiBreakdown['😊'] / 250) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl">😁</span>
                <div className="flex-1 mx-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Very happy</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{stats.emojiBreakdown['😁']}</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                    <div 
                      className="bg-success-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(stats.emojiBreakdown['😁'] / 250) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl">😐</span>
                <div className="flex-1 mx-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Neutral</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{stats.emojiBreakdown['😐']}</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                    <div 
                      className="bg-warning-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(stats.emojiBreakdown['😐'] / 250) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl">😞</span>
                <div className="flex-1 mx-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Learning</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{stats.emojiBreakdown['😞']}</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-1">
                    <div 
                      className="bg-error-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(stats.emojiBreakdown['😞'] / 250) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-3 py-1 bg-success-50 dark:bg-success-900/20 rounded-full">
                <Heart className="w-4 h-4 text-success-600 dark:text-success-400 mr-1" />
                <span className="text-sm font-medium text-success-700 dark:text-success-300">
                  {positivityRate}% positive!
                </span>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-success-100 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-success-500" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/create')}
                className="w-full px-4 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all duration-200 transform hover:scale-105 font-medium flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Cards</span>
              </button>
              <button
                onClick={() => navigate('/import')}
                className="w-full px-4 py-3 bg-secondary-50 dark:bg-secondary-900/20 text-secondary-700 dark:text-secondary-300 rounded-xl hover:bg-secondary-100 dark:hover:bg-secondary-900/30 transition-all duration-200 transform hover:scale-105 font-medium flex items-center justify-center space-x-2"
              >
                <Upload className="w-5 h-5" />
                <span>Import Deck</span>
              </button>
              <button
                onClick={() => navigate('/progress')}
                className="w-full px-4 py-3 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 rounded-xl hover:bg-accent-100 dark:hover:bg-accent-900/30 transition-all duration-200 transform hover:scale-105 font-medium flex items-center justify-center space-x-2"
              >
                <BarChart3 className="w-5 h-5" />
                <span>View Progress</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Workload & Burnout Monitoring */}
        {(workloadRecommendation || burnoutRisk) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Workload Recommendation */}
              {workloadRecommendation && (
              <div className={`bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border shadow-lg ${
                !workloadRecommendation.shouldStudy ? 'border-error-200 dark:border-error-800' :
                cardsStudiedToday > (user?.preferences?.maxDailyCards || 200) * 0.5 ? 'border-warning-200 dark:border-warning-800' :
                'border-primary-100 dark:border-neutral-700'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-primary-500" />
                    Daily Workload
                  </h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    !workloadRecommendation.shouldStudy ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300' :
                    cardsStudiedToday > (user?.preferences?.maxDailyCards || 200) * 0.5 ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' :
                    'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                  }`}>
                    {cardsStudiedToday}/{user?.preferences?.maxDailyCards || 200} cards
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600 dark:text-neutral-400">Today's Progress</span>
                    <div className="w-32 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          cardsStudiedToday > (user?.preferences?.maxDailyCards || 200) * 0.75 ? 'bg-error-500' :
                          cardsStudiedToday > (user?.preferences?.maxDailyCards || 200) * 0.5 ? 'bg-warning-500' :
                          'bg-success-500'
                        }`}
                        style={{ width: `${Math.min(100, (cardsStudiedToday / (user?.preferences?.maxDailyCards || 200)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                      Recommendation: {workloadRecommendation.recommendedCards} cards
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {workloadRecommendation.reason}
                    </p>
                  </div>
                </div>
              </div>
              )}
              
              {/* Daily Cards Goal */}
              {!workloadRecommendation && (
                <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center">
                      <Target className="w-5 h-5 mr-2 text-primary-500" />
                      Daily Goal
                    </h3>
                    <div className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {cardsStudiedToday}/{user?.preferences?.newCardsPerDay || 20} cards
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600 dark:text-neutral-400">Progress</span>
                      <div className="w-32 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-primary-500 transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, (cardsStudiedToday / (user?.preferences?.newCardsPerDay || 20)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                        {cardsStudiedToday >= (user?.preferences?.newCardsPerDay || 20) 
                          ? '🎉 Goal achieved!' 
                          : `${(user?.preferences?.newCardsPerDay || 20) - cardsStudiedToday} cards to go`
                        }
                      </p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Keep up the great work!
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Burnout Risk Assessment */}
              {burnoutRisk && (
                <div className={`bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border shadow-lg ${
                  burnoutRisk.riskLevel === 'high' ? 'border-error-200 dark:border-error-800' :
                  burnoutRisk.riskLevel === 'medium' ? 'border-warning-200 dark:border-warning-800' :
                  'border-success-200 dark:border-success-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center">
                      <Brain className="w-5 h-5 mr-2 text-primary-500" />
                      Burnout Risk
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      burnoutRisk.riskLevel === 'high' ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300' :
                      burnoutRisk.riskLevel === 'medium' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' :
                      'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                    }`}>
                      {burnoutRisk.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {burnoutRisk.recommendations.slice(0, 2).map((rec, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          burnoutRisk.riskLevel === 'high' ? 'bg-error-500' :
                          burnoutRisk.riskLevel === 'medium' ? 'bg-warning-500' :
                          'bg-success-500'
                        }`} />
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Study Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg mb-8"
        >
          <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-4">
            Learning Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
              <Clock className="w-8 h-8 text-primary-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Best study time</p>
              <p className="font-bold text-primary-700 dark:text-primary-300">
                {insights?.best_hour ? `${((+insights.best_hour +11)%12 +1)} ${+insights.best_hour <12?'AM':'PM'}` : '—'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {insights?.positivity != null ? `${insights.positivity}% 😊 rate` : 'Fetching…'}
              </p>
            </div>
            <div className="text-center p-4 bg-success-50 dark:bg-success-900/20 rounded-xl">
              <TrendingUp className="w-8 h-8 text-success-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Fastest improving</p>
              <p className="font-bold text-success-700 dark:text-success-300">
                {insights?.fastest_topic ?? '—'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">improving</p>
            </div>
            <div className="text-center p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl">
              <Target className="w-8 h-8 text-warning-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Most challenging</p>
              <p className="font-bold text-warning-700 dark:text-warning-300">
                {insights?.hardest_topic ?? '—'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">challenging</p>
            </div>
            <div className="text-center p-4 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl">
              <Heart className="w-8 h-8 text-secondary-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Optimal session</p>
              <p className="font-bold text-secondary-700 dark:text-secondary-300">
                {insights?.optimal_cards ? `${insights.optimal_cards} cards` : '—'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">per session</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-bold">💡</span>
              </div>
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Pro Tip</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {dynamicTip || 'You learn 40% better with images! Try adding visuals to your cards.'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Achievements */}
        <AchievementsList />
      </main>
    </div>
  );
};

export default Dashboard;