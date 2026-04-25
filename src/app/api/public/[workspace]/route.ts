import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/public/:workspace — public view for a workspace
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace } = await params;
  const supabase = createServiceClient();

  // Get public view settings
  const { data: publicView } = await supabase
    .from('public_views')
    .select('*')
    .eq('workspace_id', workspace)
    .single();

  // Get known issues (open todos)
  const { data: issues } = await supabase
    .from('todos')
    .select('id, text, type, priority, created_at')
    .eq('workspace_id', workspace)
    .neq('status', 'resolved')
    .order('created_at', { ascending: false });

  return NextResponse.json({
    version: publicView?.game_version || '1.0.0',
    roadmap: publicView?.roadmap || [],
    patchNotes: publicView?.patch_notes || [],
    knownIssues: issues || [],
    lastUpdated: publicView?.updated_at || new Date().toISOString(),
  });
}
