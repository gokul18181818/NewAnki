-- Add image-occlusion to card_type enum
-- This migration adds support for image occlusion cards

-- Create the card_type enum if it doesn't exist
DO $$
BEGIN
  -- First, create the enum type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_type') THEN
    CREATE TYPE card_type AS ENUM ('basic', 'cloze', 'image-occlusion', 'type-in', 'audio', 'multiple-choice');
  ELSE
    -- If enum exists, add image-occlusion if it's not already there
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'card_type' AND e.enumlabel = 'image-occlusion'
    ) THEN
      ALTER TYPE card_type ADD VALUE 'image-occlusion';
    END IF;
  END IF;
END $$;

-- Update the cards table to use the enum type if it's not already
-- This will safely convert the text column to enum
DO $$
BEGIN
  -- Check if the column is already using the enum type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cards' 
    AND column_name = 'type' 
    AND data_type = 'USER-DEFINED'
    AND udt_name = 'card_type'
  ) THEN
    -- Convert the text column to enum
    ALTER TABLE public.cards 
    ALTER COLUMN type TYPE card_type USING type::card_type;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Column type conversion failed, adding constraint instead: %', SQLERRM;
  
  -- Fallback: add a check constraint if enum conversion fails
  ALTER TABLE public.cards ADD CONSTRAINT cards_type_check 
  CHECK (type IN ('basic', 'cloze', 'image-occlusion', 'type-in', 'audio', 'multiple-choice'));
END $$;

COMMENT ON COLUMN public.cards.type IS 'Card type: basic, cloze, image-occlusion, type-in, audio, or multiple-choice';