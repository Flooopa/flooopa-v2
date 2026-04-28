'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send,
  Sparkles,
  Zap,
  Loader2,
  Moon,
  Brain,
  Flame,
  Terminal,
  Copy,
  Check,
  RotateCcw,
  Keyboard,
  AlertCircle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const MODES = [
  { id: 'code', label: 'Code', icon: Zap, desc: 'Coding tasks → Kimi primary', color: 'text-amber-500' },
  { id: 'planning', label: 'Planning', icon: Sparkles, desc: 'Architecture & design → Claude primary', color: 'text-purple-500' },
  { id: 'content', label: 'Content', icon: Send, desc: 'Docs & copy → Claude primary', color: 'text-blue-500' },
  { id: 'research', label: 'Research', icon: Brain, desc: 'Deep investigation → Both', color: 'text-indigo-500' },
  { id: 'debate', label: 'Debate', icon: Flame, desc: 'Multi-round critique', color: 'text-orange-500' },
];

const AGENT_META: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  kimi: { emoji: '🌙', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  claude: { emoji: '⚡', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

interface AgentState {
  status: string;
  output: string;
  role: string;
}

interface LogEntry {
  id: string;
  taskId: string;
  event: string;
  agent?: string;
  role?: string;
  message?: string;
  error?: string;
  confidence?: number;
  round?: number;
  timestamp: string;
}

export default function DashboardPage() {
  const [task, setTask] = useState('');
  const [mode, setMode] = useState('code');
  const [planningMode, setPlanningMode] = useState(false);
  const [primaryOverride, setPrimaryOverride] = useState<'auto' | 'kimi' | 'claude'>('auto');
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Record<string, AgentState>>({});
  const [finalOutput, setFinalOutput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save task to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-orchestrator-task-draft');
    if (saved) setTask(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('ai-orchestrator-task-draft', task);
  }, [task]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && task.trim() && !loading) {
        e.preventDefault();
        handleOrchestrate();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setShowLogs((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [task, loading]);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const log: LogEntry = { id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), ...entry };
    setLogs((prev) => {
      const next = [...prev, log];
      localStorage.setItem('ai-orchestrator-logs', JSON.stringify(next));
      return next;
    });
    return log;
  }, []);

  const determineStep = (role?: string, event?: string) => {
    if (event === 'pipeline_complete') return 4;
    if (role === 'synthesizer' || role === 'final-merger') return 3;
    if (role === 'critic' || role === 'devil' || role === 'reviewer') return 2;
    if (role === 'solver' || role === 'architect' || role === 'reviser') return 1;
    return 0;
  };

  const handleOrchestrate = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    setAgents({});
    setFinalOutput('');
    setLogs([]);
    setCurrentStep(0);
    setConfidence(null);
    setLastError(null);

    toast.info('Orchestration started...', { duration: 3000 });

    try {
      const startRes = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, mode, planningMode, primaryOverride }),
      });

      if (!startRes.ok) {
        const errText = await startRes.text();
        throw new Error(`HTTP ${startRes.status}: ${errText}`);
      }

      const { taskId, streamUrl } = await startRes.json();
      if (!taskId || !streamUrl) throw new Error('No taskId or streamUrl returned');

      const streamRes = await fetch(streamUrl);
      if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);

      const reader = streamRes.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      let eventCount = 0;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              eventCount++;
              if (event.event === 'heartbeat') continue;

              switch (event.event) {
                case 'agent_start': {
                  setAgents((prev) => ({
                    ...prev,
                    [event.data.agent]: { status: 'thinking', output: '', role: event.data.role },
                  }));
                  addLog({ taskId: event.data.taskId, event: 'agent_start', agent: event.data.agent, role: event.data.role, message: event.data.message });
                  setCurrentStep(determineStep(event.data.role));
                  break;
                }
                case 'agent_stream': {
                  setAgents((prev) => ({
                    ...prev,
                    [event.data.agent]: {
                      ...prev[event.data.agent],
                      status: 'streaming',
                      output: event.data.fullText || '',
                    },
                  }));
                  break;
                }
                case 'agent_complete': {
                  setAgents((prev) => ({
                    ...prev,
                    [event.data.agent]: {
                      ...prev[event.data.agent],
                      status: 'complete',
                      output: event.data.fullText || '',
                    },
                  }));
                  addLog({ taskId: event.data.taskId, event: 'agent_complete', agent: event.data.agent, role: event.data.role, message: `Completed (${event.data.charCount} chars)` });
                  toast.success(`${event.data.agent === 'kimi' ? 'Kimi' : 'Claude'} completed as ${event.data.role}`);
                  break;
                }
                case 'confidence_update': {
                  setConfidence(event.data.confidence);
                  addLog({ taskId: event.data.taskId, event: 'confidence_update', confidence: event.data.confidence, round: event.data.round });
                  break;
                }
                case 'final_output': {
                  setFinalOutput(event.data.output || '');
                  setCurrentStep(4);
                  addLog({ taskId: event.data.taskId, event: 'final_output', message: 'Pipeline complete' });
                  toast.success('Pipeline complete!');
                  break;
                }
                case 'error': {
                  addLog({ taskId: event.data.taskId, event: 'error', agent: event.data.agent, role: event.data.role, error: event.data.error });
                  toast.error(`${event.data.agent || 'System'} error: ${event.data.error?.slice(0, 80)}`);
                  setLastError(event.data.error);
                  break;
                }
                case 'warning': {
                  addLog({ taskId: event.data.taskId, event: 'warning', agent: event.data.agent, role: event.data.role, message: event.data.message });
                  toast.warning(event.data.message);
                  break;
                }
                case 'pipeline_complete': {
                  addLog({ taskId: event.data.taskId, event: 'pipeline_complete', message: event.data.message });
                  break;
                }
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[ORCH] FAILED:', err);
      setLastError(err.message);
      toast.error(`Orchestration failed: ${err.message?.slice(0, 100)}`);
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!finalOutput) return;
    await navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const stepLabels = ['Idle', 'Solver', 'Critic', 'Synthesis', 'Complete'];
  const stepDescriptions = [
    'Waiting for input',
    'Primary AI is solving...',
    'Secondary AI is reviewing...',
    'Merging best ideas...',
    'Done!',
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Orchestrator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Delegate tasks between Kimi and Claude with intelligent routing
        </p>
      </div>

      {/* Pipeline Progress */}
      {loading && (
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{stepLabels[currentStep]}</span>
              </div>
              <span className="text-xs text-muted-foreground">{stepDescriptions[currentStep]}</span>
            </div>
            <Progress value={(currentStep / 4) * 100} className="h-1.5" />
            {confidence !== null && (
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-muted-foreground">Confidence: {confidence}/10</span>
                <Progress value={confidence * 10} className="h-1 w-24" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task Input */}
      <div className="space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Describe your task... (e.g., 'Build a React component for a todo list with drag-and-drop')"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="min-h-[120px] resize-y pr-20"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
            <Keyboard className="w-3 h-3" />
            Ctrl+Enter
          </div>
        </div>

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
                  title={m.desc}
                >
                  <Icon className={cn('w-3.5 h-3.5', mode === m.id && m.color)} />
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

        <div className="flex gap-2">
          <Button
            onClick={handleOrchestrate}
            disabled={!task.trim() || loading}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'Orchestrating...' : 'Orchestrate'}
          </Button>
          {lastError && (
            <Button variant="outline" size="sm" onClick={handleOrchestrate} disabled={loading}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {lastError && !loading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Orchestration failed</p>
              <p className="text-xs text-red-600 mt-1">{lastError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      {Object.keys(agents).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(agents).map(([key, agent]) => {
            const meta = AGENT_META[key] || { emoji: '🤖', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
            return (
              <Card
                key={key}
                className={cn(
                  'transition-all duration-300',
                  agent.status === 'streaming' && 'border-primary/50 shadow-sm',
                  agent.status === 'complete' && 'border-emerald-500/30',
                  agent.status === 'error' && 'border-red-200'
                )}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.emoji}</span>
                      <div>
                        <span className="font-medium capitalize text-sm">{key}</span>
                        <div className="flex items-center gap-1">
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{agent.role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.status === 'streaming' && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          agent.status === 'complete' && 'text-emerald-600 border-emerald-200 bg-emerald-50',
                          agent.status === 'streaming' && 'text-primary border-primary/20 bg-primary/5',
                          agent.status === 'thinking' && 'text-amber-600 border-amber-200 bg-amber-50',
                          agent.status === 'error' && 'text-red-600 border-red-200 bg-red-50'
                        )}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs leading-relaxed">
                    {agent.output || (
                      <span className="italic text-muted-foreground/60">Thinking...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
              <span className="text-xs text-muted-foreground">{showLogs ? 'Hide' : 'Show'} (Ctrl+L)</span>
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
                    {log.agent && <span className={cn('font-medium', log.agent === 'kimi' ? 'text-amber-600' : 'text-purple-600')}>{log.agent}</span>}
                    {log.role && <span className="text-muted-foreground">({log.role})</span>}
                    {log.message && <span className="text-muted-foreground truncate">{log.message}</span>}
                    {log.error && <span className="text-red-600 truncate">{log.error}</span>}
                    {typeof log.confidence === 'number' && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {log.confidence}/10
                      </span>
                    )}
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Final Output
            </h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyOutput}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-mono text-xs leading-relaxed">{finalOutput}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
