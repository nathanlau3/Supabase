"use client";

import { useEffect, useState, useCallback } from "react";

interface UseSpeechSynthesisOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useSpeechSynthesis({
  lang = "id-ID", // Default to Indonesian
  rate = 1,
  pitch = 1,
  volume = 1,
}: UseSpeechSynthesisOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Check if browser supports Speech Synthesis
    if (!window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // Load available voices
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();

    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // CHROME FIX: Initialize speech synthesis with user interaction
    // Chrome requires a user gesture before speech synthesis works
    const initSpeech = () => {
      // Speak empty utterance to initialize (Chrome requirement)
      const utterance = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(utterance);
      console.log("✓ Speech synthesis initialized for Chrome");
    };

    // Listen for any user interaction to initialize
    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      document.addEventListener(event, initSpeech, { once: true });
    });

    return () => {
      window.speechSynthesis.cancel();
      events.forEach((event) => {
        document.removeEventListener(event, initSpeech);
      });
    };
  }, []);

  const speak = useCallback(
    (text: string, customLang?: string) => {
      if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported");
        return;
      }

      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      // Clean text: remove markdown formatting and special characters
      let cleanText = text
        .replace(/\*\*/g, '') // Remove bold **
        .replace(/\*/g, '') // Remove italic *
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links [text](url) -> text
        .replace(/`/g, '') // Remove code backticks
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Limit text length (some voices have issues with very long text)
      const MAX_LENGTH = 500;
      if (cleanText.length > MAX_LENGTH) {
        cleanText = cleanText.substring(0, MAX_LENGTH) + '...';
        console.warn(`Text truncated from ${text.length} to ${MAX_LENGTH} characters for speech synthesis`);
      }

      console.log("Cleaned text for speech:", cleanText.substring(0, 100) + "...");

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const targetLang = customLang || lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Get fresh voices list (in case it wasn't loaded yet)
      const availableVoices = window.speechSynthesis.getVoices();

      // Try to find a voice for the specified language
      const langPrefix = targetLang.split("-")[0];
      let voice = availableVoices.find((v) => v.lang.startsWith(targetLang)); // Exact match first

      if (!voice) {
        voice = availableVoices.find((v) => v.lang.startsWith(langPrefix));
      }

      // Fallback to English if target language not available
      if (!voice) {
        voice = availableVoices.find((v) => v.lang.startsWith("en"));
      }

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
        console.log(`Using voice: ${voice.name} (${voice.lang})`);
      } else {
        utterance.lang = targetLang;
        console.warn("No voice selected, using browser default");
      }

      utterance.onstart = () => {
        console.log("✓ Speech started");
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        console.log("✓ Speech ended");
        setIsSpeaking(false);
      };

      utterance.onerror = (event) => {
        console.error("✗ Speech synthesis error:", event.error);
        setIsSpeaking(false);
      };

      // CHROME WORKAROUND: Resume before speaking (critical for Chrome)
      // Chrome often has speech synthesis in a "stuck" state
      window.speechSynthesis.resume();

      // Speak the utterance
      window.speechSynthesis.speak(utterance);
      console.log("→ Speech queued, text length:", cleanText.length);

      // CHROME WORKAROUND: Force resume after queueing (fixes Chrome bug)
      setTimeout(() => {
        window.speechSynthesis.resume();
        console.log("→ Forced resume after queueing");
      }, 100);
    },
    [lang, rate, pitch, volume]
  );

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isSupported,
    voices,
  };
}
