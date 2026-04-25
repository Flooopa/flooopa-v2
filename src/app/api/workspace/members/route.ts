import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// GET /api/workspace/members — list all workspace members
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, email, joined_at')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .order('joined_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: members || [] });
}

// POST /api/workspace/members — invite a new member by email
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const body = await req.json();
  const { email, userId: targetUserId, role: targetRole = 'dev' } = body;

  if (!email?.trim() && !targetUserId?.trim()) {
    return NextResponse.json({ error: 'email or userId is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if member already exists by email or user_id
  let existingQuery = supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', DEFAULT_WORKSPACE);

  if (targetUserId) {
    const { data } = await existingQuery.eq('user_id', targetUserId).single();
    if (data) return NextResponse.json({ error: 'Member already exists' }, { status: 409 });
  }
  if (email) {
    const { data } = await existingQuery.eq('email', email).single();
    if (data) return NextResponse.json({ error: 'Member already exists' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: DEFAULT_WORKSPACE,
      user_id: targetUserId || email,
      role: targetRole,
      email: email || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
