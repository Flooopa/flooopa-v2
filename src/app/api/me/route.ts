import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/me — ensures workspace membership and returns role
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  // Get member count
  const { count } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', DEFAULT_WORKSPACE);

  return NextResponse.json({
    userId,
    role,
    workspaceId: DEFAULT_WORKSPACE,
    memberCount: count || 1,
  });
}
