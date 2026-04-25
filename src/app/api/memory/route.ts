import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// GET /api/memory — get global + project memory
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  // Get global memory
  const { data: global } = await supabase
    .from('memory_global')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get project memory
  const { data: project } = await supabase
    .from('memory_projects')
    .select('*')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  return NextResponse.json({
    global: global || {
      preferences: [],
      coding_style: '',
      active_systems: [],
      always_inject: '',
    },
    project: project || {
      name: 'default',
      decisions: [],
      known_bugs: [],
      architecture: [],
      service_structure: [],
      remote_names: [],
      coding_style_prefs: [],
    },
    session: [], // Session memory stays ephemeral
  });
}

// POST /api/memory/remember — save a memory entry
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const supabase = createServiceClient();

  if (!['owner', 'dev'].includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await req.json();
  const { text, type } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Get current project memory
  const { data: project } = await supabase
    .from('memory_projects')
    .select('*')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  if (type === 'bug') {
    const knownBugs = [...(project?.known_bugs || []), { text, created: new Date().toISOString() }];
    await supabase
      .from('memory_projects')
      .upsert({
        workspace_id: DEFAULT_WORKSPACE,
        name: project?.name || 'default',
        known_bugs: knownBugs,
      });
  } else {
    const decisions = [...(project?.decisions || []), { text, created: new Date().toISOString() }];
    await supabase
      .from('memory_projects')
      .upsert({
        workspace_id: DEFAULT_WORKSPACE,
        name: project?.name || 'default',
        decisions,
      });
  }

  return NextResponse.json({ success: true });
}
