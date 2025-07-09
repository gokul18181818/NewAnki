import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Save, Upload, X } from 'lucide-react';
import ImageOcclusionEditor from '../components/ImageOcclusionEditor';
import { CardType } from '../types/CardTypes';
import { uploadFile } from '../lib/uploadFile';
import { useUser } from '../contexts/UserContext';

const parseContent = (html: string): { text: string; imageUrl: string | null } => {
  if (!html) return { text: '', imageUrl: null };
  const imgRegex = /<img src="([^"]+)"[^>]*>/;
  const match = html.match(imgRegex);
  if (match && match[1]) {
    const text = html.replace(imgRegex, '').trim();
    return { text, imageUrl: match[1] };
  }
  return { text: html, imageUrl: null };
};

const buildContent = (text?: string, imageUrl?: string | null) => {
    let content = text || '';
    if (imageUrl) {
        content += ` <img src="${imageUrl}" alt="img" style="max-width: 100%; height: auto;" />`;
    }
    return content.trim();
};

const EditCard: React.FC = () => {
  const { deckId, cardId } = useParams<{ deckId: string; cardId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const [cardType, setCardType] = useState<CardType>('basic');
  const [frontText, setFrontText] = useState('');
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backText, setBackText] = useState('');
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Image occlusion specific state
  const [imageQuestion, setImageQuestion] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [occlusions, setOcclusions] = useState<Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    hint?: string;
    color?: string;
  }>>([]);
  
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadCard = async () => {
      if (!cardId) return;
      const { data } = await supabase.from('cards').select('type,front,back').eq('id', cardId).single();
      if (data) {
        setCardType(data.type as CardType);
        
        if (data.type === 'image-occlusion') {
          try {
            const frontData = JSON.parse(data.front);
            setImageQuestion(frontData.question || '');
            setImageUrl(frontData.image || '');
            setOcclusions(frontData.occlusions || []);
          } catch (error) {
            console.error('Failed to parse image occlusion data:', error);
          }
        } else {
          const front = parseContent(data.front);
          const back = parseContent(data.back);
          setFrontText(front.text);
          setFrontImageUrl(front.imageUrl);
          setBackText(back.text);
          setBackImageUrl(back.imageUrl);
        }
      }
      setLoading(false);
    };
    loadCard();
  }, [cardId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      alert('Please sign in first');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image smaller than 5MB');
      return;
    }

    try {
      const signedUrl = await uploadFile('images', file, user.id);
      setImageUrl(signedUrl);
      setUploadedImageFile(file);
      setOcclusions([]); // Clear existing occlusions when new image is uploaded
    } catch (err) {
      console.error('Failed to upload image:', err);
      
      // More detailed error message
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        alert(`Upload failed: ${err.message}`);
      } else {
        console.error('Unknown error:', err);
        alert('Failed to upload image. Please try again.');
      }
    }
  };

  const handleSave = async () => {
    if (!cardId) return;
    
    let newFront: string;
    let newBack: string;
    
    if (cardType === 'image-occlusion') {
      if (!imageUrl || occlusions.length === 0) {
        alert('Please add an image URL and at least one occlusion area');
        return;
      }
      newFront = JSON.stringify({
        question: imageQuestion,
        image: imageUrl,
        occlusions: occlusions
      });
      newBack = 'Image occlusion card';
    } else {
      newFront = buildContent(frontText, frontImageUrl);
      newBack = buildContent(backText, backImageUrl);
    }
    
    await supabase.from('cards').update({ front: newFront, back: newBack }).eq('id', cardId);
    navigate(`/deck/${deckId}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const renderBasicCardEdit = () => (
    <div className="space-y-10">
      {/* Question Section */}
      <section className="bg-white dark:bg-neutral-800/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Question</h2>

        <textarea
          value={frontText}
          onChange={(e) => setFrontText(e.target.value)}
          rows={6}
          placeholder="Enter question text..."
          className="w-full resize-vertical rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        {frontImageUrl && (
          <img
            src={frontImageUrl}
            alt="Question preview"
            className="mt-4 rounded-xl shadow max-h-64 object-contain mx-auto"
          />
        )}

        <input
          type="text"
          placeholder="Image URL (optional)"
          value={frontImageUrl || ''}
          onChange={(e) => setFrontImageUrl(e.target.value)}
          className="mt-4 w-full rounded-lg p-2 bg-neutral-50 dark:bg-neutral-900/40 text-sm border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </section>

      {/* Answer Section */}
      <section className="bg-white dark:bg-neutral-800/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Answer</h2>

        <textarea
          value={backText}
          onChange={(e) => setBackText(e.target.value)}
          rows={6}
          placeholder="Enter answer text..."
          className="w-full resize-vertical rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        {backImageUrl && (
          <img
            src={backImageUrl}
            alt="Answer preview"
            className="mt-4 rounded-xl shadow max-h-64 object-contain mx-auto"
          />
        )}

        <input
          type="text"
          placeholder="Image URL (optional)"
          value={backImageUrl || ''}
          onChange={(e) => setBackImageUrl(e.target.value)}
          className="mt-4 w-full rounded-lg p-2 bg-neutral-50 dark:bg-neutral-900/40 text-sm border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </section>
    </div>
  );

  const renderImageOcclusionEdit = () => (
    <div className="space-y-10">
      {/* Question Section */}
      <section className="bg-white dark:bg-neutral-800/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Question (Optional)</h2>

        <textarea
          value={imageQuestion}
          onChange={(e) => setImageQuestion(e.target.value)}
          rows={2}
          placeholder="What are the labeled parts of this diagram?"
          className="w-full resize-vertical rounded-lg p-3 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </section>

      {/* Image Section */}
      <section className="bg-white dark:bg-neutral-800/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Image</h2>

        {!imageUrl ? (
          <div 
            onClick={() => imageInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
            <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Click to upload an image
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
        ) : (
          <div className="relative">
            <img
              src={imageUrl}
              alt="Uploaded diagram"
              className="w-full max-h-64 object-contain rounded-xl border border-neutral-200 dark:border-neutral-600"
            />
            <button
              onClick={() => {
                setImageUrl('');
                setUploadedImageFile(null);
                setOcclusions([]);
              }}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {uploadedImageFile?.name || 'Current image'}
            </div>
          </div>
        )}
        
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </section>

      {/* Occlusion Editor Section */}
      {imageUrl && (
        <section className="bg-white dark:bg-neutral-800/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm">
          <ImageOcclusionEditor
            imageUrl={imageUrl}
            occlusions={occlusions}
            onOcclusionsChange={setOcclusions}
          />
        </section>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(`/deck/${deckId}`)} className="flex items-center text-primary-600">
          <ArrowLeft className="w-4 h-4 mr-1"/>
          Back to Deck
        </button>
        <h1 className="text-2xl font-bold">Edit {cardType === 'image-occlusion' ? 'Image Occlusion' : 'Basic'} Card</h1>
        <button onClick={handleSave} className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
          <Save className="w-4 h-4 mr-2"/>
          Save
        </button>
      </div>

      {cardType === 'image-occlusion' ? renderImageOcclusionEdit() : renderBasicCardEdit()}
    </div>
  );
};

export default EditCard;
