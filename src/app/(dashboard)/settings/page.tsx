'use client';

import { useTheme } from '@/components/ThemeProvider';
import { Moon, Sun, Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your dashboard experience
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-medium text-sm">Appearance</h3>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={cn(theme === 'dark' && 'bg-primary hover:bg-primary/90')}
            >
              <Moon className="w-4 h-4 mr-2" /> Dark
            </Button>
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => theme !== 'light' && toggleTheme()}
              className={cn(theme === 'light' && 'bg-primary hover:bg-primary/90')}
            >
              <Sun className="w-4 h-4 mr-2" /> Light
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Globe className="w-4 h-4" /> Workspace
          </h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Workspace management and member invites coming soon.
          </p>
          <Separator />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Default Workspace</p>
              <p className="text-xs text-muted-foreground">Owner</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
