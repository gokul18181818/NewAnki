import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Scissors, 
  Image, 
  Type, 
  Volume2, 
  CheckSquare,
  HelpCircle
} from 'lucide-react';
import { CardType } from '../types/CardTypes';

interface CardTypeSelectorProps {
  selectedType: CardType;
  onTypeChange: (type: CardType) => void;
  className?: string;
}

const CardTypeSelector: React.FC<CardTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  className = ''
}) => {
  const cardTypes = [
    {
      type: 'basic' as CardType,
      name: 'Basic',
      description: 'Traditional front/back cards',
      icon: FileText,
      color: 'primary',
      example: 'Q: What is the capital of France?\nA: Paris'
    },
    {
      type: 'cloze' as CardType,
      name: 'Cloze Deletion',
      description: 'Fill-in-the-blank style',
      icon: Scissors,
      color: 'secondary',
      example: 'The capital of {{c1::France}} is {{c2::Paris}}'
    },
    {
      type: 'image-occlusion' as CardType,
      name: 'Image Occlusion',
      description: 'Hide parts of diagrams',
      icon: Image,
      color: 'accent',
      example: 'Label anatomical parts on diagrams'
    },
    {
      type: 'type-in' as CardType,
      name: 'Type Answer',
      description: 'Type the correct answer',
      icon: Type,
      color: 'success',
      example: 'Type the Spanish word for "hello"'
    },
    {
      type: 'audio' as CardType,
      name: 'Audio',
      description: 'Listen and respond',
      icon: Volume2,
      color: 'warning',
      example: 'Listen to pronunciation and identify'
    },
    {
      type: 'multiple-choice' as CardType,
      name: 'Multiple Choice',
      description: 'Choose from options',
      icon: CheckSquare,
      color: 'error',
      example: 'Select the correct answer from 4 options'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Card Type
        </h3>
        <div className="group relative">
          <HelpCircle className="w-4 h-4 text-neutral-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            Choose the best format for your content
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {cardTypes.map((cardType) => (
          <motion.button
            key={cardType.type}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onTypeChange(cardType.type)}
            className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
              selectedType === cardType.type
                ? `border-${cardType.color}-500 bg-${cardType.color}-50 dark:bg-${cardType.color}-900/20`
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`w-10 h-10 bg-gradient-to-r from-${cardType.color}-500 to-${cardType.color}-600 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <cardType.icon className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  {cardType.name}
                </h4>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  {cardType.description}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                  {cardType.example}
                </p>
              </div>
            </div>

            {selectedType === cardType.type && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
              >
                <span className="text-white text-xs">✓</span>
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Advanced Options */}
      <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl">
        <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
          Pro Tips
        </h4>
        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p>• <strong>Basic cards</strong> work best for simple facts and definitions</p>
          <p>• <strong>Cloze deletion</strong> is perfect for learning within context</p>
          <p>• <strong>Image occlusion</strong> excels for anatomy, geography, and diagrams</p>
          <p>• <strong>Type-in cards</strong> improve active recall and spelling</p>
          <p>• <strong>Audio cards</strong> are ideal for language pronunciation</p>
          <p>• <strong>Multiple choice</strong> helps with recognition and elimination</p>
        </div>
      </div>
    </div>
  );
};

export default CardTypeSelector;