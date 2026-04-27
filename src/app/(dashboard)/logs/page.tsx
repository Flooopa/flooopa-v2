'use client';

import { useEffect, useState } from 'react';
import { Trash2, Download, Terminal, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  duration?: number;
  timestamp: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'kimi' | 'claude' | 'error'>('all');

  useEffect(() => {
    const stored = localStorage.getItem('ai-orchestrator-logs');
    if (stored) {
      try {
        setLogs(JSON.parse(stored));
      } catch {
        setLogs([]);
      }
    }
  }, []);

  function clearLogs() {
    localStorage.removeItem('ai-orchestrator-logs');
    setLogs([]);
  }

  function downloadLogs() {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orchestrator-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.event === 'error' || !!log.error;
    return log.agent === filter;
  });

  const grouped = filtered.reduce<Record<string, LogEntry[]>>((acc, log) => {
    if (!acc[log.taskId]) acc[log.taskId] = [];
    acc[log.taskId].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Orchestration Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Debug output from AI agent runs. Logs are stored locally in your browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadLogs} disabled={logs.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} disabled={logs.length === 0} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'kimi', 'claude', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border',
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground'
            )}
          >
            {f === 'all' && 'All'}
            {f === 'kimi' && '🌙 Kimi'}
            {f === 'claude' && '⚡ Claude'}
            {f === 'error' && 'Errors'}
            <span className="ml-1.5 text-xs opacity-70">
              ({f === 'all' ? logs.length : logs.filter((l) => (f === 'error' ? l.event === 'error' || !!l.error : l.agent === f)).length})
            </span>
          </button>
        ))}
      </div>

      {logs.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
            <Terminal className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No logs yet. Run an orchestration from the Dashboard to see logs here.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([taskId, taskLogs]) => (
          <Card key={taskId} className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground">{taskId}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {taskLogs.length} events
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {taskLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'px-4 py-2.5 text-sm flex items-start gap-3',
                      log.event === 'error' && 'bg-red-50/50',
                      log.event === 'agent_complete' && 'bg-emerald-50/30'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {log.event === 'agent_start' && <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
                      {log.event === 'agent_stream' && <Terminal className="w-3.5 h-3.5 text-primary" />}
                      {log.event === 'agent_complete' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      {log.event === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      {!['agent_start', 'agent_stream', 'agent_complete', 'error'].includes(log.event) && (
                        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-xs">{log.event}</span>
                        {log.agent && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {log.agent === 'kimi' ? '🌙' : '⚡'} {log.agent}
                          </Badge>
                        )}
                        {log.role && (
                          <span className="text-[10px] text-muted-foreground">({log.role})</span>
                        )}
                        {typeof log.confidence === 'number' && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            confidence: {log.confidence}
                          </Badge>
                        )}
                        {log.round && (
                          <span className="text-[10px] text-muted-foreground">round {log.round}</span>
                        )}
                      </div>
                      {log.message && (
                        <p className="text-xs text-muted-foreground mt-1">{log.message}</p>
                      )}
                      {log.error && (
                        <p className="text-xs text-red-600 mt-1 font-mono">{log.error}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
