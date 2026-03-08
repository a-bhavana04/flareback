import type { AIEnrichment } from '../types';

const ENRICHMENT_PROMPT = `You are analyzing product feedback about Cloudflare services. Given the following feedback, respond with ONLY a JSON object (no markdown, no explanation) with these fields:
- sentiment: one of "positive", "negative", "neutral", "mixed"
- sentiment_score: a number from -1.0 (very negative) to 1.0 (very positive)
- category: one of "bug", "feature-request", "question", "praise", "complaint", "skip"
- product: the Cloudflare product mentioned (e.g. "Workers", "Pages", "D1", "R2", "KV", "Queues", "Durable Objects", "CDN", "DNS", "WAF", "Zero Trust", "WARP", "Stream", "Images", "General", "Unknown")
- priority: one of "critical", "high", "medium", "low"

CRITICAL: Use category "skip" when the content is NOT substantive product feedback. Skip:
- Short reactions or acknowledgments: "oh totally", "lol", "same", "nice", "agree", "this", "yes", "no", "cool", "thanks"
- One-word or very short replies with no substance
- Content that does not mention or relate to Cloudflare products/services
- Inside jokes, memes, or off-topic banter
- Pure agreement/disagreement without explaining why

Only use "praise", "complaint", "bug", "feature-request", or "question" when there is actual substantive feedback about a Cloudflare product or service.

Feedback title: {title}
Feedback body: {body}
Source: {source}`;

export async function enrichFeedback(
  ai: Ai,
  title: string | undefined,
  body: string | undefined,
  source: string,
): Promise<AIEnrichment> {
  const prompt = ENRICHMENT_PROMPT
    .replace('{title}', title || '(no title)')
    .replace('{body}', (body || '(no body)').slice(0, 1500))
    .replace('{source}', source);

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });

    const text = (response as { response?: string }).response || '';
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultEnrichment();
    }
    const parsed = JSON.parse(jsonMatch[0]) as AIEnrichment;
    // Validate fields
    if (!['positive', 'negative', 'neutral', 'mixed'].includes(parsed.sentiment)) {
      parsed.sentiment = 'neutral';
    }
    if (typeof parsed.sentiment_score !== 'number') {
      parsed.sentiment_score = 0;
    }
    if (!['bug', 'feature-request', 'question', 'praise', 'complaint', 'skip'].includes(parsed.category)) {
      parsed.category = 'question';
    }
    if (!['critical', 'high', 'medium', 'low'].includes(parsed.priority)) {
      parsed.priority = 'medium';
    }
    return parsed;
  } catch (e) {
    console.error('AI enrichment failed:', e);
    return defaultEnrichment();
  }
}

function defaultEnrichment(): AIEnrichment {
  return {
    sentiment: 'neutral',
    sentiment_score: 0,
    category: 'question',
    product: 'Unknown',
    priority: 'medium',
  };
}
