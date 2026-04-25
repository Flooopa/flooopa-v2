'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Trash2,
  Shield,
  User,
  Eye,
  Mail,
  Crown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'dev' | 'viewer';
  email: string | null;
  joined_at: string;
}

const roleConfig = {
  owner: { icon: Crown, color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Owner' },
  dev: { icon: Shield, color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Developer' },
  viewer: { icon: Eye, color: 'text-slate-500 bg-slate-50 border-slate-200', label: 'Viewer' },
};

export default function WorkspacePage() {
  const { isOwner, loading: roleLoading } = useWorkspaceRole();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'dev' | 'viewer'>('dev');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (roleLoading) return;
    if (!isOwner) {
      router.replace('/');
      return;
    }
    fetchMembers();
  }, [isOwner, roleLoading, router]);

  async function fetchMembers() {
    try {
      const res = await fetch('/api/workspace/members');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setInviteEmail('');
      fetchMembers();
      toast.success('Invitation sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(memberId: string, newRole: 'owner' | 'dev' | 'viewer') {
    try {
      const res = await fetch(`/api/workspace/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      fetchMembers();
      toast.success('Role updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member?')) return;
    try {
      const res = await fetch(`/api/workspace/members/${memberId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      fetchMembers();
      toast.success('Member removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage members and permissions
        </p>
      </div>

      {/* Invite */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Invite Member
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Email address..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'dev' | 'viewer')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dev">Developer</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={inviteMember} disabled={!inviteEmail.trim() || inviting} size="sm">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Members ({members.length})
          </h3>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
          {members.map((member) => {
            const config = roleConfig[member.role];
            const RoleIcon = config.icon;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-card"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.email || member.user_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className={cn('text-[10px] h-6', config.color)}>
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
                <Select
                  value={member.role}
                  onValueChange={(v) => updateRole(member.id, v as 'owner' | 'dev' | 'viewer')}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="dev">Developer</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removeMember(member.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Invited members will be automatically onboarded when they first sign in.
          You cannot remove or demote the last owner.
        </p>
      </div>
    </div>
  );
}
