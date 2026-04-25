import { createServiceClient } from './supabase/server';

export const DEFAULT_WORKSPACE = process.env.DEFAULT_WORKSPACE_ID || '00000000-0000-0000-0000-000000000000';

export async function ensureWorkspaceMembership(userId: string, email?: string | null) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .eq('user_id', userId)
    .single();

  if (existing) return existing.role as 'owner' | 'dev' | 'viewer';

  // Auto-onboard: first user becomes owner, rest become dev
  const { data: anyMember } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .limit(1)
    .single();

  const role = anyMember ? 'dev' : 'owner';

  await supabase.from('workspace_members').insert({
    workspace_id: DEFAULT_WORKSPACE,
    user_id: userId,
    role,
    email: email || null,
  });

  return role;
}
