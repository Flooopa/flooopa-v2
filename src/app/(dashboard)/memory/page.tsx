'use client';

import { useEffect, useState } from 'react';
import { Brain, Save, Bug, Lightbulb, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MemoryState {
  global: {
    preferences: string[];
    coding_style: string;
    active_systems: string[];
    always_inject: string;
  };
  project: {
    decisions: Array<{ text: string; created: string }>;
    known_bugs: Array<{ text: string; created: string }>;
    name: string;
  };
  session: string[];
}

export default function MemoryPage() {
  const [memory, setMemory] = useState<MemoryState>({
    global: { preferences: [], coding_style: '', active_systems: [], always_inject: '' },
    project: { decisions: [], known_bugs: [], name: 'default' },
    session: [],
  });
  const [rememberText, setRememberText] = useState('');
  const [rememberType, setRememberType] = useState<'decision' | 'bug'>('decision');

  useEffect(() => {
    fetch('/api/memory')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setMemory(data))
      .catch(console.error);
  }, []);

  const handleRemember = async () => {
    if (!rememberText.trim()) return;
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rememberText, type: rememberType }),
      });
      if (res.ok) {
        setRememberText('');
        const updated = await fetch('/api/memory').then((r) => r.json());
        setMemory(updated);
        toast.success('Saved to memory');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save memory');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Memory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global preferences, project decisions, and session context
        </p>
      </div>

      {/* Remember This */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4" /> Remember This
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a decision, bug, or preference to remember..."
              value={rememberText}
              onChange={(e) => setRememberText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRemember()}
            />
            <Select value={rememberType} onValueChange={(v) => setRememberType(v as 'decision' | 'bug')}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleRemember} size="sm">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Project Decisions */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Decisions
            </h3>
          </CardHeader>
          <CardContent>
            {memory.project?.decisions?.length > 0 ? (
              <ul className="space-y-2">
                {memory.project.decisions.map((d, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div>
                      {d.text}
                      <span className="text-xs ml-2 text-muted-foreground/70">
                        {new Date(d.created).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Known Bugs */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <Bug className="w-4 h-4 text-red-500" /> Known Bugs
            </h3>
          </CardHeader>
          <CardContent>
            {memory.project?.known_bugs?.length > 0 ? (
              <ul className="space-y-2">
                {memory.project.known_bugs.map((b, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                    <div>
                      {b.text}
                      <span className="text-xs ml-2 text-muted-foreground/70">
                        {new Date(b.created).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No bugs recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-blue-500" /> Preferences
            </h3>
          </CardHeader>
          <CardContent>
            {memory.global?.preferences?.length > 0 ? (
              <ul className="space-y-2">
                {memory.global.preferences.map((p, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No preferences recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Active Systems */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <Brain className="w-4 h-4 text-purple-500" /> Active Systems
            </h3>
          </CardHeader>
          <CardContent>
            {memory.global?.active_systems?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {memory.global.active_systems.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active systems recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
