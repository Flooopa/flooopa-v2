import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/todos/reorder — reorder todos
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  if (!['owner', 'dev'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
  }

  // Update order for each todo
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('todos')
      .update({ order: i })
      .eq('id', orderedIds[i])
      .eq('workspace_id', DEFAULT_WORKSPACE);
  }

  return NextResponse.json({ success: true });
}
