import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureWorkspaceMembership, DEFAULT_WORKSPACE } from '@/lib/workspace';

// POST /api/feed/:id/reply — add a reply
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
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Get existing post
  const { data: post } = await supabase
    .from('feed_posts')
    .select('replies')
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const newReply = {
    id: crypto.randomUUID(),
    author: role,
    author_id: userId,
    content,
    timestamp: new Date().toISOString(),
  };

  const replies = [...(post.replies || []), newReply];

  const { data, error } = await supabase
    .from('feed_posts')
    .update({ replies })
    .eq('id', id)
    .eq('workspace_id', DEFAULT_WORKSPACE)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ postId: id, reply: newReply });
}
