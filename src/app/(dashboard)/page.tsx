'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Zap,
  Loader2,
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
  Expand,
  Shrink,
  Download,
  Type,
  ZapOff,
  ListTodo,
  Trash2,
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
import { useTaskManager } from '@/components/TaskManager';

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

const stepLabels = ['Idle', 'Solver', 'Critic', 'Synthesis', 'Complete'];
const stepDescriptions = [
  'Waiting for input',
  'Primary AI is solving...',
  'Secondary AI is reviewing...',
  'Merging best ideas...',
  'Done!',
];

export default function DashboardPage() {
  const [task, setTask] = useState('');
  const [mode, setMode] = useState('code');
  const [planningMode, setPlanningMode] = useState(false);
  const [primaryOverride, setPrimaryOverride] = useState<'auto' | 'kimi' | 'claude'>('auto');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { state: connectionState, isOnline } = useConnection();
  const { play: playSound } = useSound();
  const { tasks, activeTaskId, startTask, cancelTask, clearCompleted } = useTaskManager();

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

  // Auto-select latest running or completed task
  useEffect(() => {
    if (selectedTaskId) return;
    const latest = [...tasks].reverse().find((t) => t.status === 'running' || t.status === 'completed');
    if (latest) setSelectedTaskId(latest.taskId);
  }, [tasks, selectedTaskId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter' && task.trim() && !activeTaskId) {
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
  }, [task, activeTaskId]);

  const selectedTask = tasks.find((t) => t.taskId === selectedTaskId);
  const loading = !!activeTaskId;

  const handleOrchestrate = async () => {
    if (!task.trim() || loading) return;
    if (isBackendDown) {
      toast.error('Backend is unreachable. Check Status page for details.');
      return;
    }
    toast.info('Orchestration started...', { duration: 3000 });
    await startTask({ task, mode, planningMode, primaryOverride });
  };

  const copyOutput = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const exportOutput = (text: string) => {
    const blob = new Blob([text], { type: 'text/markdown' });
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

      {/* Task Selector */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <ListTodo className="w-4 h-4 text-muted-foreground shrink-0" />
          {tasks.slice(-10).map((t) => (
            <button
              key={t.taskId}
              onClick={() => setSelectedTaskId(t.taskId)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0',
                selectedTaskId === t.taskId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {t.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
              {t.status === 'completed' && <Check className="w-3 h-3 text-emerald-500" />}
              {t.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-500" />}
              {t.status === 'cancelled' && <X className="w-3 h-3 text-muted-foreground" />}
              <span className="truncate max-w-[120px]">{t.task}</span>
            </button>
          ))}
          <button
            onClick={clearCompleted}
            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-red-500 shrink-0"
            title="Clear completed tasks"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Selected Task Progress */}
      {selectedTask?.status === 'running' && (
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{stepLabels[selectedTask.currentStep]}</span>
              </div>
              <span className="text-xs text-muted-foreground">{stepDescriptions[selectedTask.currentStep]}</span>
            </div>
            <Progress value={(selectedTask.currentStep / 4) * 100} className="h-1.5" />
            {selectedTask.confidence !== null && (
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-muted-foreground">Confidence: {selectedTask.confidence}/10</span>
                <Progress value={(selectedTask.confidence || 0) * 10} className="h-1 w-24" />
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

        {/* Templates */}
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
          {selectedTask?.status === 'running' && (
            <Button variant="outline" size="sm" onClick={() => cancelTask(selectedTask.taskId)}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
          )}
          {selectedTask?.status === 'failed' && (
            <Button variant="outline" size="sm" onClick={handleOrchestrate} disabled={loading || isBackendDown || !isOnline}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Selected Task Error */}
      {selectedTask?.lastError && selectedTask.status === 'failed' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700">Orchestration failed</p>
              <p className="text-xs text-red-600 mt-1 break-words">{selectedTask.lastError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Task Agent Cards */}
      {selectedTask && Object.keys(selectedTask.agents).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(selectedTask.agents).map(([key, agent]) => {
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

      {/* Selected Task Logs */}
      {selectedTask && selectedTask.logs.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowLogs((s) => !s)}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                Live Logs ({selectedTask.logs.length})
              </h3>
              <span className="text-xs text-muted-foreground">{showLogs ? 'Hide' : 'Show'} (Ctrl+L)</span>
            </div>
          </CardHeader>
          {showLogs && (
            <CardContent className="pt-0">
              <div className="max-h-64 overflow-y-auto space-y-1 text-xs font-mono">
                {selectedTask.logs.map((log) => (
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

      {/* Selected Task Final Output */}
      {selectedTask?.finalOutput && (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Final Output
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => exportOutput(selectedTask.finalOutput)}>
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyOutput(selectedTask.finalOutput)}>
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-mono text-xs leading-relaxed">{selectedTask.finalOutput}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
