import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/todos/auto/start — start auto mode
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  // Find next todo to activate
  const { data: nextTodo } = await supabase
    .from('todos')
    .select('id')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .eq('status', 'open')
    .order('priority', { ascending: true })
    .order('type', { ascending: true })
    .order('order', { ascending: true })
    .limit(1)
    .single();

  // Upsert workspace state
  await supabase
    .from('workspace_states')
    .upsert({
      workspace_id: DEFAULT_WORKSPACE,
      auto_mode: true,
      active_todo_id: nextTodo?.id || null,
    });

  // Activate the todo
  if (nextTodo) {
    await supabase
      .from('todos')
      .update({ status: 'active' })
      .eq('id', nextTodo.id);
  }

  return NextResponse.json({ active: true, currentId: nextTodo?.id || null });
}
