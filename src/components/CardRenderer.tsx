import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Card, ClozeCard, ImageOcclusionCard, TypeInCard, AudioCard, MultipleChoiceCard } from '../types/CardTypes';
import { supabase } from '../lib/supabaseClient';

interface CardRendererProps {
  card: Card;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onAnswer?: (userAnswer?: string) => void;
  className?: string;
}

const CardRenderer: React.FC<CardRendererProps> = ({
  card,
  showAnswer,
  onShowAnswer,
  onAnswer,
  className = ''
}) => {
  const [userInput, setUserInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCloze, setCurrentCloze] = useState(0);
  const [hiddenOcclusions, setHiddenOcclusions] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset currentCloze when card changes
  useEffect(() => {
    setCurrentCloze(0);
  }, [card.id]);

  const renderBasicCard = () => {
    const basicCard = card as any; // Type assertion for basic card
    
    // Check if content contains HTML (including images)
    const frontHasHTML = basicCard.front && (basicCard.front.includes('<') || basicCard.front.includes('&'));
    const backHasHTML = basicCard.back && (basicCard.back.includes('<') || basicCard.back.includes('&'));
    
    // Format text content for better readability
    const formatText = (text: string): string => {
      if (!text) return text;
      
      // Convert line breaks to HTML for proper display
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Style answer options differently
          if (/^[A-D]\.\s/.test(line)) {
            return `<div class="text-left bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-2 border-l-4 border-blue-500"><strong>${line}</strong></div>`;
          }
          // Style sections like Answer:, Explanation:
          if (/^(Answer|Explanation|Hint):/i.test(line)) {
            return `<div class="text-left mt-4 mb-2"><h4 class="font-bold text-primary-600 dark:text-primary-400">${line}</h4></div>`;
          }
          // Style mathematical equations and formulas
          if (/[=+\-*/÷×√∑∫]/.test(line) || /\d+\s*[+\-*/÷×]\s*\d+/.test(line)) {
            return `<div class="text-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-3 border border-blue-200 dark:border-blue-800"><code class="text-lg font-mono text-blue-800 dark:text-blue-200">${line}</code></div>`;
          }
          // Regular paragraph
          return `<p class="mb-2 text-left">${line}</p>`;
        })
        .join('');
    };
    
    return (
      <div className="text-center">
        <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-200 mb-6 leading-relaxed">
          {frontHasHTML ? (
            <div 
              dangerouslySetInnerHTML={{ __html: basicCard.front }}
              className="prose prose-lg dark:prose-invert max-w-none"
            />
          ) : basicCard.front && (basicCard.front.includes('\n') || /[A-D]\.\s/.test(basicCard.front)) ? (
            <div 
              dangerouslySetInnerHTML={{ __html: formatText(basicCard.front) }}
              className="prose prose-lg dark:prose-invert max-w-none text-left"
            />
          ) : (
            <div className="text-6xl font-bold">{basicCard.front}</div>
          )}
        </div>
        
        {!showAnswer && (
          <button
            onClick={onShowAnswer}
            className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg text-lg"
          >
            Show Answer
          </button>
        )}

        <AnimatePresence>
          {showAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="border-t border-neutral-200 dark:border-neutral-600 pt-6"
            >
              <div className="text-xl font-bold text-primary-600 dark:text-primary-400 mb-4 leading-relaxed">
                {backHasHTML ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: basicCard.back }}
                    className="prose prose-lg dark:prose-invert max-w-none"
                  />
                ) : basicCard.back && (basicCard.back.includes('\n') || /[A-D]\.\s/.test(basicCard.back) || /Answer:|Explanation:/i.test(basicCard.back)) ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: formatText(basicCard.back) }}
                    className="prose prose-lg dark:prose-invert max-w-none text-left"
                  />
                ) : (
                  <div className="text-4xl font-bold">{basicCard.back}</div>
                )}
              </div>
              {basicCard.hint && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mb-4">
                  <p className="text-primary-700 dark:text-primary-300 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 mr-2" />
                    {basicCard.hint}
                  </p>
                </div>
              )}
              {basicCard.image && (
                <div className="flex justify-center mb-4">
                  <img
                    src={basicCard.image}
                    alt="Card illustration"
                    className="w-48 h-32 object-cover rounded-xl shadow-lg"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Helper function to parse cloze text and extract cloze deletions
  const parseClozeText = (text: string) => {
    const clozePattern = /\{\{c(\d+)::([^}]+)\}\}/g;
    const clozes: { id: string; text: string; hint?: string }[] = [];
    let match;
    
    while ((match = clozePattern.exec(text)) !== null) {
      const clozeNumber = match[1];
      const clozeText = match[2];
      
      // Handle hints if they exist (e.g., {{c1::answer::hint}})
      const [answer, hint] = clozeText.split('::');
      
      // Only add if not already exists (avoid duplicates)
      if (!clozes.find(c => c.id === clozeNumber)) {
        clozes.push({
          id: clozeNumber,
          text: answer,
          hint: hint || undefined
        });
      }
    }
    
    return clozes.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  };

  const renderClozeCard = () => {
    // Parse the cloze text from the front field
    const clozeText = card.front;
    const clozes = parseClozeText(clozeText);
    
    // If no clozes found, fallback to basic card
    if (clozes.length === 0) {
      return renderBasicCard();
    }
    
    const currentClozeData = clozes[currentCloze];
    
    const renderClozeText = () => {
      let text = clozeText;
      
      // Replace current cloze with blank or answer
      const currentPattern = new RegExp(`{{c${currentCloze + 1}::(.*?)}}`, 'g');
      if (showAnswer) {
        text = text.replace(currentPattern, '<span class="bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded font-semibold text-primary-700 dark:text-primary-300">$1</span>');
      } else {
        text = text.replace(currentPattern, '<span class="bg-neutral-200 dark:bg-neutral-700 px-4 py-1 rounded">___</span>');
      }
      
      // Replace other clozes with their answers
      for (let i = 0; i < clozes.length; i++) {
        if (i !== currentCloze) {
          const pattern = new RegExp(`{{c${i + 1}::(.*?)}}`, 'g');
          text = text.replace(pattern, '$1');
        }
      }
      
      return { __html: text };
    };

    return (
      <div className="text-center">
        <div className="text-2xl leading-relaxed text-neutral-800 dark:text-neutral-200 mb-6">
          <div dangerouslySetInnerHTML={renderClozeText()} />
        </div>

        {clozes.length > 1 && (
          <div className="flex justify-center space-x-2 mb-6">
            {clozes.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCloze(index)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 ${
                  index === currentCloze
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}

        {!showAnswer && (
          <button
            onClick={onShowAnswer}
            className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg text-lg"
          >
            Show Answer
          </button>
        )}

        {showAnswer && currentClozeData?.hint && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 mt-4">
            <p className="text-primary-700 dark:text-primary-300 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              {currentClozeData.hint}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderImageOcclusionCard = () => {
    // Parse the image occlusion data from the front field
    let imageCard: ImageOcclusionCard;
    
    try {
      // Always parse JSON data from front field for image occlusion cards
      // The occlusions data is stored in the front field as JSON
      const frontData = JSON.parse(card.front);
      
      imageCard = {
        ...card,
        type: 'image-occlusion',
        image: frontData.image,
        question: frontData.question,
        occlusions: frontData.occlusions || []
      } as ImageOcclusionCard;
    } catch (error) {
      console.error('Failed to parse image occlusion data:', error);
      return <div className="text-center text-red-500">Error loading image occlusion card</div>;
    }

    // Ensure occlusions array exists
    if (!imageCard.occlusions || !Array.isArray(imageCard.occlusions)) {
      console.error('Invalid occlusions data:', imageCard.occlusions);
      return <div className="text-center text-red-500">Invalid occlusion data</div>;
    }

    // Generate a fresh signed URL for the image if needed
    const [imageUrl, setImageUrl] = useState<string>('');
    
    useEffect(() => {
      const getImageUrl = async () => {
        try {
          // Extract the file path from the stored URL
          const originalUrl = imageCard.image;
          
          // If it's already a signed URL that's working, use it
          if (originalUrl.includes('supabase.co/storage/v1/object/sign/')) {
            // Extract the file path from the signed URL
            const pathMatch = originalUrl.match(/\/images\/([^?]+)/);
            if (pathMatch) {
              const filePath = pathMatch[1];
              console.log('🔄 Generating fresh signed URL for:', filePath);
              
              // Generate a new signed URL
              const { data, error } = await supabase.storage
                .from('images')
                .createSignedUrl(filePath, 3600); // 1 hour expiry
              
              if (data) {
                setImageUrl(data.signedUrl);
                console.log('✅ Generated fresh signed URL:', data.signedUrl);
              } else {
                console.error('❌ Failed to generate signed URL:', error);
                setImageUrl(originalUrl); // Fallback to original
              }
            } else {
              setImageUrl(originalUrl); // Fallback to original
            }
          } else {
            setImageUrl(originalUrl); // Use original if not a signed URL
          }
        } catch (error) {
          console.error('❌ Error generating image URL:', error);
          setImageUrl(imageCard.image); // Fallback to original
        }
      };
      
      getImageUrl();
    }, [imageCard.image]);
    
    const toggleOcclusion = (occlusionId: string) => {
      setHiddenOcclusions(prev => 
        prev.includes(occlusionId) 
          ? prev.filter(id => id !== occlusionId)
          : [...prev, occlusionId]
      );
    };

    return (
      <div className="text-center">
        {imageCard.question && (
          <div className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
            {imageCard.question}
          </div>
        )}
        
        <div className="relative inline-block mb-6">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Study diagram"
              className="max-w-full h-auto rounded-xl shadow-lg"
              onError={(e) => {
                console.error('❌ Image failed to load:', imageUrl);
                console.error('Error details:', e);
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', imageUrl);
              }}
            />
          ) : (
            <div className="w-64 h-32 bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center">
              <span className="text-gray-500 dark:text-gray-400">Loading image...</span>
            </div>
          )}
          
          {imageCard.occlusions.map((occlusion) => {
            const occlusionColor = occlusion.color || '#3B82F6'; // Default blue
            const isRevealed = showAnswer || hiddenOcclusions.includes(occlusion.id);
            
            console.log('🎯 Rendering occlusion:', {
              id: occlusion.id,
              x: occlusion.x,
              y: occlusion.y,
              width: occlusion.width,
              height: occlusion.height,
              label: occlusion.label,
              color: occlusionColor,
              isRevealed,
              showAnswer,
              hiddenOcclusions
            });
            
            return (
              <div
                key={occlusion.id}
                className="absolute cursor-pointer transition-all duration-200 border-2"
                style={{
                  left: `${occlusion.x}%`,
                  top: `${occlusion.y}%`,
                  width: `${occlusion.width}%`,
                  height: `${occlusion.height}%`,
                  borderColor: isRevealed ? occlusionColor : '#ff0000', // Red border for debugging
                  backgroundColor: isRevealed 
                    ? `${occlusionColor}33` // 20% opacity when revealed
                    : 'rgba(0, 0, 0, 0.9)', // Dark overlay when hidden
                  zIndex: 10,
                  minWidth: '20px',
                  minHeight: '20px',
                  boxShadow: isRevealed ? 'none' : '0 0 0 2px rgba(255, 0, 0, 0.5)' // Red outline for debugging
                }}
                onClick={() => toggleOcclusion(occlusion.id)}
                title={showAnswer ? occlusion.label : 'Click to reveal'}
                onMouseEnter={(e) => {
                  if (!isRevealed) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isRevealed) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                  }
                }}
              >
                {isRevealed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span 
                      className="text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded"
                      style={{ 
                        color: 'white',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                    >
                      {occlusion.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!showAnswer && (
          <div className="space-y-4">
            <button
              onClick={onShowAnswer}
              className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg text-lg"
            >
              Show All Labels
            </button>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Click on areas to reveal individual labels
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderTypeInCard = () => {
    let typeCard = card as TypeInCard;
    
    // If the card data isn't transformed yet, try to parse it from the back field
    if (!typeCard.answer || !typeCard.question) {
      if (typeCard.back && typeof typeCard.back === 'string') {
        try {
          const typeInData = JSON.parse(typeCard.back);
          typeCard = {
            ...typeCard,
            question: typeCard.front,
            answer: typeInData.answer || '',
            acceptableAnswers: typeInData.acceptableAnswers || [],
            caseSensitive: typeInData.caseSensitive || false
          };
        } catch (jsonError) {
          console.warn('Failed to parse type-in JSON:', jsonError);
        }
      }
    }
    
    const checkAnswer = () => {
      if (onAnswer) {
        onAnswer(userInput);
      }
      onShowAnswer();
    };

    const isCorrect = showAnswer && typeCard.answer && (
      userInput.toLowerCase().trim() === typeCard.answer.toLowerCase().trim() ||
      typeCard.acceptableAnswers?.some(answer => 
        typeCard.caseSensitive 
          ? userInput.trim() === answer.trim()
          : userInput.toLowerCase().trim() === answer.toLowerCase().trim()
      )
    );

    return (
      <div className="text-center">
        <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
          {typeCard.question || typeCard.front || 'Question not available'}
        </div>

        {typeCard.image && (
          <div className="flex justify-center mb-6">
            <img
              src={typeCard.image}
              alt="Question illustration"
              className="w-64 h-40 object-cover rounded-xl shadow-lg"
            />
          </div>
        )}

        <div className="max-w-md mx-auto mb-6">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !showAnswer && checkAnswer()}
            placeholder="Type your answer..."
            disabled={showAnswer}
            className="w-full p-4 text-lg text-center border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
          />
        </div>

        {!showAnswer && (
          <button
            onClick={checkAnswer}
            disabled={!userInput.trim()}
            className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Check Answer
          </button>
        )}

        {showAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className={`p-4 rounded-xl ${
              isCorrect 
                ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
                : 'bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800'
            }`}>
              <div className={`text-lg font-semibold ${
                isCorrect ? 'text-success-700 dark:text-success-300' : 'text-error-700 dark:text-error-300'
              }`}>
                {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </div>
              <div className="text-neutral-700 dark:text-neutral-300 mt-2">
                <strong>Correct answer:</strong> {typeCard.answer}
              </div>
              {typeCard.acceptableAnswers && typeCard.acceptableAnswers.length > 0 && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  Also accepted: {typeCard.acceptableAnswers.join(', ')}
                </div>
              )}
            </div>

            {typeCard.hint && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                <p className="text-primary-700 dark:text-primary-300 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 mr-2" />
                  {typeCard.hint}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  };

  const renderAudioCard = () => {
    const audioCard = card as AudioCard;
    
    const toggleAudio = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    return (
      <div className="text-center">
        <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
          {audioCard.question}
        </div>

        <div className="mb-8">
          <button
            onClick={toggleAudio}
            className="w-24 h-24 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center hover:scale-105 transition-all duration-200 shadow-lg mx-auto"
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 text-white" />
            ) : (
              <Play className="w-10 h-10 text-white ml-1" />
            )}
          </button>
          <audio
            ref={audioRef}
            src={audioCard.audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {!showAnswer && (
          <button
            onClick={onShowAnswer}
            className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg text-lg"
          >
            Show Answer
          </button>
        )}

        {showAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {audioCard.answer}
            </div>
            
            {audioCard.transcript && (
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Transcript:</p>
                <p className="text-neutral-600 dark:text-neutral-400 italic">"{audioCard.transcript}"</p>
              </div>
            )}

            {audioCard.hint && (
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                <p className="text-primary-700 dark:text-primary-300 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 mr-2" />
                  {audioCard.hint}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  };

  const renderMultipleChoiceCard = () => {
    let mcCard = card as MultipleChoiceCard;
    
    // If the card data isn't transformed yet, try to parse it from the back field
    if (!mcCard.options || !Array.isArray(mcCard.options) || mcCard.options.length === 0) {
      if (mcCard.back && typeof mcCard.back === 'string') {
        try {
          const mcData = JSON.parse(mcCard.back);
          mcCard = {
            ...mcCard,
            question: mcCard.front,
            options: mcData.options || [],
            correctAnswer: mcData.correctAnswer || 0,
            explanation: mcData.explanation || ''
          };
        } catch (jsonError) {
          console.warn('Failed to parse multiple choice JSON:', jsonError);
        }
      }
    }
    
    // Add defensive checks for card data
    if (!mcCard.options || !Array.isArray(mcCard.options) || mcCard.options.length === 0) {
      console.warn('Multiple choice card missing options:', mcCard);
      return (
        <div className="text-center">
          <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
            {mcCard.question || mcCard.front || 'Question not available'}
          </div>
          <div className="text-red-600 dark:text-red-400">
            Error: No options available for this multiple choice card
          </div>
        </div>
      );
    }
    
    const handleOptionSelect = (optionIndex: number) => {
      setSelectedOption(optionIndex);
      if (onAnswer) {
        onAnswer(optionIndex.toString());
      }
      onShowAnswer();
    };

    return (
      <div className="text-center">
        <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
          {mcCard.question || 'Question not available'}
        </div>

        {mcCard.image && (
          <div className="flex justify-center mb-6">
            <img
              src={mcCard.image}
              alt="Question illustration"
              className="w-64 h-40 object-cover rounded-xl shadow-lg"
            />
          </div>
        )}

        <div className="space-y-3 max-w-2xl mx-auto mb-6">
          {mcCard.options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showAnswer && handleOptionSelect(index)}
              disabled={showAnswer}
              className={`w-full p-4 text-left rounded-xl border-2 transition-all duration-200 ${
                showAnswer
                  ? index === (mcCard.correctAnswer || 0)
                    ? 'bg-success-50 dark:bg-success-900/20 border-success-500 text-success-700 dark:text-success-300'
                    : selectedOption === index
                    ? 'bg-error-50 dark:bg-error-900/20 border-error-500 text-error-700 dark:text-error-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400'
                  : selectedOption === index
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-primary-300 dark:hover:border-primary-600'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                  showAnswer && index === (mcCard.correctAnswer || 0)
                    ? 'bg-success-500 border-success-500 text-white'
                    : showAnswer && selectedOption === index && index !== (mcCard.correctAnswer || 0)
                    ? 'bg-error-500 border-error-500 text-white'
                    : 'border-current'
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="flex-1">{option}</span>
                {showAnswer && index === (mcCard.correctAnswer || 0) && (
                  <span className="text-success-500">✓</span>
                )}
                {showAnswer && selectedOption === index && index !== (mcCard.correctAnswer || 0) && (
                  <span className="text-error-500">✗</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {showAnswer && mcCard.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4"
          >
            <p className="text-primary-700 dark:text-primary-300">
              <strong>Explanation:</strong> {mcCard.explanation}
            </p>
          </motion.div>
        )}

        {showAnswer && mcCard.hint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary-50 dark:bg-secondary-900/20 rounded-xl p-4 mt-4"
          >
            <p className="text-secondary-700 dark:text-secondary-300 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              {mcCard.hint}
            </p>
          </motion.div>
        )}
      </div>
    );
  };

  const renderCard = () => {
    switch (card.type) {
      case 'basic':
        return renderBasicCard();
      case 'cloze':
        return renderClozeCard();
      case 'image-occlusion':
        return renderImageOcclusionCard();
      case 'type-in':
        return renderTypeInCard();
      case 'audio':
        return renderAudioCard();
      case 'multiple-choice':
        return renderMultipleChoiceCard();
      default:
        return renderBasicCard();
    }
  };

  return (
    <div className={`bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-3xl p-8 border border-primary-100 dark:border-neutral-700 shadow-2xl min-h-[400px] flex flex-col justify-center ${className}`}>
      {renderCard()}
    </div>
  );
};

export default CardRenderer;