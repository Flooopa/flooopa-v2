'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Todo, FeedPost } from '@/types';

interface RealtimeContextValue {
  todos: Todo[];
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  feedPosts: FeedPost[];
  setFeedPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  autoMode: boolean;
  activeTodoId: string | null;
  refreshTodos: () => Promise<void>;
  refreshFeed: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000000';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  async function refreshTodos() {
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
        setAutoMode(data.autoMode || false);
        setActiveTodoId(data.activeTodoId || null);
      }
    } catch (err) {
      console.error('Failed to refresh todos:', err);
    }
  }

  async function refreshFeed() {
    try {
      const res = await fetch('/api/feed');
      if (res.ok) {
        const data = await res.json();
        setFeedPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to refresh feed:', err);
    }
  }

  useEffect(() => {
    const supabase = supabaseRef.current;

    // Subscribe to todos changes
    const todosChannel = supabase
      .channel('todos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `workspace_id=eq.${DEFAULT_WORKSPACE}`,
        },
        () => refreshTodos()
      )
      .subscribe();

    // Subscribe to feed changes
    const feedChannel = supabase
      .channel('feed_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_posts',
          filter: `workspace_id=eq.${DEFAULT_WORKSPACE}`,
        },
        () => refreshFeed()
      )
      .subscribe();

    // Subscribe to workspace state changes
    const stateChannel = supabase
      .channel('workspace_state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_states',
          filter: `workspace_id=eq.${DEFAULT_WORKSPACE}`,
        },
        () => refreshTodos()
      )
      .subscribe();

    // Initial load
    refreshTodos();
    refreshFeed();

    return () => {
      supabase.removeChannel(todosChannel);
      supabase.removeChannel(feedChannel);
      supabase.removeChannel(stateChannel);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        todos,
        setTodos,
        feedPosts,
        setFeedPosts,
        autoMode,
        activeTodoId,
        refreshTodos,
        refreshFeed,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
