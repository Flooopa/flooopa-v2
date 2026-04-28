'use client';

import { useCallback, useRef, useState } from 'react';

const SOUNDS = {
  complete: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==', // placeholder — will generate real sounds
  error: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==',
};

// Real soft notification sounds (short beep patterns)
const COMPLETE_BUZZER = `data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU${'A'.repeat(100)}`;

function generateTone(freq: number, duration: number, sampleRate = 44100): string {
  const samples = Math.floor(sampleRate * duration);
  const data = new Uint8Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const val = Math.sin(2 * Math.PI * freq * t) * 127 + 128;
    data[i] = Math.floor(val);
  }
  // Simple WAV header for 8-bit mono
  const wav = new Uint8Array(44 + samples);
  const view = new DataView(wav.buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, 'data');
  view.setUint32(40, samples, true);
  wav.set(data, 44);
  const bin = Array.from(wav, (b) => String.fromCharCode(b)).join('');
  return 'data:audio/wav;base64,' + btoa(bin);
}

// Generate on first use to avoid SSR issues
let completeSoundUrl = '';
let errorSoundUrl = '';

function getSounds() {
  if (typeof window === 'undefined') return { complete: '', error: '' };
  if (!completeSoundUrl) {
    completeSoundUrl = generateTone(880, 0.15);
    errorSoundUrl = generateTone(220, 0.3);
  }
  return { complete: completeSoundUrl, error: errorSoundUrl };
}

export function useSound() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ai-sound-enabled') === 'true';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((type: 'complete' | 'error') => {
    if (!enabled) return;
    try {
      const sounds = getSounds();
      const url = sounds[type];
      if (!url) return;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.volume = 0.3;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {
      // ignore audio errors
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('ai-sound-enabled', String(next));
      return next;
    });
  }, []);

  return { enabled, toggle, play };
}
