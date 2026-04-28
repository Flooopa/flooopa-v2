'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Brain,
  CheckCircle2,
  Cpu,
  Gamepad2,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  WifiOff,
  XCircle,
  Zap,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface SystemStatus {
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  env: string;
  overall: 'healthy' | 'degraded' | 'critical';
  kimi: {
    status: string;
    httpStatus?: number;
    latencyMs: number;
    model: string;
    keyPresent: boolean;
    error?: string;
  };
  claude: {
    status: string;
    httpStatus?: number;
    latencyMs: number;
    model: string;
    keyPresent: boolean;
    error?: string;
  };
  ollama: {
    status: string;
    latencyMs: number;
    models?: string[];
    modelCount?: number;
    error?: string;
  };
  indexer: {
    status: string;
    latencyMs: number;
    httpStatus?: number;
    error?: string;
  };
  mcp: {
    status: string;
    latencyMs: number;
    scriptCount?: number;
    gameName?: string;
    error?: string;
  };
  backend: {
    status: string;
    port: number;
    project: string;
    webSocketClients: number;
    sseListeners: number;
    activeAgents: number;
  };
  robloxIndex: {
    gameName: string;
    scriptCount: number;
    indexedAt: string | null;
    hasIndex: boolean;
  };
  localAgent: {
    available: boolean;
    model: string;
    watchedFiles: number;
    todoCount: number;
    progress: number;
  };
  memory: {
    projects: number;
    sessionKeys: number;
  };
}

