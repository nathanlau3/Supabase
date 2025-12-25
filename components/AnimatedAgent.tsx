'use client';

import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Emotion, AnimationState } from '@/types/agent';
import { EMOTION_CONFIGS } from '@/types/agent';

interface AnimatedAgentProps {
  emotion?: Emotion;
  isSpeaking?: boolean;
  audioLevel?: number;
  className?: string;
}

export function AnimatedAgent({
  emotion = 'neutral',
  isSpeaking = false,
  audioLevel = 0,
  className
}: AnimatedAgentProps) {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isSpeaking) {
      setAnimationState('talking');
    } else {
      setAnimationState('idle');
    }
  }, [isSpeaking]);

  useEffect(() => {
    if (isSpeaking && audioLevel > 0) {
      const newScale = 1 + (audioLevel * 0.1);
      setScale(newScale);
    } else {
      setScale(1);
    }
  }, [isSpeaking, audioLevel]);

  const emotionConfig = EMOTION_CONFIGS[emotion];
  const isPulsing = animationState === 'talking';

  return (
    <div className={cn('flex flex-col items-center gap-4 p-6', className)}>
      <div className="relative">
        <div
          className={cn(
            'absolute inset-0 rounded-full blur-2xl transition-all duration-300',
            isPulsing && 'animate-pulse-glow'
          )}
          style={{
            background: `radial-gradient(circle, ${emotionConfig.color}40 0%, transparent 70%)`
          }}
        />

        <div
          className={cn(
            'relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300',
            'gradient-border bg-card',
            isPulsing && 'animate-pulse'
          )}
          style={{
            transform: `scale(${scale})`,
            borderColor: emotionConfig.color
          }}
        >
          <Bot
            className="w-16 h-16 transition-colors duration-500"
            style={{ color: emotionConfig.color }}
          />

          {isPulsing && (
            <div className="absolute inset-0 rounded-full border-4 animate-ping opacity-20"
              style={{ borderColor: emotionConfig.color }}
            />
          )}
        </div>

        {animationState === 'listening' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-4 bg-primary rounded-full animate-bounce"
                  style={{
                    animationDelay: `${i * 150}ms`,
                    animationDuration: '0.6s'
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center space-y-1">
        <div
          className="text-sm font-semibold capitalize transition-colors duration-500"
          style={{ color: emotionConfig.color }}
        >
          {emotion}
        </div>
        <div className="text-xs text-muted-foreground">
          {emotionConfig.description}
        </div>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-150 rounded-full"
            style={{
              width: isSpeaking ? `${Math.min(audioLevel * 100, 100)}%` : '0%'
            }}
          />
        </div>
      </div>
    </div>
  );
}
