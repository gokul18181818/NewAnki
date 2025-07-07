import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Clock, 
  Target, 
  TrendingDown, 
  Shuffle, 
  Calendar,
  Filter,
  Zap,
  BookOpen,
  AlertTriangle
} from 'lucide-react';
import { StudyMode } from '../types/CardTypes';

interface StudyModeSelectorProps {
  onSelectMode: (mode: StudyMode) => void;
  onClose: () => void;
  deckStats: {
    totalCards: number;
    dueCards: number;
    newCards: number;
    weakCards: number;
    leechCards: number;
  };
}

const StudyModeSelector: React.FC<StudyModeSelectorProps> = ({
  onSelectMode,
  onClose,
  deckStats
}) => {
  const studyModes: StudyMode[] = [
    {
      id: 'normal',
      name: 'Normal Study',
      description: 'Study due cards in optimal order',
      icon: '📚',
      filter: (cards) => cards.filter(card => new Date(card.nextDue) <= new Date()),
      settings: {
        reviewType: 'due'
      }
    },
    {
      id: 'weak-cards',
      name: 'Review Weak Cards',
      description: 'Focus on cards you struggle with',
      icon: '💪',
      filter: (cards) => cards.filter(card => card.difficulty > 3 || card.leech),
      settings: {
        reviewType: 'weak',
        cardLimit: 20
      }
    },
    {
      id: 'quick-session',
      name: '20 Min Quick Session',
      description: 'Perfect for busy schedules',
      icon: '⚡',
      filter: (cards) => cards.filter(card => new Date(card.nextDue) <= new Date()),
      settings: {
        timeLimit: 20,
        reviewType: 'due'
      }
    },
    {
      id: 'new-cards',
      name: 'Learn New Cards',
      description: 'Introduce fresh material',
      icon: '🌟',
      filter: (cards) => cards.filter(card => card.reviewCount === 0),
      settings: {
        reviewType: 'new',
        cardLimit: 15
      }
    },
    {
      id: 'cram-mode',
      name: 'Cram Session',
      description: 'Review all cards regardless of schedule',
      icon: '🔥',
      filter: (cards) => cards,
      settings: {
        reviewType: 'all',
        timeLimit: 45
      }
    },
    {
      id: 'leech-therapy',
      name: 'Leech Therapy',
      description: 'Special focus on problematic cards',
      icon: '🎯',
      filter: (cards) => cards.filter(card => card.leech),
      settings: {
        reviewType: 'weak'
      }
    }
  ];

  const getModeStats = (mode: StudyMode) => {
    switch (mode.id) {
      case 'normal':
        return `${deckStats.dueCards} cards`;
      case 'weak-cards':
        return `${deckStats.weakCards} cards`;
      case 'quick-session':
        return `~${Math.min(deckStats.dueCards, 15)} cards`;
      case 'new-cards':
        return `${deckStats.newCards} cards`;
      case 'cram-mode':
        return `${deckStats.totalCards} cards`;
      case 'leech-therapy':
        return `${deckStats.leechCards} cards`;
      default:
        return '';
    }
  };

  const getModeColor = (mode: StudyMode) => {
    switch (mode.id) {
      case 'normal':
        return 'from-primary-500 to-primary-600';
      case 'weak-cards':
        return 'from-warning-500 to-warning-600';
      case 'quick-session':
        return 'from-success-500 to-success-600';
      case 'new-cards':
        return 'from-secondary-500 to-secondary-600';
      case 'cram-mode':
        return 'from-error-500 to-error-600';
      case 'leech-therapy':
        return 'from-accent-500 to-accent-600';
      default:
        return 'from-neutral-500 to-neutral-600';
    }
  };

  const isDisabled = (mode: StudyMode) => {
    switch (mode.id) {
      case 'normal':
        return deckStats.dueCards === 0;
      case 'weak-cards':
        return deckStats.weakCards === 0;
      case 'new-cards':
        return deckStats.newCards === 0;
      case 'leech-therapy':
        return deckStats.leechCards === 0;
      default:
        return false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-neutral-800 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
            Choose Study Mode
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Select how you'd like to study today
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studyModes.map((mode, index) => (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              onClick={() => !isDisabled(mode) && onSelectMode(mode)}
              disabled={isDisabled(mode)}
              className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
                isDisabled(mode)
                  ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 opacity-50 cursor-not-allowed'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-primary-300 dark:hover:border-primary-600 hover:scale-105 hover:shadow-lg'
              }`}
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${getModeColor(mode)} rounded-2xl flex items-center justify-center mb-4 ${
                isDisabled(mode) ? 'opacity-50' : ''
              }`}>
                <span className="text-2xl">{mode.icon}</span>
              </div>
              
              <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                {mode.name}
              </h3>
              
              <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
                {mode.description}
              </p>
              
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  isDisabled(mode) 
                    ? 'text-neutral-400 dark:text-neutral-500' 
                    : 'text-primary-600 dark:text-primary-400'
                }`}>
                  {getModeStats(mode)}
                </span>
                
                {mode.settings?.timeLimit && (
                  <div className="flex items-center space-x-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <Clock className="w-3 h-3" />
                    <span>{mode.settings.timeLimit}min</span>
                  </div>
                )}
              </div>

              {isDisabled(mode) && (
                <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 italic">
                  No cards available
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Custom Study Options */}
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
            Custom Study
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => onSelectMode({
                id: 'filtered-deck',
                name: 'Filtered Deck',
                description: 'Create temporary deck with custom filters',
                icon: '🔍',
                filter: (cards) => cards,
                settings: { reviewType: 'all' }
              })}
              className="p-4 bg-gradient-to-r from-accent-50 to-secondary-50 dark:from-accent-900/20 dark:to-secondary-900/20 rounded-xl border border-accent-200 dark:border-accent-700 hover:border-accent-300 dark:hover:border-accent-600 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <Filter className="w-6 h-6 text-accent-600 dark:text-accent-400" />
                <div className="text-left">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">Filtered Deck</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Custom filters & limits</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => onSelectMode({
                id: 'study-ahead',
                name: 'Study Ahead',
                description: 'Study tomorrow\'s cards early',
                icon: '⏰',
                filter: (cards) => cards.filter(card => new Date(card.nextDue) <= new Date(Date.now() + 24 * 60 * 60 * 1000)),
                settings: { reviewType: 'all' }
              })}
              className="p-4 bg-gradient-to-r from-primary-50 to-success-50 dark:from-primary-900/20 dark:to-success-900/20 rounded-xl border border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                <div className="text-left">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">Study Ahead</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Get ahead of schedule</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StudyModeSelector;