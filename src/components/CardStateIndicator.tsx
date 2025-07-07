// Card State Indicator Component
// Visual indicators for different SRS card states

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, BookOpen, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import { CardState, StudyQueueCard, DeckConfig } from '../types/SRSTypes';

interface CardStateIndicatorProps {
  card: StudyQueueCard;
  config?: DeckConfig;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface StateConfig {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const CardStateIndicator: React.FC<CardStateIndicatorProps> = ({
  card,
  config,
  showDetails = false,
  size = 'md'
}) => {
  const getStateConfig = (): StateConfig => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    };

    const iconSize = sizeClasses[size];

    switch (card.cardState) {
      case CardState.NEW:
        return {
          icon: <BookOpen className={`${iconSize} text-blue-600`} />,
          label: 'New',
          color: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          description: 'Never studied before'
        };

      case CardState.LEARNING:
        const currentStep = (card.learningStep || 0) + 1;
        const totalSteps = config?.learningSteps.length || 2;
        return {
          icon: <Brain className={`${iconSize} text-yellow-600`} />,
          label: `Learning ${currentStep}/${totalSteps}`,
          color: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          description: `Learning phase - step ${currentStep} of ${totalSteps}`
        };

      case CardState.REVIEW:
        return {
          icon: <Clock className={`${iconSize} text-green-600`} />,
          label: 'Review',
          color: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          description: 'Long-term review'
        };

      case CardState.RELEARNING:
        const relearningStep = (card.learningStep || 0) + 1;
        const totalRelearningSteps = config?.relearningSteps.length || 1;
        return {
          icon: <RotateCcw className={`${iconSize} text-orange-600`} />,
          label: `Relearning ${relearningStep}/${totalRelearningSteps}`,
          color: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          description: `Relearning phase - step ${relearningStep} of ${totalRelearningSteps}`
        };

      default:
        return {
          icon: <BookOpen className={`${iconSize} text-gray-600`} />,
          label: 'Unknown',
          color: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          description: 'Unknown state'
        };
    }
  };

  const stateConfig = getStateConfig();

  const getNextDueText = (): string => {
    if (!card.nextDue) return '';
    
    const nextDue = new Date(card.nextDue);
    const now = new Date();
    const diffMs = nextDue.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Due now';
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 60) {
      return `Due in ${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `Due in ${diffHours}h`;
    } else if (diffDays < 30) {
      return `Due in ${diffDays}d`;
    } else {
      return `Due in ${Math.floor(diffDays / 30)}mo`;
    }
  };

  const getDifficultyIndicator = () => {
    if (card.lapseCount === 0) return null;
    
    const difficultyLevel = card.lapseCount >= 5 ? 'high' : card.lapseCount >= 3 ? 'medium' : 'low';
    const colors = {
      low: 'text-yellow-600',
      medium: 'text-orange-600',
      high: 'text-red-600'
    };
    
    return (
      <div className={`flex items-center gap-1 ${colors[difficultyLevel]}`}>
        <AlertTriangle className="w-3 h-3" />
        <span className="text-xs">{card.lapseCount}</span>
      </div>
    );
  };

  const getLeechIndicator = () => {
    if (!card.isLeech) return null;
    
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200"
      >
        <AlertTriangle className="w-3 h-3" />
        <span className="text-xs font-medium">Leech</span>
      </motion.div>
    );
  };

  if (showDetails) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          inline-flex flex-col gap-2 px-3 py-2 rounded-lg border 
          ${stateConfig.bgColor} ${stateConfig.borderColor}
        `}
      >
        {/* Main state indicator */}
        <div className="flex items-center gap-2">
          {stateConfig.icon}
          <span className={`font-medium text-sm ${stateConfig.color}`}>
            {stateConfig.label}
          </span>
          {getDifficultyIndicator()}
        </div>
        
