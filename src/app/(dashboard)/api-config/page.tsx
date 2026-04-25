'use client';

import { useState, useEffect } from 'react';
import { Check, X, Loader2, Globe, AlertTriangle, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function ApiConfigPage() {
  const [kimiStatus, setKimiStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [health, setHealth] = useState<{ kimiConfigured?: boolean; claudeConfigured?: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json().catch(() => null))
      .then((data) => data && setHealth(data))
      .catch(() => {});
  }, []);

  const testModel = async (model: 'kimi' | 'claude') => {
    const setStatus = model === 'kimi' ? setKimiStatus : setClaudeStatus;
    setStatus('loading');
    try {
      const res = await fetch('/api/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        toast.error(data.error || `${model} test failed`);
        return;
      }
      setStatus(data.success ? 'ok' : 'error');
      if (!data.success) {
        toast.error(data.error || `${model} responded with an error`);
      } else {
        toast.success(`${model} is online: "${data.response?.slice(0, 60)}..."`);
      }
    } catch {
      setStatus('error');
      toast.error(`${model} test failed — check API key`);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'ok':
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50"><Check className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><X className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'loading':
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Testing</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not tested</Badge>;
    }
  };

  const ConfigBadge = ({ configured }: { configured?: boolean }) => {
    if (configured === undefined) return null;
    return configured ? (
      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">Key set</Badge>
    ) : (
      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px]">No key</Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test direct connections to Kimi and Claude APIs
        </p>
      </div>

      {/* Status overview */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Connection Mode</span>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]">Gateway</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Next.js proxies AI requests through the AI Gateway backend (port 3001).
          </p>
          {(health && (!health.kimiConfigured || !health.claudeConfigured)) && (
            <div className="mt-3 flex items-start gap-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Missing API keys</p>
                <p className="text-xs mt-1">
                  Add these to your Vercel environment variables:
                </p>
                <ul className="text-xs mt-1 list-disc list-inside space-y-0.5">
                  {!health.kimiConfigured && <li><code>KIMI_CODE_API_KEY</code> — from api.moonshot.cn</li>}
                  {!health.claudeConfigured && <li><code>ANTHROPIC_API_KEY</code> — from console.anthropic.com</li>}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌙</span>
                <span className="font-medium text-sm">Kimi</span>
                <ConfigBadge configured={health?.kimiConfigured} />
              </div>
              <StatusBadge status={kimiStatus} />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Moonshot AI — {process.env.KIMI_MODEL || 'moonshot-v1-8k'}
            </p>
            <Button onClick={() => testModel('kimi')} disabled={kimiStatus === 'loading'} size="sm" variant="outline">
              Test Connection
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <span className="font-medium text-sm">Claude</span>
                <ConfigBadge configured={health?.claudeConfigured} />
              </div>
              <StatusBadge status={claudeStatus} />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Anthropic — {process.env.CLAUDE_MODEL || 'claude-sonnet-4-5'}
            </p>
            <Button onClick={() => testModel('claude')} disabled={claudeStatus === 'loading'} size="sm" variant="outline">
              Test Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
