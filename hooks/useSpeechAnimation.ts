'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechAnimationOptions {
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  smoothing?: number; // Audio level smoothing (0-1)
}

export function useSpeechAnimation(options: UseSpeechAnimationOptions = {}) {
  const {
    onSpeakingStart,
    onSpeakingEnd,
    smoothing = 0.8
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Monitor speech synthesis events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    const handleStart = () => {
      setIsSpeaking(true);
      onSpeakingStart?.();
    };

    const handleEnd = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      onSpeakingEnd?.();
    };

    // Note: We'll need to attach these to individual utterances
    // This is a placeholder for the pattern
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onSpeakingStart, onSpeakingEnd]);

  // Simulate audio levels based on speaking state
  // Note: Real audio monitoring from Web Speech API is limited
  // We'll use a simulated approach for MVP
  useEffect(() => {
    if (!isSpeaking) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioLevel(0);
      return;
    }

    // Simulate audio levels with a wave pattern
    const startTime = Date.now();

    const updateAudioLevel = () => {
      const elapsed = Date.now() - startTime;
      // Create a natural wave pattern using multiple sine waves
      const baseWave = Math.sin(elapsed / 200) * 0.5;
      const detailWave = Math.sin(elapsed / 50) * 0.3;
      const randomness = Math.random() * 0.2;

      const level = Math.max(0, Math.min(1,
        0.4 + baseWave + detailWave + randomness
      ));

      setAudioLevel(level);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpeaking]);

  // Attach event listeners to an utterance
  const attachToUtterance = useCallback((utterance: SpeechSynthesisUtterance) => {
    const handleStart = () => {
      setIsSpeaking(true);
      onSpeakingStart?.();
    };

    const handleEnd = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      onSpeakingEnd?.();
    };

    const handleError = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      onSpeakingEnd?.();
    };

    utterance.addEventListener('start', handleStart);
    utterance.addEventListener('end', handleEnd);
    utterance.addEventListener('error', handleError);

    // Return cleanup function
    return () => {
      utterance.removeEventListener('start', handleStart);
      utterance.removeEventListener('end', handleEnd);
      utterance.removeEventListener('error', handleError);
    };
  }, [onSpeakingStart, onSpeakingEnd]);

  // Manual controls for testing
  const startSpeaking = useCallback(() => {
    setIsSpeaking(true);
    onSpeakingStart?.();
  }, [onSpeakingStart]);

  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    setAudioLevel(0);
    onSpeakingEnd?.();
  }, [onSpeakingEnd]);

  return {
    isSpeaking,
    audioLevel,
    attachToUtterance,
    startSpeaking,
    stopSpeaking,
  };
}
