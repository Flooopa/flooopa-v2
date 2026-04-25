'use client';

import { Zap, Brain, MessageSquare, Shield, Wand2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How the AI Orchestrator works
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Pipeline Modes
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li><strong className="text-foreground">Code</strong> — Kimi primary for implementation tasks</li>
              <li><strong className="text-foreground">Planning</strong> — Claude primary for architecture & design</li>
              <li><strong className="text-foreground">Content</strong> — Claude primary for docs & copy</li>
              <li><strong className="text-foreground">Research</strong> — Both AIs investigate independently</li>
              <li><strong className="text-foreground">Debate</strong> — Multi-round critique with confidence scoring</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-500" /> Confidence Scoring
            </h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              After each round, the critic scores output confidence (1–10). If {'<'} 6, an extra revision round runs.
              If {'≤'} 8, a synthesis round combines the best outputs. Planning mode forces 3–5 rounds.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" /> Board & Feed
            </h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The Board tracks TODOs and FIXMEs. Drag cards to reorder the AI work queue.
              Auto Mode processes top-to-bottom. The Feed logs all project activity including AI decisions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" /> Access Tiers
            </h3>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li><strong className="text-foreground">Owner</strong> — Full AI system + member management</li>
              <li><strong className="text-foreground">Developer</strong> — Board + feed + create content</li>
              <li><strong className="text-foreground">Viewer</strong> — Public read-only view</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
