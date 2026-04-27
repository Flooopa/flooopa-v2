'use client';

import { useState, useRef } from 'react';
import { Send, Sparkles, Zap, Loader2, Moon, Brain, Flame, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const MODES = [
  { id: 'code', label: 'Code', icon: Zap, desc: 'Coding tasks → Kimi primary' },
  { id: 'planning', label: 'Planning', icon: Sparkles, desc: 'Architecture & design → Claude primary' },
  { id: 'content', label: 'Content', icon: Send, desc: 'Docs & copy → Claude primary' },
  { id: 'research', label: 'Research', icon: Brain, desc: 'Deep investigation → Both' },
  { id: 'debate', label: 'Debate', icon: Flame, desc: 'Multi-round critique' },
];

export default function DashboardPage() {
  const [task, setTask] = useState('');
  const [mode, setMode] = useState('code');
  const [planningMode, setPlanningMode] = useState(false);
  const [primaryOverride, setPrimaryOverride] = useState<'auto' | 'kimi' | 'claude'>('auto');
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Record<string, { status: string; output: string; role: string }>>({});
  const [finalOutput, setFinalOutput] = useState('');
  const [logs, setLogs] = useState<Array<{ id: string; taskId: string; event: string; agent?: string; role?: string; message?: string; error?: string; confidence?: number; round?: number; timestamp: string }>>([]);
  const [showLogs, setShowLogs] = useState(false);

  const addLog = (entry: { taskId: string; event: string; agent?: string; role?: string; message?: string; error?: string; confidence?: number; round?: number }) => {
    const log = { id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), ...entry };
    setLogs((prev) => {
      const next = [...prev, log];
      localStorage.setItem('ai-orchestrator-logs', JSON.stringify(next));
      return next;
    });
  };

  const handleOrchestrate = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    setAgents({});
    setFinalOutput('');
    setLogs([]);

    try {
      console.log('[ORCH] Step 1: POST to /api/orchestrate');
      const startRes = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, mode, planningMode, primaryOverride }),
      });
      console.log('[ORCH] Step 1 response:', startRes.status, startRes.headers.get('content-type'));

      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error('[ORCH] Step 1 failed:', errText);
        throw new Error(`HTTP ${startRes.status}: ${errText}`);
      }

      const { taskId, streamUrl } = await startRes.json();
      console.log('[ORCH] Step 2: got taskId=', taskId, 'streamUrl=', streamUrl);
      if (!taskId || !streamUrl) {
        throw new Error('No taskId or streamUrl returned');
      }

      console.log('[ORCH] Step 3: fetch streamUrl');
      const streamRes = await fetch(streamUrl);
      console.log('[ORCH] Step 3 response:', streamRes.status, streamRes.headers.get('content-type'));
      if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);

      const reader = streamRes.body?.getReader();
      console.log('[ORCH] Step 4: reader=', !!reader);
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[ORCH] Stream done. Events:', eventCount);
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              eventCount++;
              if (event.event === 'heartbeat') continue;
              console.log('[ORCH] Event:', event.event, 'agent=', event.data?.agent);
              if (event.event === 'agent_start') {
                setAgents((prev) => ({
                  ...prev,
                  [event.data.agent]: { status: 'thinking', output: '', role: event.data.role },
                }));
                addLog({ taskId: event.data.taskId, event: 'agent_start', agent: event.data.agent, role: event.data.role, message: event.data.message });
              } else if (event.event === 'agent_stream') {
                setAgents((prev) => ({
                  ...prev,
                  [event.data.agent]: {
                    ...prev[event.data.agent],
                    status: 'streaming',
                    output: event.data.fullText || '',
                  },
                }));
              } else if (event.event === 'agent_complete') {
                setAgents((prev) => ({
                  ...prev,
                  [event.data.agent]: {
                    ...prev[event.data.agent],
                    status: 'complete',
                    output: event.data.fullText || '',
                  },
                }));
                addLog({ taskId: event.data.taskId, event: 'agent_complete', agent: event.data.agent, role: event.data.role, message: `Completed (${event.data.charCount} chars)` });
              } else if (event.event === 'final_output') {
                setFinalOutput(event.data.output || '');
                addLog({ taskId: event.data.taskId, event: 'final_output', message: 'Pipeline complete' });
              } else if (event.event === 'confidence_update') {
                addLog({ taskId: event.data.taskId, event: 'confidence_update', confidence: event.data.confidence, round: event.data.round });
              } else if (event.event === 'error') {
                addLog({ taskId: event.data.taskId, event: 'error', agent: event.data.agent, role: event.data.role, error: event.data.error });
              } else if (event.event === 'warning') {
                addLog({ taskId: event.data.taskId, event: 'warning', agent: event.data.agent, role: event.data.role, message: event.data.message });
              } else if (event.event === 'pipeline_complete') {
                addLog({ taskId: event.data.taskId, event: 'pipeline_complete', message: event.data.message });
              }
            } catch (e) {
              console.error('[ORCH] Parse error:', e, 'line=', line.slice(0, 100));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[ORCH] FAILED:', err);
      toast.error('Orchestration failed. Is the AI Gateway running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Orchestrator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Delegate tasks between Kimi and Claude with intelligent routing
        </p>
      </div>

      {/* Task Input */}
      <div className="space-y-3">
        <Textarea
          placeholder="Describe your task... (e.g., 'Build a React component for a todo list with drag-and-drop')"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="min-h-[120px] resize-y"
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    mode === m.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <Select value={primaryOverride} onValueChange={(v) => setPrimaryOverride(v as 'auto' | 'kimi' | 'claude')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🤖 Auto Assign</SelectItem>
              <SelectItem value="kimi">🌙 Kimi Primary</SelectItem>
              <SelectItem value="claude">⚡ Claude Primary</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={planningMode}
              onChange={(e) => setPlanningMode(e.target.checked)}
              className="rounded border-input"
            />
            Planning Mode
          </label>
        </div>

        <Button onClick={handleOrchestrate} disabled={!task.trim() || loading} size="sm" className="bg-primary hover:bg-primary/90">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {loading ? 'Orchestrating...' : 'Orchestrate'}
        </Button>
      </div>

      {/* Agent Cards */}
      {Object.keys(agents).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(agents).map(([key, agent]) => (
            <Card
              key={key}
              className={cn(
                agent.status === 'streaming' && 'border-primary/50',
                agent.status === 'complete' && 'border-emerald-500/30'
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{key === 'kimi' ? '🌙' : '⚡'}</span>
                    <span className="font-medium capitalize text-sm">{key}</span>
                    <span className="text-xs text-muted-foreground">({agent.role})</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      agent.status === 'complete' && 'text-emerald-600 border-emerald-200 bg-emerald-50',
                      agent.status === 'streaming' && 'text-primary border-primary/20 bg-primary/5',
                      agent.status === 'thinking' && 'text-amber-600 border-amber-200 bg-amber-50',
                      agent.status === 'error' && 'text-red-600 border-red-200 bg-red-50'
                    )}
                  >
                    {agent.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {agent.output || 'Thinking...'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Live Logs Panel */}
      {logs.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowLogs((s) => !s)}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                Live Logs ({logs.length})
              </h3>
              <span className="text-xs text-muted-foreground">{showLogs ? 'Hide' : 'Show'}</span>
            </div>
          </CardHeader>
          {showLogs && (
            <CardContent className="pt-0">
              <div className="max-h-64 overflow-y-auto space-y-1 text-xs font-mono">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={log.event === 'error' ? 'text-red-600' : log.event === 'agent_complete' ? 'text-emerald-600' : 'text-foreground'}>
                      [{log.event}]
                    </span>
                    {log.agent && <span className="text-muted-foreground">{log.agent}</span>}
                    {log.role && <span className="text-muted-foreground">({log.role})</span>}
                    {log.message && <span className="text-muted-foreground truncate">{log.message}</span>}
                    {log.error && <span className="text-red-600 truncate">{log.error}</span>}
                    {typeof log.confidence === 'number' && <span className="text-amber-600">confidence:{log.confidence}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Final Output */}
      {finalOutput && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Final Output
            </h3>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground">{finalOutput}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
