// @ts-ignore - Deno global provided at runtime in Supabase Edge Functions environment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// PDF utilities for edge runtime
// @ts-ignore - npm: unpdf provides ESM compatible bundle for Deno
import { extractText, getDocumentProxy } from "npm:unpdf";

// @verify_jwt false

// Shared CORS headers for all responses
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility: call OpenAI ChatCompletion to create flashcards
async function generateFlashcardsFromText(text: string, model: string = "gpt-3.5-turbo-0125") {
  // @ts-ignore - Deno.env available in Edge runtime
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in environment");
  }
  // Trim very long texts to keep tokens reasonable (~8k chars)
  const trimmed = text.length > 12000 ? text.slice(0, 12000) : text;
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are an assistant that extracts factual flashcards from a study document. Each flashcard must be a concise question-answer pair. Return ONLY valid JSON: an array of objects with keys 'front' and 'back'.",
      },
      {
        role: "user",
        content: `Generate flashcards from the following content. Return strictly JSON.\n\n${trimmed}`,
      },
    ],
    temperature: 0.3,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errTxt}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (_) {
    // If the model added markdown, try to extract JSON block
    const match = content.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Failed to parse OpenAI JSON response");
  }
}

// @ts-ignore - Deno global available in Edge runtime
Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { type, source, deck_id } = await req.json();
    if (!type || !source) {
      throw new Error("Missing required parameters 'type' or 'source'");
    }

    let textContent = "";

    if (type === "text") {
      textContent = source as string;
    } else if (type === "pdf") {
      // Use the lightweight `unpdf` library that works in edge environments
      // to extract text via a serverless build of PDF.js.
      const pdfRes = await fetch(source);
      if (!pdfRes.ok) {
        throw new Error(`Failed to download PDF: ${pdfRes.status}`);
      }
      const buffer = new Uint8Array(await pdfRes.arrayBuffer());

      const pdfDoc = await getDocumentProxy(buffer);
      const { text } = await extractText(pdfDoc, { mergePages: true });
      textContent = typeof text === "string" ? text : (text as string[]).join("\n");
    } else {
      throw new Error(`Unsupported type '${type}'`);
    }

    const cards = await generateFlashcardsFromText(textContent);

    return new Response(
      JSON.stringify({ cards, deck_id }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
        status: 200,
      },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
        status: 400,
      },
    );
  }
}); 