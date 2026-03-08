import type { Env, QueueMessage } from '../types';

const PROMPT = `Generate 5 realistic Cloudflare support tickets as if from real customers. Each ticket must include specific technical details that a support agent would need.

Requirements:
- Mix: 1 critical bug (with error code or steps to reproduce), 1 config/DNS issue, 1 performance complaint (with metrics), 1 billing question, 1 feature request
- Include concrete details: error codes (e.g. 1106, 1014), product names, URLs, timestamps, account IDs
- Subject lines should be specific: "Workers 1106 error on deploy" not "Need help"
- Descriptions 80-250 chars with actionable context
- Company names: mix of startups (Acme Inc, DataFlow.io) and generic (Small Business LLC)

Respond with ONLY a JSON array (no markdown). Each object:
- customer_name: realistic name
- company: company name
- subject: specific subject line
- description: 80-250 chars with technical context
- severity: "critical"|"high"|"medium"|"low"
- product: "Workers"|"Pages"|"R2"|"D1"|"KV"|"DNS"|"CDN"|"WAF"|"Zero Trust"|"WARP"|"Stream"|"Images"|"Load Balancing"|"SSL"
- ticket_type: "bug"|"configuration"|"performance"|"billing"|"feature_request"`;

export async function generateMockTickets(env: Env): Promise<number> {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [{ role: 'user', content: PROMPT }],
      max_tokens: 1500,
    });

    const text = (response as { response?: string }).response || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Mock Tickets: failed to parse AI response');
      return 0;
    }

    const tickets = JSON.parse(jsonMatch[0]) as Array<{
      customer_name: string;
      company: string;
      subject: string;
      description: string;
      severity: string;
      product: string;
      ticket_type: string;
    }>;

    let enqueued = 0;
    for (const ticket of tickets) {
      const id = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const msg: QueueMessage = {
        source: 'support_mock',
        source_id: id,
        title: ticket.subject,
        body: ticket.description.slice(0, 2000),
        author: ticket.customer_name,
        created_at: new Date().toISOString(),
        metadata: {
          company: ticket.company,
          severity: ticket.severity,
          product: ticket.product,
          ticket_type: ticket.ticket_type,
          is_mock: true,
        },
      };

      await env.FEEDBACK_QUEUE.send(msg);
      enqueued++;
    }

    console.log(`Mock Tickets: enqueued ${enqueued} tickets`);
    return enqueued;
  } catch (e) {
    console.error('Mock Tickets generation failed:', e);
    return 0;
  }
}
