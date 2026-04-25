import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/feed/:id/react — add/remove a reaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await ensureWorkspaceMembership(userId);
  const { id } = await params;
  const supabase = createServiceClient();

  const body = await req.json();
  const { emoji } = body;

  if (!emoji) {
    return NextResponse.json({ error: 'emoji is required' }, { status: 400 });
  }

  // Get existing post
  const { data: post } = await supabase
    .from('feed_posts')
    .select('reactions')
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const reactions: Record<string, string[]> = { ...(post.reactions || {}) };
  const users = reactions[emoji] || [];

  if (users.includes(userId)) {
    // Remove reaction
    reactions[emoji] = users.filter((u: string) => u !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    // Add reaction
    reactions[emoji] = [...users, userId];
  }

  const { data, error } = await supabase
    .from('feed_posts')
    .update({ reactions })
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    postId: id,
    emoji,
    user: userId,
    count: reactions[emoji]?.length || 0,
  });
}
