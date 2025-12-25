export type Emotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'excited'
  | 'thinking'
  | 'confused'
  | 'empathetic';

export type AnimationState =
  | 'idle'
  | 'talking'
  | 'listening';

export interface AgentState {
  emotion: Emotion;
  animationState: AnimationState;
  isSpeaking: boolean;
  audioLevel?: number;
}

export interface EmotionConfig {
  emotion: Emotion;
  animationUrl?: string;
  color: string;
  description: string;
}

export const EMOTION_CONFIGS: Record<Emotion, EmotionConfig> = {
  neutral: {
    emotion: 'neutral',
    color: '#9CA3AF',
    description: 'Calm and attentive'
  },
  happy: {
    emotion: 'happy',
    color: '#22C55E',
    description: 'Cheerful and positive'
  },
  sad: {
    emotion: 'sad',
    color: '#3B82F6',
    description: 'Empathetic and understanding'
  },
  excited: {
    emotion: 'excited',
    color: '#F59E0B',
    description: 'Energetic and enthusiastic'
  },
  thinking: {
    emotion: 'thinking',
    color: '#8B5CF6',
    description: 'Processing and analyzing'
  },
  confused: {
    emotion: 'confused',
    color: '#EC4899',
    description: 'Seeking clarification'
  },
  empathetic: {
    emotion: 'empathetic',
    color: '#06B6D4',
    description: 'Caring and supportive'
  }
};
