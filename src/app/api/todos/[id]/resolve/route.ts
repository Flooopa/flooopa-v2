import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/todos/:id/resolve — mark todo as resolved
export async function POST(
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

  const { data, error } = await supabase
    .from('todos')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
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

  // Log to feed if it's a FIXME
  if (data.type === 'FIXME') {
    await supabase.from('feed_posts').insert({
      workspace_id: DEFAULT_WORKSPACE,
      author: 'system',
      author_id: userId,
      content: `Resolved FIXME: ${data.text}`,
      type: 'fixme_resolved',
      metadata: { todo_id: data.id, file: data.file, line: data.line },
    });
  }

  return NextResponse.json(data);
}
