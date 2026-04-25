import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';
import type { Todo } from '@/types';

// GET /api/todos — list todos with stats
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  // Fetch todos sorted by: active first, then priority, then type, then order
  const { data: todos, error } = await supabase
    .from('todos')
    .select('*')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .order('status', { ascending: false }) // active before open before resolved
    .order('priority', { ascending: true }) // high, medium, low
    .order('type', { ascending: true }) // FIXME before TODO
    .order('order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get workspace state
  const { data: state } = await supabase
    .from('workspace_states')
    .select('auto_mode, active_todo_id')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  // Compute stats
  const stats = {
    total: todos?.length || 0,
    open: todos?.filter((t: Todo) => t.status === 'open').length || 0,
    active: todos?.filter((t: Todo) => t.status === 'active').length || 0,
    resolved: todos?.filter((t: Todo) => t.status === 'resolved').length || 0,
    fixme: todos?.filter((t: Todo) => t.type === 'FIXME').length || 0,
    todo: todos?.filter((t: Todo) => t.type === 'TODO').length || 0,
  };

  return NextResponse.json({
    todos: todos || [],
    stats,
    autoMode: state?.auto_mode || false,
    activeTodoId: state?.active_todo_id || null,
  });
}

// POST /api/todos — create a new todo
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  if (!['owner', 'dev'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const { type, text, file, line, assignee, priority, source } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Get max order
  const { data: maxOrder } = await supabase
    .from('todos')
    .select('order')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .order('order', { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('todos')
    .insert({
      workspace_id: DEFAULT_WORKSPACE,
      type: type === 'FIXME' ? 'FIXME' : 'TODO',
      text,
      file: file || '',
      line: line || null,
      assignee: assignee || '',
      priority: priority || 'medium',
      source: source || 'manual',
      order: (maxOrder?.order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
