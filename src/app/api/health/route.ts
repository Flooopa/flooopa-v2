import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/ai/client';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    mode: 'gateway',
    kimiConfigured: isConfigured('kimi'),
    claudeConfigured: isConfigured('claude'),
  });
}
