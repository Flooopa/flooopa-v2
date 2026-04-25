'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { UserRole } from '@/types';

export function useWorkspaceRole() {
  const { userId, isLoaded } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !userId) {
      setLoading(false);
      return;
    }

    async function fetchRole() {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          setRole(data.role as UserRole);
        } else {
          setRole('viewer');
        }
      } catch {
        setRole('viewer');
      }
      setLoading(false);
    }

    fetchRole();
  }, [isLoaded, userId]);

  return {
    role,
    loading,
    isOwner: role === 'owner',
    isDev: role === 'owner' || role === 'dev',
  };
}
