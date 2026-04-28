'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL || '';

export interface ActiveTask {
  taskId: string;
  streamUrl: string;
  task: string;
  mode: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  agents: Record<string, { status: string; output: string; role: string }>;
  finalOutput: string;
  confidence: number | null;
  currentStep: number;
  logs: Array<{
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
  }>;
  lastError: string | null;
  startedAt: string;
  completedAt?: string;
}

interface TaskManagerContextValue {
  tasks: ActiveTask[];
  activeTaskId: string | null;
  startTask: (params: {
    task: string;
    mode: string;
    planningMode: boolean;
    primaryOverride: 'auto' | 'kimi' | 'claude';
  }) => Promise<void>;
  cancelTask: (taskId: string) => void;
  reconnectTask: (taskId: string) => void;
  clearCompleted: () => void;
}

const TaskManagerContext = createContext<TaskManagerContextValue | null>(null);

const STORAGE_KEY = 'ai-active-tasks';
const MAX_TASKS = 20;

function loadTasks(): ActiveTask[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTasks(tasks: ActiveTask[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(-MAX_TASKS)));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function TaskManagerProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<ActiveTask[]>(loadTasks);
  const abortControllers = useRef<Record<string, AbortController>>({});

  const activeTaskId = tasks.find((t) => t.status === 'running')?.taskId || null;

  // Persist tasks
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const updateTask = useCallback((taskId: string, updates: Partial<ActiveTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, ...updates } : t))
    );
  }, []);

  const addLog = useCallback(
    (taskId: string, entry: Omit<ActiveTask['logs'][0], 'id' | 'timestamp'>) => {
      const log = {
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        ...entry,
      };
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId ? { ...t, logs: [...t.logs, log] } : t
        )
      );
    },
    []
  );

  const determineStep = (role?: string, event?: string) => {
    if (event === 'pipeline_complete') return 4;
    if (role === 'synthesizer' || role === 'final-merger') return 3;
    if (role === 'critic' || role === 'devil' || role === 'reviewer') return 2;
    if (role === 'solver' || role === 'architect' || role === 'reviser') return 1;
    return 0;
  };

  const connectStream = useCallback(
    async (task: ActiveTask, signal: AbortSignal) => {
      let reconnectAttempts = 0;
      const maxReconnects = 5;

      while (reconnectAttempts <= maxReconnects) {
        try {
          const streamRes = await fetch(task.streamUrl, { signal });
          if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);

          const reader = streamRes.body?.getReader();
          if (!reader) throw new Error('No reader available');

          const decoder = new TextDecoder();
          let buffer = '';
          reconnectAttempts = 0;

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
                      updateTask(task.taskId, {
                        agents: {
                          ...task.agents,
                          [event.data.agent]: {
                            status: 'thinking',
                            output: '',
                            role: event.data.role,
                          },
                        },
                        currentStep: determineStep(event.data.role),
                      });
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'agent_start',
                        agent: event.data.agent,
                        role: event.data.role,
                        message: event.data.message,
                      });
                      break;
                    }
                    case 'agent_stream': {
                      updateTask(task.taskId, {
                        agents: {
                          ...task.agents,
                          [event.data.agent]: {
                            ...task.agents[event.data.agent],
                            status: 'streaming',
                            output: event.data.fullText || '',
                          },
                        },
                      });
                      break;
                    }
                    case 'agent_complete': {
                      updateTask(task.taskId, {
                        agents: {
                          ...task.agents,
                          [event.data.agent]: {
                            ...task.agents[event.data.agent],
                            status: 'complete',
                            output: event.data.fullText || '',
                          },
                        },
                      });
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'agent_complete',
                        agent: event.data.agent,
                        role: event.data.role,
                        message: `Completed (${event.data.charCount} chars)`,
                      });
                      break;
                    }
                    case 'confidence_update': {
                      updateTask(task.taskId, {
                        confidence: event.data.confidence,
                      });
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'confidence_update',
                        confidence: event.data.confidence,
                        round: event.data.round,
                      });
                      break;
                    }
                    case 'final_output': {
                      updateTask(task.taskId, {
                        finalOutput: event.data.output || '',
                        currentStep: 4,
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                      });
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'final_output',
                        message: 'Pipeline complete',
                      });
                      toast.success(`Task complete: ${task.task.slice(0, 40)}...`);
                      return;
                    }
                    case 'error': {
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'error',
                        agent: event.data.agent,
                        role: event.data.role,
                        error: event.data.error,
                      });
                      updateTask(task.taskId, {
                        lastError: event.data.error,
                      });
                      break;
                    }
                    case 'warning': {
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'warning',
                        agent: event.data.agent,
                        role: event.data.role,
                        message: event.data.message,
                      });
                      break;
                    }
                    case 'pipeline_complete': {
                      addLog(task.taskId, {
                        taskId: event.data.taskId,
                        event: 'pipeline_complete',
                        message: event.data.message,
                      });
                      break;
                    }
                  }
                } catch {
                  // malformed event
                }
              }
            }
          }
          return;
        } catch (err: any) {
          if (signal.aborted) {
            updateTask(task.taskId, { status: 'cancelled' });
            return;
          }
          reconnectAttempts++;
          if (reconnectAttempts > maxReconnects) {
            updateTask(task.taskId, {
              status: 'failed',
              lastError: `Stream disconnected after ${maxReconnects} reconnection attempts`,
              completedAt: new Date().toISOString(),
            });
            toast.error(`Task failed: ${task.task.slice(0, 40)}...`);
            return;
          }
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          await sleep(backoff);
        }
      }
    },
    [updateTask, addLog]
  );

  const startTask = useCallback(
    async (params: {
      task: string;
      mode: string;
      planningMode: boolean;
      primaryOverride: 'auto' | 'kimi' | 'claude';
    }) => {
      const { task, mode, planningMode, primaryOverride } = params;

      // Start orchestration
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

      const newTask: ActiveTask = {
        taskId,
        streamUrl,
        task,
        mode,
        status: 'running',
        agents: {},
        finalOutput: '',
        confidence: null,
        currentStep: 0,
        logs: [],
        lastError: null,
        startedAt: new Date().toISOString(),
      };

      setTasks((prev) => [...prev, newTask]);

      const ctrl = new AbortController();
      abortControllers.current[taskId] = ctrl;

      // Run with retry
      let attempt = 1;
      while (attempt <= 3) {
        try {
          await connectStream(newTask, ctrl.signal);
          break;
        } catch (err: any) {
          if (ctrl.signal.aborted) break;
          if (attempt >= 3) {
            updateTask(taskId, {
              status: 'failed',
              lastError: err.message,
              completedAt: new Date().toISOString(),
            });
            toast.error(`Task failed after 3 attempts: ${err.message}`);
            break;
          }
          attempt++;
          await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
        }
      }

      delete abortControllers.current[taskId];
    },
    [connectStream, updateTask]
  );

  const cancelTask = useCallback((taskId: string) => {
    const ctrl = abortControllers.current[taskId];
    if (ctrl) {
      ctrl.abort();
      delete abortControllers.current[taskId];
    }
    updateTask(taskId, { status: 'cancelled', completedAt: new Date().toISOString() });
    toast.info('Task cancelled');
  }, [updateTask]);

  const reconnectTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.taskId === taskId);
      if (!task || task.status !== 'running') return;

      const ctrl = new AbortController();
      abortControllers.current[taskId] = ctrl;
      connectStream(task, ctrl.signal);
    },
    [tasks, connectStream]
  );

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'running'));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllers.current).forEach((ctrl) => ctrl.abort());
    };
  }, []);

  return (
    <TaskManagerContext.Provider
      value={{ tasks, activeTaskId, startTask, cancelTask, reconnectTask, clearCompleted }}
    >
      {children}
    </TaskManagerContext.Provider>
  );
}

export function useTaskManager() {
  const ctx = useContext(TaskManagerContext);
  if (!ctx) throw new Error('useTaskManager must be used within TaskManagerProvider');
  return ctx;
}
