import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/todos/auto/stop — stop auto mode
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  // Deactivate any active todos
  await supabase
    .from('todos')
    .update({ status: 'open' })
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .eq('status', 'active');

  // Update workspace state
  await supabase
    .from('workspace_states')
    .upsert({
      workspace_id: DEFAULT_WORKSPACE,
      auto_mode: false,
      active_todo_id: null,
    });

  return NextResponse.json({ active: false });
}
