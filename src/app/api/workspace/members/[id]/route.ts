import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// PUT /api/workspace/members/:id — update member role
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role: newRole } = body;

  if (!['owner', 'dev', 'viewer'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Prevent demoting the last owner
  if (newRole !== 'owner') {
    const { data: owners } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', DEFAULT_WORKSPACE)
      .eq('role', 'owner');

    if (owners && owners.length <= 1 && owners[0]?.id === id) {
      return NextResponse.json({ error: 'Cannot demote the last owner' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/workspace/members/:id — remove a member
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  // Prevent removing the last owner
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  if (member?.role === 'owner') {
    const { data: owners } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', DEFAULT_WORKSPACE)
      .eq('role', 'owner');

    if (owners && owners.length <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
