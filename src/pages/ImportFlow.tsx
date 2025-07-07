import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileText, 
  Check, 
  X, 
  ArrowRight,
  Sparkles,
  Image,
  AlertCircle,
  CheckCircle,
  Loader,
  ArrowLeft
} from 'lucide-react';
import { useStudy } from '../contexts/StudyContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabaseClient';
import { parseApkg, type ParsedDeck } from '../lib/ankiParser';

type ImportStep = 'upload' | 'processing' | 'review' | 'success' | 'error';

interface ImportProgress {
  step: string;
  progress: number;
  message: string;
}

interface ImportResults {
  totalCards: number;
  decksCreated: number;
  deckNames: string[];
  processingTime: number;
  errors: string[];
}

const ImportFlow: React.FC = () => {
  console.log('ImportFlow component rendering...');
  const navigate = useNavigate();
  const { user } = useUser();
  
  let addDeck, refreshDecks;
  try {
    const studyContext = useStudy();
    addDeck = studyContext.addDeck;
    refreshDecks = studyContext.refreshDecks;
    console.log('StudyContext loaded successfully');
  } catch (error) {
    console.error('Error loading StudyContext:', error);
    // Provide fallback functions
    addDeck = async () => {};
    refreshDecks = async () => {};
  }
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    step: '',
    progress: 0,
    message: '',
  });
  const [importResults, setImportResults] = useState<ImportResults>({
    totalCards: 0,
    decksCreated: 0,
    deckNames: [],
    processingTime: 0,
    errors: [],
  });
  const [parsedDecks, setParsedDecks] = useState<ParsedDeck[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/zip': ['.apkg'],
      'application/x-zip-compressed': ['.apkg'],
    },
    multiple: true,
    onDrop: async (acceptedFiles) => {
      console.log('onDrop called with files:', acceptedFiles);
      if (acceptedFiles.length === 0) {
        console.log('No accepted files, returning');
        return;
      }
      
      console.log('Setting uploaded files and starting processing...');
      setUploadedFiles(acceptedFiles);
      await processFiles(acceptedFiles);
    },
  });

  const processFiles = async (files: File[]) => {
    console.log('processFiles called with:', files.length, 'files');
    const startTime = Date.now();
    setIsProcessing(true);
    setCurrentStep('processing');
    setImportProgress({ step: 'Starting import', progress: 0, message: 'Initializing...' });

    try {
      console.log('Skipping auth check - user already logged in');
      setImportProgress({ step: 'Processing files', progress: 5, message: 'Starting file processing...' });

      let totalCards = 0;
      const createdDecks: string[] = [];
      const errors: string[] = [];
      
      // Process each file
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const fileProgress = (fileIndex / files.length) * 90; // Reserve 10% for finalization
        
        setImportProgress({
          step: `Processing ${file.name}`,
          progress: fileProgress + 5,
          message: `Reading file ${fileIndex + 1} of ${files.length}...`
        });

        try {
          // Parse the .apkg file
          console.log('About to parse file:', file.name);
          
          setImportProgress({
            step: `Processing ${file.name}`,
            progress: fileProgress + 2,
            message: `Parsing ${file.name}...`
          });
          
          const decks = await parseApkg(file);
          console.log('Successfully parsed decks:', decks);
          setParsedDecks(prev => [...prev, ...decks]);

          setImportProgress({
            step: `Processing ${file.name}`,
            progress: fileProgress + 10,
            message: `Found ${decks.length} deck(s) with ${decks.reduce((sum, d) => sum + d.cards.length, 0)} cards`
          });

          // Create decks in Supabase
          console.log('About to create decks in Supabase:', decks.length);
          for (const deck of decks) {
            if (deck.cards.length === 0) {
              errors.push(`Deck "${deck.name}" has no cards, skipping`);
              continue;
            }

            console.log(`Creating deck "${deck.name}" with ${deck.cards.length} cards`);
            // Create deck
            const { data: newDeck, error: deckError } = await supabase
              .from('decks')
              .insert({
                owner_id: user?.id,
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

            setImportProgress({
              step: `Importing cards`,
              progress: fileProgress + 20,
              message: `Created deck "${deck.name}", importing ${deck.cards.length} cards...`
            });

            // Insert cards in batches to avoid timeout
            const batchSize = 500;
            for (let i = 0; i < deck.cards.length; i += batchSize) {
              const batch = deck.cards.slice(i, i + batchSize);
              const cardRows = batch.map((card) => {
                // Convert images to data URLs for display
                const processImages = (images?: string[], media?: Record<string, string>) => {
                  if (!images || !media) return [];
                  return images.map(imgSrc => {
                    if (media[imgSrc]) {
                      // Determine mime type based on file extension
                      const ext = imgSrc.split('.').pop()?.toLowerCase();
                      const mimeType = ext === 'png' ? 'image/png' : 
                                     ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                                     ext === 'gif' ? 'image/gif' :
                                     ext === 'webp' ? 'image/webp' : 'image/png';
                      return `data:${mimeType};base64,${media[imgSrc]}`;
                    }
                    return imgSrc;
                  });
                };

                const frontImages = processImages(card.frontImages, card.media);
                const backImages = processImages(card.backImages, card.media);

                // Replace [IMAGE: filename] placeholders with actual image tags
                let processedFront = card.front || 'No front content';
                let processedBack = card.back || 'No back content';

                if (frontImages.length > 0) {
                  card.frontImages?.forEach((imgSrc, index) => {
                    if (frontImages[index]) {
                      processedFront = processedFront.replace(
                        `[IMAGE: ${imgSrc}]`,
                        `<img src="${frontImages[index]}" alt="${imgSrc}" style="max-width: 100%; height: auto;" />`
                      );
                    }
                  });
                }

                if (backImages.length > 0) {
                  card.backImages?.forEach((imgSrc, index) => {
                    if (backImages[index]) {
                      processedBack = processedBack.replace(
                        `[IMAGE: ${imgSrc}]`,
                        `<img src="${backImages[index]}" alt="${imgSrc}" style="max-width: 100%; height: auto;" />`
                      );
                    }
                  });
                }

                return {
                  deck_id: deckId,
                  type: 'basic',
                  front: processedFront,
                  back: processedBack,
                  tags: [],
                  difficulty: 0,
                  last_studied: null,
                  next_due: new Date().toISOString(),
                  interval: 1,
                  ease_factor: 2.5,
                  review_count: 0,
                };
              });

              const { error: cardsError } = await supabase
                .from('cards')
                .insert(cardRows);

              if (cardsError) {
                throw new Error(`Failed to insert cards for deck "${deck.name}": ${cardsError.message}`);
              }

              const cardsProgress = (i + batch.length) / deck.cards.length;
              setImportProgress({
                step: `Importing cards`,
                progress: fileProgress + 20 + (cardsProgress * 60),
                message: `Imported ${i + batch.length}/${deck.cards.length} cards for "${deck.name}"`
              });
            }

            totalCards += deck.cards.length;

            // Note: Card counts are computed dynamically when decks are loaded
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          const errorMessage = (fileError as Error).message;
          errors.push(`${file.name}: ${errorMessage}`);
          
          setImportProgress({
            step: `Error processing ${file.name}`,
            progress: fileProgress,
            message: `Error: ${errorMessage}`
          });
          
          // Continue with next file instead of stopping completely
          continue;
        }
      }

      // Finalization
      setImportProgress({
        step: 'Finalizing',
        progress: 95,
        message: 'Completing import...'
      });

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      setImportResults({
        totalCards,
        decksCreated: createdDecks.length,
        deckNames: createdDecks,
        processingTime,
        errors,
      });

      setImportProgress({
        step: 'Complete',
        progress: 100,
        message: `Successfully imported ${totalCards} cards in ${createdDecks.length} deck(s)`
      });

      // Refresh the decks in StudyContext so they appear in Today's Study
      console.log('Refreshing decks after import...');
      await refreshDecks();

      if (errors.length > 0 && createdDecks.length === 0) {
        setCurrentStep('error');
        setErrorMessage(`Import failed: ${errors.join(', ')}`);
      } else {
        setCurrentStep(errors.length > 0 ? 'review' : 'success');
      }

    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = (error as Error).message;
      console.error('Detailed error:', errorMessage);
      
      setImportProgress({
        step: 'Import Failed',
        progress: 0,
        message: `Error: ${errorMessage}`
      });
      
      setCurrentStep('error');
      setErrorMessage(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTryAgain = () => {
    setCurrentStep('upload');
    setUploadedFiles([]);
    setImportResults({
      totalCards: 0,
      decksCreated: 0,
      deckNames: [],
      processingTime: 0,
      errors: [],
    });
    setParsedDecks([]);
    setErrorMessage('');
    setImportProgress({ step: '', progress: 0, message: '' });
  };

  const handleContinue = () => {
    setCurrentStep('success');
  };

  const renderUploadStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="text-center max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200">
          Import Anki Decks
        </h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        Upload your .apkg files to import your Anki decks and cards
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-3xl p-16 transition-all duration-300 cursor-pointer ${
          isDragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <motion.div
            animate={{ 
              scale: isDragActive ? 1.1 : 1,
              rotate: isDragActive ? 5 : 0 
            }}
            transition={{ duration: 0.2 }}
            className="w-24 h-24 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <Upload className="w-12 h-12 text-white" />
          </motion.div>
          <p className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            {isDragActive ? 'Drop your files here' : 'Drop your .apkg files here'}
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            or click to browse
          </p>
          <p className="text-primary-600 dark:text-primary-400 font-medium">
            Multiple files supported! 📚
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">What happens during import:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-primary-500" />
              <span className="text-neutral-600 dark:text-neutral-400">Parse .apkg files</span>
            </div>
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4 text-primary-500" />
              <span className="text-neutral-600 dark:text-neutral-400">Create decks & cards</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-primary-500" />
              <span className="text-neutral-600 dark:text-neutral-400">Ready to study!</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              const el = document.querySelector('input[type="file"]') as HTMLInputElement | null;
              el?.click();
            }}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg"
          >
            Browse Files
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
          >
            Skip for now
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderProcessingStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="text-center max-w-2xl mx-auto"
    >
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        <Loader className="inline w-8 h-8 animate-spin mr-2" />
        Processing your files...
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        Importing {uploadedFiles.length} file(s) - this may take a moment
      </p>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-lg">
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            <span>{importProgress.step}</span>
            <span>{importProgress.progress}% complete</span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-600 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${importProgress.progress}%` }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full"
            />
          </div>
        </div>

        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
          <p className="text-primary-700 dark:text-primary-300 font-medium">
            {importProgress.message}
          </p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-neutral-700 dark:text-neutral-300 mb-3">Files being processed:</h4>
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-neutral-600 dark:text-neutral-400">{file.name}</span>
                  <span className="text-neutral-500">({Math.round(file.size / 1024)} KB)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  const renderReviewStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="text-center max-w-3xl mx-auto"
    >
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        Import completed with warnings
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        Your decks were imported but some issues were encountered
      </p>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-warning-200 dark:border-warning-800 shadow-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="text-center p-4 bg-success-50 dark:bg-success-900/20 rounded-xl">
            <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-success-700 dark:text-success-400">{importResults.totalCards}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">cards imported</p>
          </div>
          <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
            <Sparkles className="w-12 h-12 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">{importResults.decksCreated}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">decks created</p>
          </div>
        </div>

        {importResults.deckNames.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Successfully imported decks:</h3>
            <div className="flex flex-wrap gap-2">
              {importResults.deckNames.map((name, index) => (
                <span key={index} className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-sm">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {importResults.errors.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center">
              <AlertCircle className="w-5 h-5 text-warning-500 mr-2" />
              Issues encountered:
            </h3>
            <div className="space-y-2">
              {importResults.errors.map((error, index) => (
                <div key={index} className="p-3 bg-warning-50 dark:bg-warning-900/20 border-l-4 border-warning-400 rounded text-left">
                  <p className="text-sm text-warning-700 dark:text-warning-300">{error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          Import completed in {importResults.processingTime} seconds
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg flex items-center justify-center space-x-2"
        >
          <Check className="w-5 h-5" />
          <span>Continue to Dashboard</span>
        </button>
        <button
          onClick={handleTryAgain}
          className="px-8 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
        >
          Import More Files
        </button>
      </div>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="text-center max-w-2xl mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-24 h-24 bg-gradient-to-r from-success-500 to-primary-500 rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <span className="text-4xl">🎉</span>
      </motion.div>

      <h2 className="text-4xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        Import Successful!
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        {importResults.totalCards} cards imported across {importResults.decksCreated} deck(s)
      </p>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-success-100 dark:border-success-800 shadow-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="text-center p-4 bg-success-50 dark:bg-success-900/20 rounded-xl">
            <FileText className="w-12 h-12 text-success-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-success-700 dark:text-success-400">{importResults.totalCards}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">cards ready to study</p>
          </div>
          <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
            <Sparkles className="w-12 h-12 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">{importResults.decksCreated}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">new decks available</p>
          </div>
        </div>

        {importResults.deckNames.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Your new decks:</h3>
            <div className="space-y-2">
              {importResults.deckNames.map((name, index) => (
                <div key={index} className="flex items-center justify-center space-x-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📚</span>
                  </div>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          ⚡ Completed in {importResults.processingTime} seconds
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg flex items-center justify-center space-x-2"
        >
          <span>Start Studying</span>
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={handleTryAgain}
          className="px-8 py-3 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg"
        >
          Import More Decks
        </button>
      </div>
    </motion.div>
  );

  const renderErrorStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="text-center max-w-2xl mx-auto"
    >
      <div className="w-24 h-24 bg-gradient-to-r from-error-500 to-warning-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <X className="w-12 h-12 text-white" />
      </div>

      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        Import Failed
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        We encountered an error while importing your files
      </p>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-error-200 dark:border-error-800 shadow-lg mb-8">
        <div className="p-4 bg-error-50 dark:bg-error-900/20 border-l-4 border-error-400 rounded mb-6">
          <h3 className="font-semibold text-error-700 dark:text-error-300 mb-2">Error Details:</h3>
          <p className="text-error-600 dark:text-error-400">{errorMessage}</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Common solutions:</h3>
          <div className="text-left space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
              <span>Make sure you're uploading valid .apkg files exported from Anki</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
              <span>Check that your files aren't corrupted or too large</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
              <span>Ensure you have a stable internet connection</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
              <span>Try importing one file at a time if importing multiple</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleTryAgain}
          className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg"
        >
          Try Again
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-8 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {currentStep === 'upload' && (
            <motion.div key="upload">
              {renderUploadStep()}
            </motion.div>
          )}
          {currentStep === 'processing' && (
            <motion.div key="processing">
              {renderProcessingStep()}
            </motion.div>
          )}
          {currentStep === 'review' && (
            <motion.div key="review">
              {renderReviewStep()}
            </motion.div>
          )}
          {currentStep === 'success' && (
            <motion.div key="success">
              {renderSuccessStep()}
            </motion.div>
          )}
          {currentStep === 'error' && (
            <motion.div key="error">
              {renderErrorStep()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ImportFlow;