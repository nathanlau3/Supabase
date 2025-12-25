import type { Emotion } from '@/types/agent';

const VALID_EMOTIONS: Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'excited',
  'thinking',
  'confused',
  'empathetic'
];

export interface ParsedMessage {
  emotion: Emotion;
  content: string;
}

export function parseEmotion(content: string): ParsedMessage {
  const emotionMatch = content.match(/\[EMOTION:\s*(\w+)\]/i);

  if (emotionMatch) {
    const emotionStr = emotionMatch[1].toLowerCase();
    const emotion = VALID_EMOTIONS.includes(emotionStr as Emotion)
      ? (emotionStr as Emotion)
      : 'neutral';

    const cleanContent = content.replace(/\[EMOTION:\s*\w+\]\s*/i, '').trim();

    return {
      emotion,
      content: cleanContent
    };
  }

  return {
    emotion: 'neutral',
    content
  };
}

export function detectEmotionFromKeywords(content: string): Emotion {
  const lowerContent = content.toLowerCase();

  if (
    lowerContent.includes('!') ||
    lowerContent.includes('awesome') ||
    lowerContent.includes('great') ||
    lowerContent.includes('excellent')
  ) {
    return 'excited';
  }

  if (
    lowerContent.includes('😊') ||
    lowerContent.includes('glad') ||
    lowerContent.includes('happy') ||
    lowerContent.includes('pleased')
  ) {
    return 'happy';
  }

  if (
    lowerContent.includes('sorry') ||
    lowerContent.includes('unfortunately') ||
    lowerContent.includes('sad')
  ) {
    return 'sad';
  }

  if (
    lowerContent.includes('understand') ||
    lowerContent.includes('know how you feel') ||
    lowerContent.includes('here for you')
  ) {
    return 'empathetic';
  }

  if (
    lowerContent.includes('let me think') ||
    lowerContent.includes('analyzing') ||
    lowerContent.includes('processing')
  ) {
    return 'thinking';
  }

  if (
    lowerContent.includes('confused') ||
    lowerContent.includes('unclear') ||
    lowerContent.includes('not sure what you mean')
  ) {
    return 'confused';
  }

  return 'neutral';
}

export function inferEmotionFromSentiment(content: string): Emotion {
  const parsed = parseEmotion(content);

  if (parsed.emotion !== 'neutral') {
    return parsed.emotion;
  }

  return detectEmotionFromKeywords(parsed.content);
}
