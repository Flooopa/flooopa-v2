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
  WifiOff,
  X,
  History,
  Lightbulb,
  Expand,
  Shrink,
  Download,
  Type,
  ZapOff,
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
import { useConnection } from '@/hooks/useConnection';
import { useSound } from '@/hooks/useSound';

const MODES = [
  { id: 'code', label: 'Code', icon: Zap, desc: 'Coding tasks → Kimi primary', color: 'text-amber-500' },
  { id: 'planning', label: 'Planning', icon: Sparkles, desc: 'Architecture & design → Claude primary', color: 'text-purple-500' },
  { id: 'content', label: 'Content', icon: Send, desc: 'Docs & copy → Claude primary', color: 'text-blue-500' },
  { id: 'research', label: 'Research', icon: Brain, desc: 'Deep investigation → Both', color: 'text-indigo-500' },
  { id: 'debate', label: 'Debate', icon: Flame, desc: 'Multi-round critique', color: 'text-orange-500' },
];

const TEMPLATES = [
  { label: 'Refactor', icon: Zap, text: 'Refactor the following code to be more performant and readable:\n\n```\n// paste code here\n```' },
  { label: 'Debug', icon: AlertCircle, text: 'Debug this error and provide a fix:\n\n```\n// paste error or code here\n```' },
  { label: 'Explain', icon: Brain, text: 'Explain how this works in detail:\n\n```\n// paste code or concept here\n```' },
  { label: 'Test', icon: Check, text: 'Write comprehensive unit tests for:\n\n```\n// paste function here\n```' },
  { label: 'Document', icon: Type, text: 'Write API documentation for:\n\n```\n// paste code here\n```' },
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

interface TaskHistoryItem {
  id: string;
  task: string;
  mode: string;
  timestamp: string;
  success: boolean;
}

function useTaskHistory() {
  const [history, setHistory] = useState<TaskHistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('ai-task-history') || '[]');
    } catch { return []; }
  });

  const add = useCallback((item: TaskHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      localStorage.setItem('ai-task-history', JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('ai-task-history');
  }, []);

  return { history, add, clear };
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
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { state: connectionState, isOnline } = useConnection();
  const { play: playSound } = useSound();
  const { history: taskHistory, add: addToHistory, clear: clearHistory } = useTaskHistory();

  const isBackendDown = connectionState === 'disconnected';
  const isDegraded = connectionState === 'degraded';

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
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setShowLogs((s) => !s);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.location.href = '/status';
      }
      if (e.key === 'Escape') {
        setShowHistory(false);
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const connectStream = useCallback(async (streamUrl: string, taskId: string, signal: AbortSignal) => {
    let reconnectAttempts = 0;
    const maxReconnects = 5;

    while (reconnectAttempts <= maxReconnects) {
      try {
        const streamRes = await fetch(streamUrl, { signal });
        if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);

        const reader = streamRes.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let buffer = '';
        reconnectAttempts = 0; // reset on successful connection

        while (true) {
          if (signal.aborted) return;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
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
                    playSound('complete');
                    toast.success('Pipeline complete!');
                    return; // done
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

        // Stream ended normally
        return;
      } catch (err: any) {
        if (signal.aborted) return;
        reconnectAttempts++;
        if (reconnectAttempts > maxReconnects) {
          throw new Error(`Stream disconnected after ${maxReconnects} reconnection attempts`);
        }
        const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        toast.info(`Reconnecting stream... (${reconnectAttempts}/${maxReconnects})`);
        await sleep(backoff);
      }
    }
  }, [addLog, playSound]);

  const handleOrchestrate = async () => {
    if (!task.trim() || loading) return;

    // Pre-flight: check backend
    if (isBackendDown) {
      toast.error('Backend is unreachable. Check Status page for details.');
      return;
    }

    setLoading(true);
    setAgents({});
    setFinalOutput('');
    setLogs([]);
    setCurrentStep(0);
    setConfidence(null);
    setLastError(null);
    setRetryCount(0);

    const ctrl = new AbortController();
    setAbortController(ctrl);

    const taskItem: TaskHistoryItem = {
      id: Math.random().toString(36).slice(2),
      task: task.trim(),
      mode,
      timestamp: new Date().toISOString(),
      success: false,
    };

    toast.info('Orchestration started...', { duration: 3000 });

    const attempt = async (attemptNum: number): Promise<void> => {
      try {
        const startRes = await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, mode, planningMode, primaryOverride }),
          signal: ctrl.signal,
        });

        if (!startRes.ok) {
          const errText = await startRes.text();
          throw new Error(`HTTP ${startRes.status}: ${errText}`);
        }

        const { taskId, streamUrl } = await startRes.json();
        if (!taskId || !streamUrl) throw new Error('No taskId or streamUrl returned');

        taskItem.id = taskId;
        await connectStream(streamUrl, taskId, ctrl.signal);
        taskItem.success = true;
      } catch (err: any) {
        if (ctrl.signal.aborted) {
          toast.info('Orchestration cancelled');
          return;
        }
        console.error('[ORCH] FAILED (attempt ' + attemptNum + '):', err);
        setLastError(err.message);

        if (attemptNum < 3) {
          const backoff = Math.min(1000 * Math.pow(2, attemptNum), 8000);
          setRetryCount(attemptNum);
          toast.warning(`Retrying in ${backoff}ms... (${attemptNum}/3)`);
          await sleep(backoff);
          return attempt(attemptNum + 1);
        }

        playSound('error');
        toast.error(`Orchestration failed: ${err.message?.slice(0, 100)}`);
        taskItem.success = false;
      }
    };

    await attempt(1);
    addToHistory(taskItem);
    setLoading(false);
    setAbortController(null);
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const copyOutput = async () => {
    if (!finalOutput) return;
    await navigator.clipboard.writeText(finalOutput);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportOutput = () => {
    if (!finalOutput) return;
    const blob = new Blob([finalOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-output-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded as markdown');
  };

  const applyTemplate = (text: string) => {
    setTask(text);
    textareaRef.current?.focus();
  };

  const loadHistoryItem = (item: TaskHistoryItem) => {
    setTask(item.task);
    setMode(item.mode);
    setShowHistory(false);
    textareaRef.current?.focus();
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
      {/* Offline / Connection Banner */}
      {!isOnline && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">You are offline</p>
              <p className="text-xs text-red-600">Check your internet connection. Orchestration is unavailable.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isOnline && isBackendDown && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 flex items-center gap-3">
            <ZapOff className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Backend unreachable</p>
              <p className="text-xs text-red-600">The AI gateway is not responding. Check the Status page.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isOnline && isDegraded && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700">Degraded connectivity</p>
              <p className="text-xs text-amber-600">Some services may be slow or unavailable.</p>
            </div>
          </CardContent>
        </Card>
      )}

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
                {retryCount > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                    Retry {retryCount}/3
                  </Badge>
                )}
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
            disabled={loading}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
              {task.length}
            </span>
            <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              Ctrl+Enter
            </span>
          </div>
        </div>

        {/* Templates & History */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Templates:</span>
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.label}
                onClick={() => applyTemplate(t.text)}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
          <div className="relative">
            <button
              onClick={() => setShowHistory((s) => !s)}
              disabled={taskHistory.length === 0 || loading}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <History className="w-3 h-3" />
              History ({taskHistory.length})
            </button>
            {showHistory && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-card border border-border rounded-md shadow-lg z-50 p-2 space-y-1">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-medium">Recent Tasks</span>
                  <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-600">Clear</button>
                </div>
                {taskHistory.slice(0, 10).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-xs truncate flex items-center gap-2"
                  >
                    {item.success ? (
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                    )}
                    <span className="truncate flex-1">{item.task}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{item.mode}</Badge>
                  </button>
                ))}
              </div>
            )}
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
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50',
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

          <Select value={primaryOverride} onValueChange={(v) => setPrimaryOverride(v as 'auto' | 'kimi' | 'claude')} disabled={loading}>
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
              disabled={loading}
              className="rounded border-input"
            />
            Planning Mode
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleOrchestrate}
            disabled={!task.trim() || loading || isBackendDown || !isOnline}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? 'Orchestrating...' : 'Orchestrate'}
          </Button>
          {loading && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
          )}
          {lastError && !loading && (
            <Button variant="outline" size="sm" onClick={handleOrchestrate} disabled={loading || isBackendDown || !isOnline}>
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700">Orchestration failed</p>
              <p className="text-xs text-red-600 mt-1 break-words">{lastError}</p>
              {retryCount > 0 && (
                <p className="text-xs text-red-500 mt-1">Failed after {retryCount} retry attempts</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      {Object.keys(agents).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(agents).map(([key, agent]) => {
            const meta = AGENT_META[key] || { emoji: '🤖', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
            const isExpanded = expandedAgent === key;
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
                      <button
                        onClick={() => setExpandedAgent(isExpanded ? null : key)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className={cn(
                    'text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed overflow-y-auto transition-all',
                    isExpanded ? 'max-h-[600px]' : 'max-h-48'
                  )}>
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
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={exportOutput}>
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyOutput}>
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-mono text-xs leading-relaxed">{finalOutput}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
