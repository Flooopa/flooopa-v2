import { NextRequest, NextResponse } from 'next/server';
  import { auth } from '@clerk/nextjs/server';
import { chatCompletion, isConfigured } from '@/lib/ai/client';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { outputs, mode } = body;

  if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
    return NextResponse.json({ error: 'outputs array required' }, { status: 400 });
  }

  const model = isConfigured('claude') ? 'claude' : 'kimi';
  if (!isConfigured(model)) {
    return NextResponse.json({ error: 'No AI API configured' }, { status: 503 });
  }

  const combined = outputs.map((o: { agent: string; text: string }) => `${o.agent}:\n${o.text}`).join('\n\n---\n\n');

  const result = await chatCompletion(model, [
    {
      role: 'system',
      content: 'You are an editor. Synthesize multiple drafts into one polished final output. Preserve the best ideas, fix inconsistencies, and ensure completeness.',
    },
    {
      role: 'user',
      content: `Synthesize these outputs into a single final version:\n\n${combined}`,
    },
  ]);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ output: result.text, model });
}
