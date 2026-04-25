'use client';

import { useState } from 'react';
import { useRealtime } from '@/components/RealtimeProvider';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';
import { Send, MessageCircle, ThumbsUp, Flame, Lightbulb, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { FeedPost } from '@/types';

const REACTIONS = [
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '🔥', icon: Flame },
  { emoji: '💡', icon: Lightbulb },
  { emoji: '🎉', icon: PartyPopper },
];

function typeLabel(type: string) {
  switch (type) {
    case 'todo_detected': return { text: 'TODO Detected', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    case 'fixme_resolved': return { text: 'Fixme Resolved', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    case 'planning_done': return { text: 'Planning Done', color: 'text-purple-600 bg-purple-50 border-purple-200' };
    case 'ai_event': return { text: 'AI Event', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    default: return { text: 'Post', color: 'text-slate-600 bg-slate-50 border-slate-200' };
  }
}

export default function FeedPage() {
  const { feedPosts, refreshFeed } = useRealtime();
  const { isDev } = useWorkspaceRole();
  const [newPost, setNewPost] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const createPost = async () => {
    if (!newPost.trim()) return;
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPost }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewPost('');
      refreshFeed();
      toast.success('Posted');
    } catch (err) {
      console.error('Create post failed:', err);
      toast.error('Failed to create post');
    }
  };

  const addReply = async (postId: string) => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/feed/${postId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReplyText('');
      setReplyingTo(null);
      refreshFeed();
      toast.success('Reply added');
    } catch (err) {
      console.error('Reply failed:', err);
      toast.error('Failed to add reply');
    }
  };

  const toggleReaction = async (postId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/feed/${postId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refreshFeed();
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Project Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Updates, decisions, and AI events
        </p>
      </div>

      {isDev && (
        <div className="flex gap-2">
          <Input
            placeholder="Share an update..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createPost()}
          />
          <Button onClick={createPost} disabled={!newPost.trim()} size="sm">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {feedPosts.map((post: FeedPost) => {
          const label = typeLabel(post.type);
          return (
            <Card key={post.id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px] h-5', label.color)}>
                    {label.text}
                  </Badge>
                  <span className="text-xs text-muted-foreground capitalize">{post.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm mb-3">{post.content}</p>

                {/* Reactions */}
                <div className="flex items-center gap-1 mb-3">
                  {REACTIONS.map(({ emoji, icon: Icon }) => {
                    const count = post.reactions?.[emoji]?.length || 0;
                    const hasReacted = post.reactions?.[emoji]?.includes('me');
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                          hasReacted
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted text-muted-foreground'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {count > 0 && count}
                      </button>
                    );
                  })}
                </div>

                {/* Replies */}
                {post.replies?.length > 0 && (
                  <div className="space-y-2 mb-3 pl-4 border-l-2 border-muted">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className="text-sm">
                        <span className="font-medium text-xs">{reply.author}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {new Date(reply.timestamp).toLocaleDateString()}
                        </span>
                        <p className="text-muted-foreground mt-0.5">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyingTo === post.id ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addReply(post.id)}
                      autoFocus
                    />
                    <Button onClick={() => addReply(post.id)} size="sm" variant="outline">
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setReplyingTo(post.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reply
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