        {/* Additional details */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>{stateConfig.description}</span>
          {card.nextDue && (
            <>
              <span>•</span>
              <span>{getNextDueText()}</span>
            </>
          )}
          {card.interval && card.cardState === CardState.REVIEW && (
            <>
              <span>•</span>
              <span>Interval: {card.interval}d</span>
            </>
          )}
          {card.easeFactor && card.cardState === CardState.REVIEW && (
            <>
              <span>•</span>
              <span>Ease: {card.easeFactor.toFixed(1)}</span>
            </>
          )}
        </div>
        
        {/* Leech indicator */}
        {getLeechIndicator()}
      </motion.div>
    );
  }

  // Compact version
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md border
        ${stateConfig.bgColor} ${stateConfig.borderColor}
      `}
      title={`${stateConfig.description}${card.nextDue ? ` - ${getNextDueText()}` : ''}`}
    >
      {stateConfig.icon}
      <span className={`text-sm font-medium ${stateConfig.color}`}>
        {stateConfig.label}
      </span>
      {getDifficultyIndicator()}
      {card.isLeech && (
        <AlertTriangle className="w-3 h-3 text-red-600" title="Leech card" />
      )}
    </motion.div>
  );
};

export default CardStateIndicator;

// ========================================
// PROGRESS INDICATOR COMPONENT
// ========================================

interface LearningProgressProps {
  card: StudyQueueCard;
  config?: DeckConfig;
}

export const LearningProgress: React.FC<LearningProgressProps> = ({ card, config }) => {
  if (card.cardState !== CardState.LEARNING && card.cardState !== CardState.RELEARNING) {
    return null;
  }

  const steps = card.cardState === CardState.LEARNING 
    ? config?.learningSteps || [1, 10]
    : config?.relearningSteps || [10];
  
  const currentStep = card.learningStep || 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>
          {card.cardState === CardState.LEARNING ? 'Learning' : 'Relearning'} Progress
        </span>
        <span>{currentStep + 1}/{steps.length}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className={`h-2 rounded-full ${
            card.cardState === CardState.LEARNING ? 'bg-yellow-500' : 'bg-orange-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        {steps.map((step, index) => (
          <span key={index} className={index <= currentStep ? 'font-medium' : ''}>
            {step < 60 ? `${step}m` : `${Math.floor(step / 60)}h`}
          </span>
        ))}
      </div>
    </div>
  );
};

// ========================================
// BATCH STATE INDICATOR FOR LISTS
// ========================================

interface BatchStateIndicatorProps {
  cards: StudyQueueCard[];
  compact?: boolean;
}

export const BatchStateIndicator: React.FC<BatchStateIndicatorProps> = ({ 
  cards, 
  compact = false 
}) => {
  const counts = {
    [CardState.NEW]: cards.filter(c => c.cardState === CardState.NEW).length,
    [CardState.LEARNING]: cards.filter(c => c.cardState === CardState.LEARNING).length,
    [CardState.REVIEW]: cards.filter(c => c.cardState === CardState.REVIEW).length,
    [CardState.RELEARNING]: cards.filter(c => c.cardState === CardState.RELEARNING).length,
  };

  const leeches = cards.filter(c => c.isLeech).length;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {counts[CardState.NEW] > 0 && (
          <span className="text-blue-600">
            🆕 {counts[CardState.NEW]}
          </span>
        )}
        {counts[CardState.LEARNING] > 0 && (
          <span className="text-yellow-600">
            📚 {counts[CardState.LEARNING]}
          </span>
        )}
        {counts[CardState.REVIEW] > 0 && (
          <span className="text-green-600">
            📖 {counts[CardState.REVIEW]}
          </span>
        )}
        {counts[CardState.RELEARNING] > 0 && (
          <span className="text-orange-600">
            🔄 {counts[CardState.RELEARNING]}
          </span>
        )}
        {leeches > 0 && (
          <span className="text-red-600">
            ⚠️ {leeches}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-blue-600" />
        <span className="text-sm">New: {counts[CardState.NEW]}</span>
      </div>
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-yellow-600" />
        <span className="text-sm">Learning: {counts[CardState.LEARNING]}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-green-600" />
        <span className="text-sm">Review: {counts[CardState.REVIEW]}</span>
      </div>
      <div className="flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-orange-600" />
        <span className="text-sm">Relearning: {counts[CardState.RELEARNING]}</span>
      </div>
      {leeches > 0 && (
        <div className="flex items-center gap-2 col-span-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-600">Leeches: {leeches}</span>
        </div>
      )}
    </div>
  );
};