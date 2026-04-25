'use client';

import { useState, useRef, useEffect } from 'react';
import { useRealtime } from '@/components/RealtimeProvider';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';
import { toast } from 'sonner';
import {
  Plus,
  GripVertical,
  MoreHorizontal,
  CheckCircle2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Bot,
  Circle,
  AlertCircle,
  Clock,
  User,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Todo } from '@/types';

export default function BoardPage() {
  const { todos, refreshTodos, autoMode, activeTodoId } = useRealtime();
  const { isOwner, isDev } = useWorkspaceRole();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'TODO' | 'FIXME'>('TODO');
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null);

  const stats = {
    total: todos.length,
    open: todos.filter((t) => t.status === 'open').length,
    active: todos.filter((t) => t.status === 'active').length,
    resolved: todos.filter((t) => t.status === 'resolved').length,
    fixme: todos.filter((t) => t.type === 'FIXME').length,
    todo: todos.filter((t) => t.type === 'TODO').length,
  };

  const progress = stats.total > 0
    ? Math.round(((stats.active + stats.resolved) / stats.total) * 100)
    : 0;

  const handleDragStart = (e: React.DragEvent, todo: Todo) => {
    e.dataTransfer.setData('text/plain', todo.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTodo(todo);
  };

  const handleDragEnd = () => setDraggedTodo(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    setDraggedTodo(null);
    if (!draggedId || draggedId === targetId) return;

    const currentIds = todos.map((t) => t.id);
    const fromIdx = currentIds.indexOf(draggedId);
    const toIdx = currentIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...currentIds];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);

    try {
      const res = await fetch('/api/todos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshTodos();
    } catch (err) {
      console.error('Reorder failed:', err);
      toast.error('Failed to reorder cards');
    }
  };

  const createTodo = async () => {
    if (!newText.trim()) return;
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, text: newText, priority: 'medium' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewText('');
      refreshTodos();
      toast.success('Card created');
    } catch (err) {
      console.error('Create failed:', err);
      toast.error('Failed to create card');
    }
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshTodos();
      toast.success('Card updated');
    } catch (err) {
      console.error('Update failed:', err);
      toast.error('Failed to update card');
    }
    setMenuOpen(null);
  };

  const deleteTodo = async (id: string) => {
    if (!confirm('Delete this card?')) return;
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshTodos();
      toast.success('Card deleted');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete card');
    }
    setMenuOpen(null);
  };

  const resolveTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/todos/${id}/resolve`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshTodos();
      toast.success('Card resolved');
    } catch (err) {
      console.error('Resolve failed:', err);
      toast.error('Failed to resolve card');
    }
    setMenuOpen(null);
  };

  const toggleAuto = async () => {
    try {
      const endpoint = autoMode ? '/api/todos/auto/stop' : '/api/todos/auto/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshTodos();
      toast.success(autoMode ? 'Auto mode paused' : 'Auto mode started');
    } catch (err) {
      console.error('Auto mode toggle failed:', err);
      toast.error('Failed to toggle auto mode');
    }
  };

  const priorityConfig = {
    high: { color: 'text-red-600 bg-red-50 border-red-200', label: 'High' },
    medium: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Medium' },
    low: { color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Low' },
  };

  const statusConfig = {
    open: { icon: Circle, color: 'text-slate-400' },
    active: { icon: Clock, color: 'text-emerald-500' },
    resolved: { icon: CheckCircle2, color: 'text-emerald-500' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Todo & Fixme Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag cards to reorder the AI work queue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            {stats.fixme} FIXME
          </Badge>
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
            <Circle className="w-3 h-3 mr-1" />
            {stats.todo} TODO
          </Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {stats.resolved} Done
          </Badge>
          {isOwner && (
            <Button
              size="sm"
              variant={autoMode ? 'default' : 'outline'}
              onClick={toggleAuto}
              className={autoMode ? 'bg-primary hover:bg-primary/90' : ''}
            >
              {autoMode ? '⏸ Pause' : '▶ Auto'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {autoMode && (
        <div className="space-y-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Auto mode active — {progress}% complete
          </p>
        </div>
      )}

      {/* Add new */}
      {isDev && (
        <div className="flex gap-2">
          <Input
            placeholder="Add new task..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTodo()}
            className="flex-1"
          />
          <Select value={newType} onValueChange={(v) => setNewType(v as 'TODO' | 'FIXME')}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODO">TODO</SelectItem>
              <SelectItem value="FIXME">FIXME</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={createTodo} disabled={!newText.trim()} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-2">
        {todos.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No cards yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add one above or let the local AI scan your files
            </p>
          </div>
        )}

        {todos.map((todo) => {
          const StatusIcon = statusConfig[todo.status || 'open'].icon;
          const p = priorityConfig[todo.priority || 'medium'];
          return (
            <div
              key={todo.id}
              draggable={isDev}
              onDragStart={(e) => handleDragStart(e, todo)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, todo.id)}
              className={cn(
                'group flex items-start gap-3 p-3.5 rounded-lg border bg-white dark:bg-card transition-all',
                todo.status === 'active' && 'ring-1 ring-primary/30 shadow-sm',
                draggedTodo?.id === todo.id && 'opacity-40 scale-[1.01]',
                todo.type === 'FIXME'
                  ? 'border-l-[3px] border-l-red-400'
                  : 'border-l-[3px] border-l-blue-400',
                todo.status === 'resolved' && 'opacity-50'
              )}
            >
              {isDev && (
                <GripVertical className="w-4 h-4 mt-0.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />
              )}

              <StatusIcon className={cn('w-4 h-4 mt-0.5 shrink-0', statusConfig[todo.status || 'open'].color)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', p.color)}>
                    {todo.type}
                  </Badge>
                  {todo.status === 'active' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                  )}
                  {todo.file && (
                    <span className="text-xs text-muted-foreground truncate">
                      {todo.file}{todo.line ? `:${todo.line}` : ''}
                    </span>
                  )}
                </div>

                <p className={cn('text-sm', todo.status === 'resolved' && 'line-through text-muted-foreground')}>
                  {todo.text}
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', p.color)}>
                    {p.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(todo.created_at).toLocaleDateString()}
                  </span>
                  {todo.assignee && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {todo.assignee}
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenu open={menuOpen === todo.id} onOpenChange={(open) => setMenuOpen(open ? todo.id : null)}>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {isOwner && todo.status !== 'resolved' && (
                    <DropdownMenuItem onClick={() => setMenuOpen(null)}>
                      <Bot className="w-4 h-4 mr-2" /> Fix with AI
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() =>
                      updateTodo(todo.id, {
                        priority: (todo.priority || 'medium') === 'high' ? 'medium' : 'high',
                      })
                    }
                  >
                    {(todo.priority || 'medium') === 'high' ? (
                      <><ArrowDown className="w-4 h-4 mr-2" /> Lower Priority</>
                    ) : (
                      <><ArrowUp className="w-4 h-4 mr-2" /> Raise Priority</>
                    )}
                  </DropdownMenuItem>
                  {todo.status !== 'resolved' && (
                    <DropdownMenuItem onClick={() => resolveTodo(todo.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Resolve
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => deleteTodo(todo.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