const BACKEND_URL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL || '';

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}h ${mins}m ${secs}s`;
}

function StatusBadge({ status, latency }: { status: string; latency?: number }) {
  const isOk = status === 'connected' || status === 'running' || status === 'healthy';
  const isWarn = status === 'error' || status === 'idle' || status === 'degraded';
  return (
    <div className="flex items-center gap-2">
      {isOk ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : isWarn ? (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" />
      )}
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          isOk && 'text-emerald-600 border-emerald-200 bg-emerald-50',
          isWarn && 'text-amber-600 border-amber-200 bg-amber-50',
          !isOk && !isWarn && 'text-red-600 border-red-200 bg-red-50'
        )}
      >
        {status}
      </Badge>
      {typeof latency === 'number' && <span className="text-xs text-muted-foreground">{latency}ms</span>}
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  subtitle,
  status,
  latency,
  details,
  error,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  status: string;
  latency?: number;
  details?: { label: string; value: string | number }[];
  error?: string;
  children?: React.ReactNode;
}) {
  const [showError, setShowError] = useState(false);
  const isOk = status === 'connected' || status === 'running' || status === 'healthy';

  return (
    <Card className={cn('border-l-4', isOk ? 'border-l-emerald-500' : 'border-l-red-500')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', isOk ? 'bg-emerald-50' : 'bg-red-50')}>
              <Icon className={cn('w-4 h-4', isOk ? 'text-emerald-600' : 'text-red-600')} />
            </div>
            <div>
              <h3 className="font-medium text-sm">{title}</h3>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <StatusBadge status={status} latency={latency} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {details && (
          <div className="grid grid-cols-2 gap-2">
            {details.map((d) => (
              <div key={d.label} className="bg-muted/40 rounded-md px-2 py-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{d.label}</p>
                <p className="text-xs font-mono truncate">{d.value}</p>
              </div>
            ))}
          </div>
        )}
        {children}
        {error && (
          <div>
            <button
              onClick={() => setShowError(!showError)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              {showError ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showError ? 'Hide error' : 'Show error'}
            </button>
            {showError && (
              <pre className="mt-1 text-xs bg-red-50 text-red-700 p-2 rounded-md overflow-x-auto">
                {error}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/system-status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
      setLastChecked(new Date());
    } catch {
      toast.error('Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <WifiOff className="w-8 h-8 text-red-500" />
        <p className="text-muted-foreground">Could not connect to backend</p>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  const overallColor =
    status.overall === 'healthy'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : status.overall === 'degraded'
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Status
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time health of all connected services
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-input"
            />
            Auto-refresh
          </label>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Check Now
          </Button>
        </div>
      </div>

      {/* Overall Health */}
      <Card className={cn('border', overallColor)}>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status.overall === 'healthy' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : status.overall === 'degraded' ? (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <div>
              <p className="font-medium capitalize">{status.overall}</p>
              <p className="text-xs text-muted-foreground">
                Last checked {lastChecked?.toLocaleTimeString() || '—'}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p>Uptime: {formatDuration(status.uptime)}</p>
            <p>Backend: {status.backend.port}</p>
            <p>Env: {status.env}</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Models */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">AI Models</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ServiceCard
            icon={Zap}
            title="Kimi"
            subtitle="Primary Coder"
            status={status.kimi.status}
            latency={status.kimi.latencyMs}
            details={[
              { label: 'Model', value: status.kimi.model },
              { label: 'API Key', value: status.kimi.keyPresent ? 'Present' : 'Missing' },
              ...(status.kimi.httpStatus ? [{ label: 'HTTP', value: status.kimi.httpStatus }] : []),
            ]}
            error={status.kimi.error}
          />
          <ServiceCard
            icon={Brain}
            title="Claude"
            subtitle="Planning & Critic"
            status={status.claude.status}
            latency={status.claude.latencyMs}
            details={[
              { label: 'Model', value: status.claude.model },
              { label: 'API Key', value: status.claude.keyPresent ? 'Present' : 'Missing' },
              ...(status.claude.httpStatus ? [{ label: 'HTTP', value: status.claude.httpStatus }] : []),
            ]}
            error={status.claude.error}
          />
        </div>
      </div>

      {/* Local Infrastructure */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Local Infrastructure</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ServiceCard
            icon={Cpu}
            title="Ollama"
            subtitle="Local AI"
            status={status.ollama.status}
            latency={status.ollama.latencyMs}
            details={[
              { label: 'Models', value: status.ollama.modelCount ?? '—' },
            ]}
            error={status.ollama.error}
          >
            {status.ollama.models && status.ollama.models.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {status.ollama.models.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </ServiceCard>
          <ServiceCard
            icon={Server}
            title="Local Indexer"
            subtitle="Roblox Indexer Service"
            status={status.indexer.status}
            latency={status.indexer.latencyMs}
            error={status.indexer.error}
          />
          <ServiceCard
            icon={Gamepad2}
            title="Roblox MCP"
            subtitle="Studio Connection"
            status={status.mcp.status}
            latency={status.mcp.latencyMs}
            details={[
              { label: 'Game', value: status.mcp.gameName ?? '—' },
              { label: 'Scripts', value: status.mcp.scriptCount ?? '—' },
            ]}
            error={status.mcp.error}
          />
        </div>
      </div>

      {/* Backend Stats */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Backend Stats</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">WebSockets</p>
            <p className="text-2xl font-semibold mt-1">{status.backend.webSocketClients}</p>
            <p className="text-xs text-muted-foreground">Connected clients</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">SSE Listeners</p>
            <p className="text-2xl font-semibold mt-1">{status.backend.sseListeners}</p>
            <p className="text-xs text-muted-foreground">Active streams</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Agents</p>
            <p className="text-2xl font-semibold mt-1">{status.backend.activeAgents}</p>
            <p className="text-xs text-muted-foreground">Running pipelines</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Watched Files</p>
            <p className="text-2xl font-semibold mt-1">{status.localAgent.watchedFiles}</p>
            <p className="text-xs text-muted-foreground">Local agent tracking</p>
          </Card>
        </div>
      </div>

      {/* Memory & Index */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Memory & Index</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Memory</p>
            </div>
            <p className="text-sm">{status.memory.projects} projects stored</p>
            <p className="text-sm">{status.memory.sessionKeys} active sessions</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Roblox Index</p>
            </div>
            <p className="text-sm">{status.robloxIndex.scriptCount} scripts indexed</p>
            <p className="text-sm text-muted-foreground">
              {status.robloxIndex.hasIndex
                ? `Last: ${status.robloxIndex.indexedAt ? new Date(status.robloxIndex.indexedAt).toLocaleString() : '—'}`
                : 'Not indexed yet'}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Local Agent</p>
            </div>
            <p className="text-sm">{status.localAgent.available ? 'Running' : 'Unavailable'}</p>
            <p className="text-sm">{status.localAgent.todoCount} todos tracked</p>
            <div className="mt-2">
              <Progress value={status.localAgent.progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">{status.localAgent.progress}% file coverage</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
