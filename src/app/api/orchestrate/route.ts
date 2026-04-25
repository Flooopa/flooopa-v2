import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const BACKEND_URL = process.env.AI_GATEWAY_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const skipAuth = process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true';
  if (!userId && !skipAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { task, mode = 'code', planningMode = false, primaryOverride = 'auto' } = body;

  if (!task?.trim()) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 });
  }

  // Start the orchestration on the backend to get a taskId
  const startRes = await fetch(`${BACKEND_URL}/api/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, mode, planningMode, primaryOverride }),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    return NextResponse.json({ error: `Backend error: ${text}` }, { status: 502 });
  }

  const { taskId } = await startRes.json();
  if (!taskId) {
    return NextResponse.json({ error: 'No taskId returned from backend' }, { status: 502 });
  }

  // Return taskId + stream URL so the browser connects directly to Railway
  // (avoids Vercel serverless timeout killing long-running SSE streams)
  return NextResponse.json({
    taskId,
    streamUrl: `${BACKEND_URL}/api/stream/${taskId}`,
  });
}
