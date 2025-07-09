import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  User,
  Bell,
  Palette,
  Save,
  Clock,
  Brain,
  Eye,
  Calendar,
  BookOpen
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useStudy } from '../contexts/StudyContext';
import ThemeToggle from '../components/ThemeToggle';
import { AdaptivePersonalizationEngine } from '../lib/adaptivePersonalization';
import { supabase } from '../lib/supabaseClient';

interface RecentCard {
  id: string;
  front: string;
  back: string;
  type: string;
  deck_name: string;
  reviewed_at: string;
  rating: number;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updatePreferences } = useUser();
  const { decks } = useStudy();
  const [activeTab, setActiveTab] = useState('profile');
  const [recentCards, setRecentCards] = useState<RecentCard[]>([]);
  const [showAllCards, setShowAllCards] = useState(false);
  // Auto-detect user's timezone with fallback
  const getDetectedTimeZone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return detected || 'America/New_York'; // Fallback to EST equivalent
    } catch (error) {
      console.warn('Failed to detect timezone:', error);
      return 'America/New_York'; // Safe fallback
    }
  };

  const [settings, setSettings] = useState({
    name: user?.name || '',
    email: user?.email || '',
    studyGoal: user?.studyGoal || '',
    timeZone: user?.preferences?.timeZone || getDetectedTimeZone(),
    showProgressPopups: user?.preferences?.showProgressPopups ?? true,
    smartBreakSuggestions: user?.preferences?.smartBreakSuggestions ?? true,
    emojiCelebrations: user?.preferences?.emojiCelebrations ?? true,
    soundEffects: user?.preferences?.soundEffects ?? false,
    dailyReminders: user?.preferences?.dailyReminders ?? true,
    reminderTime: user?.preferences?.reminderTime ?? '09:00',
    sessionLength: user?.preferences?.sessionLength ?? 'auto',
    customSessionLength: user?.preferences?.customSessionLength ?? 25,
    newCardsPerDay: user?.preferences?.newCardsPerDay ?? 20,
    maxDailyCards: user?.preferences?.maxDailyCards ?? 200,
    breakInterval: user?.preferences?.breakInterval ?? 25,
    breakDuration: user?.preferences?.breakDuration ?? 15,
    adaptiveBreaks: user?.preferences?.adaptiveBreaks ?? true,
    fontSize: user?.preferences?.fontSize ?? 16,
    animations: user?.preferences?.animations ?? true,
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'study', label: "Today's Study", icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [adaptiveRecommendations, setAdaptiveRecommendations] = useState<any>(null);
  const [showAdaptiveHints, setShowAdaptiveHints] = useState(true); // Always show for testing

  // Update settings when user preferences change (e.g., after loading from Supabase)
  useEffect(() => {
    if (user?.preferences) {
      setSettings(prev => ({
        ...prev,
        timeZone: user.preferences?.timeZone ?? prev.timeZone,
        showProgressPopups: user.preferences?.showProgressPopups ?? prev.showProgressPopups,
        smartBreakSuggestions: user.preferences?.smartBreakSuggestions ?? prev.smartBreakSuggestions,
        emojiCelebrations: user.preferences?.emojiCelebrations ?? prev.emojiCelebrations,
        soundEffects: user.preferences?.soundEffects ?? prev.soundEffects,
        dailyReminders: user.preferences?.dailyReminders ?? prev.dailyReminders,
        reminderTime: user.preferences?.reminderTime ?? prev.reminderTime,
        sessionLength: user.preferences?.sessionLength ?? prev.sessionLength,
        customSessionLength: user.preferences?.customSessionLength ?? prev.customSessionLength,
        newCardsPerDay: user.preferences?.newCardsPerDay ?? prev.newCardsPerDay,
        maxDailyCards: user.preferences?.maxDailyCards ?? prev.maxDailyCards,
        breakInterval: user.preferences?.breakInterval ?? prev.breakInterval,
        breakDuration: user.preferences?.breakDuration ?? prev.breakDuration,
        adaptiveBreaks: user.preferences?.adaptiveBreaks ?? prev.adaptiveBreaks,
        fontSize: user.preferences?.fontSize ?? prev.fontSize,
        animations: user.preferences?.animations ?? prev.animations,
      }));
    }
  }, [user?.preferences]);

  // Fetch recent cards
  const fetchRecentCards = async (limit = 5) => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          card_id,
          reviewed_at,
          rating,
          cards(
            id,
            front,
            back,
            type,
            decks(name)
          )
        `)
        .eq('owner_id', user.id)
        .order('reviewed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching recent cards:', error);
        return;
      }

      const formattedCards: RecentCard[] = (data || []).map((review: any) => ({
        id: review.cards.id,
        front: review.cards.front,
        back: review.cards.back,
        type: review.cards.type,
        deck_name: review.cards.decks?.name || 'Unknown Deck',
        reviewed_at: review.reviewed_at,
        rating: review.rating
      }));

      setRecentCards(formattedCards);
    } catch (error) {
      console.error('Error fetching recent cards:', error);
    }
  };

  // Load adaptive recommendations and recent cards
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        // Load adaptive recommendations
        console.log('🔄 Loading fresh adaptive recommendations...');
        const engine = new AdaptivePersonalizationEngine(user.id);
        await engine.initializeProfile();
        const recommendations = engine.getRecommendations();
        console.log('🎯 Fresh recommendations loaded:', recommendations);
        setAdaptiveRecommendations(recommendations);

        // Load recent cards
        await fetchRecentCards(showAllCards ? 50 : 5);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [user?.id, showAllCards]);




  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      await updatePreferences({
        timeZone: settings.timeZone,
        showProgressPopups: settings.showProgressPopups,
        smartBreakSuggestions: settings.smartBreakSuggestions,
        emojiCelebrations: settings.emojiCelebrations,
        soundEffects: settings.soundEffects,
        dailyReminders: settings.dailyReminders,
        reminderTime: settings.reminderTime,
        sessionLength: settings.sessionLength,
        customSessionLength: settings.customSessionLength,
        newCardsPerDay: settings.newCardsPerDay,
        maxDailyCards: settings.maxDailyCards,
        breakInterval: settings.breakInterval,
        breakDuration: settings.breakDuration,
        adaptiveBreaks: settings.adaptiveBreaks,
        fontSize: settings.fontSize,
        animations: settings.animations,
      });
      
      setSaveMessage('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
      
      // Clear error message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Name
        </label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={settings.email}
          onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Study Goal
        </label>
        <select
          value={settings.studyGoal}
          onChange={(e) => setSettings(prev => ({ ...prev, studyGoal: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        >
          <option value="Medical School">Medical School</option>
          <option value="Languages">Languages</option>
          <option value="Professional">Professional</option>
          <option value="Academic">Academic</option>
          <option value="Certification">Certification</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Time Zone
        </label>
        <select
          value={settings.timeZone}
          onChange={(e) => setSettings(prev => ({ ...prev, timeZone: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        >
          {/* Auto-detected timezone */}
          <option value={getDetectedTimeZone()}>🌍 Auto-detected: {getDetectedTimeZone().replace('_', ' ')}</option>
          
          {/* Common timezones */}
          <optgroup label="North America">
            <option value="America/New_York">Eastern Time (New York)</option>
            <option value="America/Chicago">Central Time (Chicago)</option>
            <option value="America/Denver">Mountain Time (Denver)</option>
            <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
            <option value="America/Anchorage">Alaska Time (Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii Time (Honolulu)</option>
          </optgroup>
          
          <optgroup label="Europe">
            <option value="Europe/London">GMT (London)</option>
            <option value="Europe/Paris">CET (Paris)</option>
            <option value="Europe/Berlin">CET (Berlin)</option>
            <option value="Europe/Rome">CET (Rome)</option>
            <option value="Europe/Moscow">MSK (Moscow)</option>
          </optgroup>
          
          <optgroup label="Asia Pacific">
            <option value="Asia/Tokyo">JST (Tokyo)</option>
            <option value="Asia/Shanghai">CST (Shanghai)</option>
            <option value="Asia/Kolkata">IST (Mumbai)</option>
            <option value="Australia/Sydney">AEST (Sydney)</option>
            <option value="Asia/Singapore">SGT (Singapore)</option>
          </optgroup>
          
          {/* Legacy options for backward compatibility */}
          <optgroup label="Legacy (Deprecated)">
            <option value="EST">EST (Eastern - Legacy)</option>
            <option value="CST">CST (Central - Legacy)</option>
            <option value="MST">MST (Mountain - Legacy)</option>
            <option value="PST">PST (Pacific - Legacy)</option>
          </optgroup>
        </select>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          💡 We auto-detected your timezone, but you can change it if needed.
        </p>
      </div>
    </div>
  );

  const renderStudyTab = () => {
    const getRatingEmoji = (rating: number) => {
      const emojis = ['😞', '😐', '😊', '😁'];
      return emojis[rating] || '😐';
    };

    const formatTime = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <div className="space-y-6">
        {/* Recent Cards Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              <span>Recent Study Activity</span>
            </h3>
            <button
              onClick={() => setShowAllCards(!showAllCards)}
              className="flex items-center space-x-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors text-sm"
            >
              <Eye className="w-4 h-4" />
              <span>{showAllCards ? 'Show Less' : 'View All Cards'}</span>
            </button>
          </div>

          {recentCards.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">No recent study activity</h4>
              <p className="text-neutral-500 dark:text-neutral-500">Start studying to see your recent cards here!</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCards.slice(0, showAllCards ? recentCards.length : 5).map((card, index) => (
                <motion.div
                  key={`${card.id}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full">
                          {card.type}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {card.deck_name}
                        </span>
                      </div>
                      <div className="mb-2">
                        <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {card.front.length > 60 ? `${card.front.substring(0, 60)}...` : card.front}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate mt-1">
                          {card.back.length > 80 ? `${card.back.substring(0, 80)}...` : card.back}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {formatTime(card.reviewed_at)}
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="text-lg">{getRatingEmoji(card.rating)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {!showAllCards && recentCards.length > 5 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setShowAllCards(true)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium transition-colors"
                  >
                    View {recentCards.length - 5} more cards...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <div className="text-center">
                <BookOpen className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">Study Now</span>
              </div>
            </button>
            <button
              onClick={() => navigate('/progress')}
              className="p-4 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white rounded-xl hover:from-secondary-600 hover:to-secondary-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <div className="text-center">
                <Calendar className="w-6 h-6 mx-auto mb-2" />
                <span className="font-medium">View Progress</span>
              </div>
            </button>
          </div>
        </div>

        {/* AI Learning Insights */}
        {adaptiveRecommendations && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center space-x-2">
                <Brain className="w-5 h-5 text-primary-500" />
                <span>AI Learning Insights</span>
              </h3>
            </div>
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Optimal Study Time:</span>
                  <p className="text-primary-600 dark:text-primary-400">{adaptiveRecommendations.optimalStudyTime}</p>
                </div>
                <div>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Session Length:</span>
                  <p className="text-primary-600 dark:text-primary-400">{adaptiveRecommendations.sessionLengthRecommendation} minutes</p>
                </div>
                <div>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Break Duration:</span>
                  <p className="text-primary-600 dark:text-primary-400">{adaptiveRecommendations.breakDuration} minutes</p>
                </div>
                <div>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Fatigue Threshold:</span>
                  <p className="text-primary-600 dark:text-primary-400">{Math.round(adaptiveRecommendations.fatigueWarningThreshold)}%</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-primary-200 dark:border-primary-800">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  These recommendations are personalized based on your study patterns and automatically adapt as you learn.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* const renderAppearanceTab = () => (
    <div className="space-y-6">
      <ThemeToggle variant="dropdown" />
      
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Font size
        </label>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">A</span>
          <input
            type="range"
            min="12"
            max="20"
            value={settings.fontSize}
            onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
            className="flex-1"
          />
          <span className="text-lg text-neutral-600 dark:text-neutral-400">A</span>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 min-w-16">
            {settings.fontSize}px
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Animations</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Enable smooth transitions and effects</p>
        </div>
        <button
          onClick={() => setSettings(prev => ({ ...prev, animations: !prev.animations }))}
          className={`w-12 h-6 rounded-full transition-all duration-200 ${
            settings.animations ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
            settings.animations ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    </div>
  );
*/
  const renderAppearanceTab = () => (
    <div className="space-y-6">
      <ThemeToggle variant="dropdown" />
      
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Font size
        </label>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">A</span>
          <input
            type="range"
            min="12"
            max="20"
            value={settings.fontSize}
            onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
            className="flex-1"
          />
          <span className="text-lg text-neutral-600 dark:text-neutral-400">A</span>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 min-w-16">
            {settings.fontSize}px
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Animations</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Enable smooth transitions and effects</p>
        </div>
        <button
          onClick={() => setSettings(prev => ({ ...prev, animations: !prev.animations }))}
          className={`w-12 h-6 rounded-full transition-all duration-200 ${
            settings.animations ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
            settings.animations ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    </div>
  );


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-b border-primary-100 dark:border-neutral-700 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Settings</h1>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {saveMessage && (
                <div className={`text-sm font-medium ${
                  saveMessage.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {saveMessage}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all duration-200 ${
                  isSaving 
                    ? 'bg-neutral-400 cursor-not-allowed' 
                    : 'bg-primary-500 hover:bg-primary-600 transform hover:scale-105'
                } text-white`}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-4 border border-primary-100 dark:border-neutral-700 shadow-lg">
              <nav className="space-y-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-500 text-white shadow-lg'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-lg"
            >
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'study' && renderStudyTab()}
              {activeTab === 'appearance' && renderAppearanceTab()}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;