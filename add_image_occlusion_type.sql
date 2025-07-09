-- Simple migration to add image-occlusion card type support
-- Run this in Supabase SQL Editor

-- Add image-occlusion to the card_type enum
ALTER TYPE card_type ADD VALUE IF NOT EXISTS 'image-occlusion';

-- If the above fails, it means no enum exists, so create a check constraint instead
-- This will run if the ALTER TYPE command fails
DO $$
BEGIN
  -- Check if we need to add a constraint
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_type') THEN
    -- No enum exists, add a check constraint
    ALTER TABLE public.cards ADD CONSTRAINT cards_type_check 
    CHECK (type IN ('basic', 'cloze', 'image-occlusion', 'type-in', 'audio', 'multiple-choice'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle any errors gracefully
  RAISE NOTICE 'Issue adding card type support: %', SQLERRM;
END $$;