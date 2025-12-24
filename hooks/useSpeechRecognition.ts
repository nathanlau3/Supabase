"use client";

import { useEffect, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  lang?: string;
  continuous?: boolean;
  handleFinish?: () => void;
}

export function useSpeechRecognition({
  onResult,
  onError,
  lang = "id-ID", // Default to Indonesian
  continuous = false,
  handleFinish,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef<string>(""); // Accumulate full transcript in continuous mode

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      onError?.("Speech recognition is not supported in this browser");
      return;
    }

    setIsSupported(true);

    // Initialize recognition
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // In continuous mode, accumulate all final transcripts
      if (finalTranscript && continuous) {
        fullTranscriptRef.current +=
          (fullTranscriptRef.current ? " " : "") + finalTranscript;
        const fullText =
          fullTranscriptRef.current +
          (interimTranscript ? " " + interimTranscript : "");
        setTranscript(fullText);
        onResult?.(fullText);
      } else {
        // In non-continuous mode, just send the current transcript
        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        if (finalTranscript) {
          onResult?.(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      onError?.(event.error);
    };

    recognition.onend = () => {
      handleFinish?.();
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [lang, continuous, onResult, onError, handleFinish]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      fullTranscriptRef.current = ""; // Reset accumulated transcript
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
