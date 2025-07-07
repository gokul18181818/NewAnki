-- Deck analytics RPC
-- Returns JSON summary for dashboard & AdvancedAnalytics component

CREATE OR REPLACE FUNCTION public.deck_analytics(deck_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_learning           int;
  completed_step1          int;
  completed_step2          int;
  step1_rate               numeric;
  step2_rate               numeric;
  avg_lapse                numeric;
  predicted_30             numeric;
  predicted_90             numeric;
  avg_ease                 numeric;
  suggested_ease_adj       numeric;
  suggested_steps          int[];
  confidence               numeric := 0.8;
BEGIN
  /* -------------------------------------------------------
     Learning completion rates: percentage of learning cards
     that have progressed beyond step 0 / 1 respectively.
  ------------------------------------------------------- */
  SELECT count(*)
    INTO total_learning
    FROM cards
   WHERE deck_id = deck_analytics.deck_id
     AND card_state = 'learning';

  SELECT count(*)
    INTO completed_step1
    FROM cards
   WHERE deck_id = deck_analytics.deck_id
     AND card_state = 'learning'
     AND learning_step >= 1;

  SELECT count(*)
    INTO completed_step2
    FROM cards
   WHERE deck_id = deck_analytics.deck_id
     AND card_state = 'learning'
     AND learning_step >= 2;

  IF total_learning > 0 THEN
    step1_rate := round(completed_step1::numeric / total_learning * 100, 2);
    step2_rate := round(completed_step2::numeric / total_learning * 100, 2);
  ELSE
    step1_rate := 100;
    step2_rate := 100;
  END IF;

  /* -------------------------------------------------------
     Retention forecasting – crude heuristic based on lapse counts
  ------------------------------------------------------- */
  SELECT avg(lapse_count)::numeric INTO avg_lapse
    FROM cards
   WHERE deck_id = deck_analytics.deck_id;

  IF avg_lapse IS NULL THEN
    avg_lapse := 0;
  END IF;

  predicted_30 := greatest(50, 100 - (avg_lapse * 5));
  predicted_90 := greatest(30, 100 - (avg_lapse * 8));

  /* -------------------------------------------------------
     Performance optimisation hints – based on ease factor
  ------------------------------------------------------- */
  SELECT avg(ease_factor)::numeric INTO avg_ease
    FROM cards
   WHERE deck_id = deck_analytics.deck_id;

  IF avg_ease IS NULL THEN
    avg_ease := 2.5;  -- default
  END IF;

  suggested_ease_adj := round((2.5 - avg_ease) * 0.1, 2);

  IF avg_ease < 2.2 THEN
    suggested_steps := ARRAY[1,10,30];
  ELSE
    suggested_steps := ARRAY[1,10];
  END IF;

  /* -------------------------------------------------------
     NOTE: stateTransitionHeatmap placeholder until review
           transition logging is added server-side. Empty array
           keeps the key consistent for the client.
  ------------------------------------------------------- */

  RETURN jsonb_build_object(
    'learningCompletionRates', ARRAY[step1_rate, step2_rate],
    'stateTransitionHeatmap', ARRAY[]::jsonb[],
    'retentionForecasting', jsonb_build_object(
      'predicted30Day', predicted_30,
      'predicted90Day', predicted_90,
      'recommendedIntervals', ARRAY[1,3,7,15]
    ),
    'performanceOptimization', jsonb_build_object(
      'suggestedEaseAdjustment', suggested_ease_adj,
      'suggestedLearningSteps', suggested_steps,
      'confidenceScore', confidence
    )
  );
END;
$$;

COMMENT ON FUNCTION public.deck_analytics(uuid)
  IS 'Returns aggregated analytics JSON for the given deck id – consumed by the front-end AdvancedAnalytics component.'; 