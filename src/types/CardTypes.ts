export type CardType = 'basic' | 'cloze' | 'image-occlusion' | 'type-in' | 'audio' | 'multiple-choice';

export interface BaseCard {
  id: string;
  deckId: string;
  type: CardType;
  tags: string[];
  difficulty: number;
  lastStudied: string | null;
  nextDue: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  created: string;
  modified: string;
  buried?: boolean;
  leech?: boolean;
  suspended?: boolean;
}

export interface BasicCard extends BaseCard {
  type: 'basic';
  front: string;
  back: string;
  hint?: string;
  image?: string;
}

export interface ClozeCard extends BaseCard {
  type: 'cloze';
  text: string; // "The capital of {{c1::France}} is {{c2::Paris}}"
  clozes: {
    id: string;
    text: string;
    hint?: string;
  }[];
  image?: string;
}

export interface ImageOcclusionCard extends BaseCard {
  type: 'image-occlusion';
  image: string;
  occlusions: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    hint?: string;
  }[];
  question?: string;
}

export interface TypeInCard extends BaseCard {
  type: 'type-in';
  question: string;
  answer: string;
  acceptableAnswers?: string[];
  caseSensitive?: boolean;
  hint?: string;
  image?: string;
}

export interface AudioCard extends BaseCard {
  type: 'audio';
  question: string;
  audioUrl: string;
  answer: string;
  transcript?: string;
  hint?: string;
}

export interface MultipleChoiceCard extends BaseCard {
  type: 'multiple-choice';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  hint?: string;
  image?: string;
}

export type Card = BasicCard | ClozeCard | ImageOcclusionCard | TypeInCard | AudioCard | MultipleChoiceCard;

export interface StudyMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  filter: (cards: Card[]) => Card[];
  settings?: {
    timeLimit?: number;
    cardLimit?: number;
    reviewType?: 'new' | 'due' | 'weak' | 'all';
  };
}