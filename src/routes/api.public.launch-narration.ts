import { createFileRoute } from "@tanstack/react-router";

// Server route that proxies a text-to-speech request to the Lovable AI Gateway.
// Returns a single MP3 file (audio/mpeg). Called by the launch video sequence
// to pre-generate the ceremonial Arabic narration for each scene.
export const Route = createFileRoute("/api/public/launch-narration")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { text?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const text = (body.text ?? "").trim();
        const MAX_TEXT_LEN = 2000;
        if (!text) {
          return new Response(JSON.stringify({ error: "Missing text" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (text.length > MAX_TEXT_LEN) {
          return new Response(
            JSON.stringify({ error: `Text exceeds ${MAX_TEXT_LEN} characters` }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );
        }

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/speech",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              // Voice and instructions are hardcoded server-side to prevent
              // user-controlled prompt injection or arbitrary voice selection.
              voice: "sage",
              response_format: "mp3",
              instructions:
                "تحدّث بالفصحى العربية بنبرة احتفالية رصينة ومهيبة، ببطء واتزان، كأنّك تقدّم حفلًا رسميًا لقبيلة.",
            }),
          },
        );

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          return new Response(
            JSON.stringify({ error: "TTS upstream failed", detail: errText }),
            {
              status: upstream.status,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
