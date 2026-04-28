'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  FileText,
  Bug,
  Lightbulb,
  Layers,
  ListTodo,
  RefreshCw,
  Upload,
  Activity,
  Cpu,
  Gamepad2,
  Server,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ContextData {
  knowledgeBase: Record<string, string>;
  fileChanges: Array<{ file: string; time: number }>;
  robloxIndex: {
    gameName: string;
    indexedAt: string | null;
    stats: { total: number; byCategory: Record<string, number> };
    scripts: Array<{
      path: string;
      name: string;
      category: string;
      summary: string;
      length: number;
    }>;
  };
  projectMemory: {
    name: string;
    decisions: Array<{ text: string; created: string }>;
    knownBugs: Array<{ text: string; created: string }>;
    stack: string;
    architecture: string[];
    serviceStructure: string[];
    remoteNames: string[];
    codingStylePrefs: string[];
  };
  globalMemory: {
    preferences: string[];
    codingStyle: string;
    activeSystems: string[];
    alwaysInject: string;
  };
  todos: Array<{
    id: string;
    type: string;
    text: string;
    file?: string;
    status: string;
    priority: string;
  }>;
  localAgentStatus: {
    available: boolean;
    model: string;
    watchedFiles: number;
    todoCount: number;
    progress: number;
  };
}

