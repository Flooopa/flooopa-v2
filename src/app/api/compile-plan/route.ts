import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chatCompletion, isConfigured } from '@/lib/ai/client';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { task } = body;

  if (!task?.trim()) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 });
  }

  const model = isConfigured('claude') ? 'claude' : 'kimi';
  if (!isConfigured(model)) {
    return NextResponse.json({ error: 'No AI API configured' }, { status: 503 });
  }

  const result = await chatCompletion(model, [
    {
      role: 'system',
      content: 'You are a project planner. Break down tasks into clear, actionable steps with estimated effort. Return as a numbered list.',
    },
    { role: 'user', content: `Create a detailed implementation plan for: ${task}` },
  ]);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ plan: result.text, model });
}
