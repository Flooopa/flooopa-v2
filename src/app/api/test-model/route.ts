import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { testModel, isConfigured } from '@/lib/ai/client';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { model } = body;

  if (!model || (model !== 'kimi' && model !== 'claude')) {
    return NextResponse.json({ error: 'model must be kimi or claude' }, { status: 400 });
  }

  if (!isConfigured(model)) {
    return NextResponse.json(
      { success: false, error: `${model} API key not configured. Add ${model === 'kimi' ? 'KIMI_CODE_API_KEY' : 'ANTHROPIC_API_KEY'} to your environment variables.` },
      { status: 503 }
    );
  }

  const result = await testModel(model);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
