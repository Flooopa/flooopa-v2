import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// PUT /api/todos/:id — update a todo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const { id } = await params;
  const supabase = createServiceClient();

  if (!['owner', 'dev'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();

  const { data, error } = await supabase
    .from('todos')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/todos/:id — delete a todo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const { id } = await params;
  const supabase = createServiceClient();

  if (!['owner', 'dev'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reindex remaining todos
  const { data: remaining } = await supabase
    .from('todos')
    .select('id')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .order('order', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from('todos')
        .update({ order: i })
        .eq('id', remaining[i].id);
    }
  }

  return NextResponse.json({ success: true });
}
