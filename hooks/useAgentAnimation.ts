import { useState, useEffect, useCallback } from 'react';
import type { Emotion, AnimationState, AgentState } from '@/types/agent';

interface UseAgentAnimationOptions {
  defaultEmotion?: Emotion;
  onEmotionChange?: (emotion: Emotion) => void;
}

export function useAgentAnimation(options: UseAgentAnimationOptions = {}) {
  const { defaultEmotion = 'neutral', onEmotionChange } = options;

  const [agentState, setAgentState] = useState<AgentState>({
    emotion: defaultEmotion,
    animationState: 'idle',
    isSpeaking: false,
    audioLevel: 0
  });

  const setEmotion = useCallback((emotion: Emotion) => {
    setAgentState(prev => ({ ...prev, emotion }));
    onEmotionChange?.(emotion);
  }, [onEmotionChange]);

  const setAnimationState = useCallback((animationState: AnimationState) => {
    setAgentState(prev => ({ ...prev, animationState }));
  }, []);

  const setIsSpeaking = useCallback((isSpeaking: boolean) => {
    setAgentState(prev => ({
      ...prev,
      isSpeaking,
      animationState: isSpeaking ? 'talking' : 'idle'
    }));
  }, []);

  const setAudioLevel = useCallback((audioLevel: number) => {
    setAgentState(prev => ({ ...prev, audioLevel }));
  }, []);

  const resetToIdle = useCallback(() => {
    setAgentState(prev => ({
      ...prev,
      animationState: 'idle',
      isSpeaking: false,
      audioLevel: 0
    }));
  }, []);

  return {
    agentState,
    setEmotion,
    setAnimationState,
    setIsSpeaking,
    setAudioLevel,
    resetToIdle
  };
}