interface StatusData {
  ollama: string;
  localAgent: string;
  model: string;
  watchedFiles: number;
  robloxIndex: {
    gameName: string;
    scriptCount: number;
    indexedAt: string | null;
  };
  railway: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL || '';

export default function ContextPage() {
  const [data, setData] = useState<ContextData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    knowledgeBase: true,
    robloxScripts: false,
    decisions: true,
    bugs: true,
    stack: true,
    guidelines: true,
    todos: true,
    changes: false,
  });

  const [editing, setEditing] = useState<{
    section: string;
    key: string;
    value: string;
  } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/context`);
      if (!res.ok) throw new Error('Failed to fetch context');
      const d = await res.json();
      setData(d);
    } catch (err) {
      toast.error('Failed to load context data');
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/context/status`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const s = await res.json();
      setStatus(s);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchData().then(() => setLoading(false));
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchData, fetchStatus]);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (editing.section === 'knowledgeBase') {
        endpoint = '/api/context/file-summary';
        body = { file: editing.key, summary: editing.value };
      } else if (editing.section === 'stack') {
        endpoint = '/api/context/project-memory';
        body = { field: 'stack', value: editing.value };
      }

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Save failed');
      toast.success('Saved');
      setEditing(null);
      fetchData();
    } catch {
      toast.error('Failed to save');
    }
  };

  const deleteItem = async (section: string, key: string) => {
    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (section === 'knowledgeBase') {
        endpoint = '/api/context/file-summary';
        body = { file: key };
      } else if (section === 'decisions') {
        endpoint = `/api/context/decisions/${key}`;
      } else if (section === 'bugs') {
        endpoint = `/api/context/bugs/${key}`;
      }

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...(Object.keys(body).length ? { body: JSON.stringify(body) } : {}),
      });

      if (!res.ok) throw new Error('Delete failed');
      toast.success('Deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const addItem = async (section: string) => {
    if (!newValue.trim()) return;
    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (section === 'knowledgeBase') {
        endpoint = '/api/context/file-summary';
        body = { file: `manual-${Date.now()}`, summary: newValue };
      } else if (section === 'decisions') {
        endpoint = '/api/context/decisions';
        body = { text: newValue };
      } else if (section === 'bugs') {
        endpoint = '/api/context/bugs';
        body = { text: newValue };
      }

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Add failed');
      toast.success('Added');
      setAdding(null);
      setNewValue('');
      fetchData();
    } catch {
      toast.error('Failed to add');
    }
  };

  const triggerRescan = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/context/rescan`, { method: 'POST' });
      if (!res.ok) throw new Error('Rescan failed');
      toast.success('Rescan triggered');
    } catch {
      toast.error('Rescan failed — is the indexer running on localhost:3002?');
    }
  };

  const triggerSync = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/context/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      toast.success('Context synced');
      fetchStatus();
    } catch {
      toast.error('Sync failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load context data. Is the backend running?
      </div>
    );
  }

  const SectionHeader = ({
    icon: Icon,
    title,
    badge,
    sectionKey,
  }: {
    icon: React.ElementType;
    title: string;
    badge?: string | number;
    sectionKey: string;
  }) => (
    <button
      onClick={() => toggle(sectionKey)}
      className="flex items-center justify-between w-full py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        {badge !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
      {expanded[sectionKey] ? (
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );

  const StatusDot = ({ status }: { status: string }) => {
    const color =
      status.includes('running') || status === 'connected'
        ? 'bg-emerald-500'
        : status === 'disconnected'
        ? 'bg-red-500'
        : 'bg-amber-500';
    return <span className={cn('inline-block w-2 h-2 rounded-full', color)} />;
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5" />
            Context Viewer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect and edit all data that gets injected into Kimi &amp; Claude
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={triggerRescan}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Rescan
          </Button>
          <Button variant="outline" size="sm" onClick={triggerSync}>
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* Live Indicators */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Ollama</span>
              <StatusDot status={status.ollama} />
            </div>
            <p className={cn('text-sm font-medium mt-1', status.ollama.includes('running') ? 'text-emerald-600' : 'text-red-600')}>
              {status.ollama}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Local Agent</span>
              <StatusDot status={status.localAgent} />
            </div>
            <p className={cn('text-sm font-medium mt-1', status.localAgent === 'connected' ? 'text-emerald-600' : 'text-red-600')}>
              {status.localAgent} {status.model && `(${status.model})`}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Gamepad2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Roblox Index</span>
            </div>
            <p className="text-sm font-medium mt-1">
              {status.robloxIndex.scriptCount > 0
                ? `${status.robloxIndex.scriptCount} scripts`
                : 'Not indexed'}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Railway</span>
            </div>
            <p className="text-sm font-medium mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {status.railway}
            </p>
          </Card>
        </div>
      )}

      {/* File Summaries */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={FileText}
            title="File Summaries"
            badge={Object.keys(data.knowledgeBase).length}
            sectionKey="knowledgeBase"
          />
        </CardHeader>
        {expanded.knowledgeBase && (
          <CardContent className="pt-2 space-y-2">
            {Object.entries(data.knowledgeBase).map(([file, summary]) => (
              <div
                key={file}
                className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 transition-colors"
              >
                {editing?.section === 'knowledgeBase' && editing?.key === file ? (
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-mono text-muted-foreground">{file}</p>
                    <Textarea
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={saveEdit}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted-foreground truncate">{file}</p>
                      <p className="text-sm mt-0.5">{summary}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7"
                        onClick={() => setEditing({ section: 'knowledgeBase', key: file, value: summary })}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-red-500 hover:text-red-600"
                        onClick={() => deleteItem('knowledgeBase', file)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {adding === 'knowledgeBase' ? (
              <div className="space-y-2 p-2">
                <Textarea
                  placeholder="Enter file summary..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addItem('knowledgeBase')}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(null); setNewValue(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setAdding('knowledgeBase')}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add file summary manually
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Roblox Scripts */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={Gamepad2}
            title="Roblox Scripts"
            badge={data.robloxIndex.stats.total}
            sectionKey="robloxScripts"
          />
        </CardHeader>
        {expanded.robloxScripts && (
          <CardContent className="pt-2">
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(data.robloxIndex.stats.byCategory).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}: {count}
                </Badge>
              ))}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.robloxIndex.scripts.map((script) => (
                <div key={script.path} className="p-2 rounded-md hover:bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {script.category}
                    </Badge>
                    <span className="text-sm font-mono">{script.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{script.length} chars</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{script.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Architecture Decisions */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={Lightbulb}
            title="Architecture Decisions"
            badge={data.projectMemory.decisions?.length}
            sectionKey="decisions"
          />
        </CardHeader>
        {expanded.decisions && (
          <CardContent className="pt-2 space-y-2">
            {data.projectMemory.decisions?.map((d, i) => (
              <div key={i} className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{d.text}</p>
                  <p className="text-xs text-muted-foreground">{new Date(d.created).toLocaleDateString()}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 opacity-0 group-hover:opacity-100 text-red-500"
                  onClick={() => deleteItem('decisions', String(i))}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {adding === 'decisions' ? (
              <div className="space-y-2 p-2">
                <Textarea
                  placeholder="Enter decision..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addItem('decisions')}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(null); setNewValue(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAdding('decisions')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add decision
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Known Bugs */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={Bug}
            title="Known Bugs"
            badge={data.projectMemory.knownBugs?.length}
            sectionKey="bugs"
          />
        </CardHeader>
        {expanded.bugs && (
          <CardContent className="pt-2 space-y-2">
            {data.projectMemory.knownBugs?.map((b, i) => (
              <div key={i} className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/40">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{b.text}</p>
                  <p className="text-xs text-muted-foreground">{new Date(b.created).toLocaleDateString()}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 opacity-0 group-hover:opacity-100 text-red-500"
                  onClick={() => deleteItem('bugs', String(i))}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {adding === 'bugs' ? (
              <div className="space-y-2 p-2">
                <Textarea
                  placeholder="Enter bug description..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => addItem('bugs')}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(null); setNewValue(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAdding('bugs')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add bug
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Stack */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader icon={Layers} title="Stack" sectionKey="stack" />
        </CardHeader>
        {expanded.stack && (
          <CardContent className="pt-2">
            {editing?.section === 'stack' ? (
              <div className="space-y-2">
                <Textarea
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={saveEdit}>
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2 p-2 rounded-md hover:bg-muted/40">
                <p className="text-sm flex-1">{data.projectMemory.stack || 'No stack defined'}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 opacity-0 group-hover:opacity-100"
                  onClick={() => setEditing({ section: 'stack', key: 'stack', value: data.projectMemory.stack || '' })}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader icon={CheckCircle2} title="Guidelines" sectionKey="guidelines" />
        </CardHeader>
        {expanded.guidelines && (
          <CardContent className="pt-2 space-y-2">
            {data.globalMemory.codingStyle && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Coding Style</p>
                <p className="text-sm mt-1">{data.globalMemory.codingStyle}</p>
              </div>
            )}
            {data.globalMemory.preferences?.length > 0 && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Preferences</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.globalMemory.preferences.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {data.globalMemory.alwaysInject && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Always Remember</p>
                <p className="text-sm mt-1">{data.globalMemory.alwaysInject}</p>
              </div>
            )}
            {data.projectMemory.codingStylePrefs?.length > 0 && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Project Style</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.projectMemory.codingStylePrefs.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Open Tasks */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={ListTodo}
            title="Open Tasks"
            badge={data.todos.filter((t) => t.status !== 'resolved').length}
            sectionKey="todos"
          />
        </CardHeader>
        {expanded.todos && (
          <CardContent className="pt-2 space-y-2">
            {data.todos
              .filter((t) => t.status !== 'resolved')
              .map((todo) => (
                <div key={todo.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40">
                  <Badge
                    variant={todo.type === 'FIXME' ? 'destructive' : 'outline'}
                    className="text-xs shrink-0 mt-0.5"
                  >
                    {todo.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{todo.text}</p>
                    {todo.file && <p className="text-xs text-muted-foreground font-mono">{todo.file}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {todo.priority}
                  </Badge>
                </div>
              ))}
          </CardContent>
        )}
      </Card>

      {/* Recent Changes */}
      <Card>
        <CardHeader className="pb-0">
          <SectionHeader
            icon={Clock}
            title="Recent Changes"
            badge={data.fileChanges.length}
            sectionKey="changes"
          />
        </CardHeader>
        {expanded.changes && (
          <CardContent className="pt-2 space-y-1">
            {data.fileChanges.map((change, i) => {
              const ago = Math.round((Date.now() - change.time) / 1000);
              const unit = ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.round(ago / 60)}m` : `${Math.round(ago / 3600)}h`;
              return (
                <div key={i} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/30 text-sm">
                  <span className="text-xs text-muted-foreground w-12 text-right">{unit} ago</span>
                  <span className="font-mono text-xs truncate">{change.file}</span>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
