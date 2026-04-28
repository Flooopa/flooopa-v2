'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_AI_GATEWAY_URL || '';
const HEALTH_INTERVAL = 10000;
const HEALTH_TIMEOUT = 5000;

export type ConnectionState = 'connected' | 'degraded' | 'disconnected' | 'checking';

interface HealthRecord {
  timestamp: number;
  state: ConnectionState;
  latency: number;
  error?: string;
}

interface UseConnectionReturn {
  state: ConnectionState;
  latency: number;
  isOnline: boolean;
  lastCheck: Date | null;
  history: HealthRecord[];
  checkNow: () => Promise<void>;
}

export function useConnection(): UseConnectionReturn {
  const [state, setState] = useState<ConnectionState>('checking');
  const [latency, setLatency] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [history, setHistory] = useState<HealthRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const checkNow = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const start = performance.now();
    let record: HealthRecord;

    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, {
        method: 'HEAD',
        signal: abortRef.current.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      const ms = Math.round(performance.now() - start);
      const newState: ConnectionState = res.ok ? 'connected' : 'degraded';
      record = { timestamp: Date.now(), state: newState, latency: ms };
      setState(newState);
      setLatency(ms);
    } catch (err: any) {
      const ms = Math.round(performance.now() - start);
      record = { timestamp: Date.now(), state: 'disconnected', latency: ms, error: err.message };
      setState('disconnected');
      setLatency(ms);
    }

    setLastCheck(new Date());
    setHistory((prev) => {
      const next = [...prev, record];
      if (next.length > 20) next.shift();
      return next;
    });
  }, []);

  // Periodic health check
  useEffect(() => {
    checkNow();
    const id = setInterval(checkNow, HEALTH_INTERVAL);
    return () => clearInterval(id);
  }, [checkNow]);

  // Browser online/offline detection
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // If browser goes offline, force disconnected state
  useEffect(() => {
    if (!isOnline) setState('disconnected');
  }, [isOnline]);

  return { state, latency, isOnline, lastCheck, history, checkNow };
}
