// @ts-ignore - Deno types for Edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared CORS headers
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quality rating mapping (0-3 coming from front-end 😞/😐/😊/😁)
// 0 = complete forgot, 1 = hard, 2 = good, 3 = easy

interface SM2State {
  easeFactor: number;
  interval: number; // days
  reviewCount: number;
}

function sm2Next(state: SM2State, quality: number): { interval: number; ease: number } {
  let { easeFactor, interval, reviewCount } = state;

  // Convert our 0-3 scale to SM-2's 0-5 by stretching
  // 0 -> 0, 1 -> 2, 2 -> 4, 3 -> 5
  const q = [0, 2, 4, 5][quality] ?? 0;

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // Determine next interval
  if (q < 3) {
    // Failed recall -> repeat soon
    interval = 1;
    reviewCount = 0;
  } else if (reviewCount === 0) {
    interval = 1;
    reviewCount = 1;
  } else if (reviewCount === 1) {
    interval = 4;
    reviewCount += 1;
  } else {
    interval = Math.round(interval * easeFactor);
    reviewCount += 1;
  }

  return { interval, ease: easeFactor };
}

// Edge function handler
// Expected body: { card_id: string, rating: number (0-3), time_taken: number }
// Auth header must include user JWT so RLS policies apply.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { card_id, rating, time_taken } = await req.json();
    if (!card_id || rating === undefined) {
      throw new Error("Missing 'card_id' or 'rating'");
    }

    // Create client that forwards the caller's JWT so all operations run under RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Fetch current card state
    const { data: card, error: fetchErr } = await supabase
      .from("cards")
      .select("id, ease_factor, interval, review_count")
      .eq("id", card_id)
      .single();

    if (fetchErr || !card) throw fetchErr ?? new Error("Card not found");

    const current: SM2State = {
      easeFactor: card.ease_factor ?? 2.5,
      interval: card.interval ?? 1,
      reviewCount: card.review_count ?? 0,
    } as SM2State;

    const next = sm2Next(current, rating);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + next.interval);

    // Insert review row (will pass RLS via auth.uid())
    await supabase.from("reviews").insert({
      card_id,
      rating,
      time_taken: time_taken ?? 0,
      interval_before: current.interval,
    });

    // Update card statistics
    const { error: updateErr } = await supabase
      .from("cards")
      .update({
        ease_factor: next.ease,
        interval: next.interval,
        next_due: nextDue.toISOString(),
        review_count: current.reviewCount + 1,
        last_studied: new Date().toISOString(),
      })
      .eq("id", card_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        card_id,
        next_due: nextDue.toISOString(),
        interval: next.interval,
        ease_factor: next.ease,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 400,
    });
  }
}); 