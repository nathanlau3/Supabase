"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useChat } from "ai/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useSpeechAnimation } from "@/hooks/useSpeechAnimation";
import { useAgentAnimation } from "@/hooks/useAgentAnimation";
import { AnimatedAgent } from "@/components/AnimatedAgent";
import { inferEmotionFromSentiment, parseEmotion } from "@/lib/emotionMapper";
import type { Emotion } from "@/types/agent";
import { Mic, MicOff, Volume2, VolumeX, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatPage() {
  const supabase = createClientComponentClient();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const inputRef = useRef<string>("");
  const inputElementRef = useRef<HTMLInputElement>(null);

  // Agent animation state
  const {
    agentState,
    setEmotion,
    setIsSpeaking: setAgentSpeaking,
    setAudioLevel,
  } = useAgentAnimation({
    defaultEmotion: "neutral",
  });

  // Speech animation monitoring
  const { isSpeaking: speechAnimationActive, audioLevel: speechAudioLevel } =
    useSpeechAnimation();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setAuthToken(session.access_token);
      }
    };
    getSession();
  }, [supabase]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    headers: authToken
      ? {
          Authorization: `Bearer ${authToken}`,
        }
      : {},
  });

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Create stable submit handler
  const submitVoiceInput = useCallback(() => {
    console.log("handleFinish called, current input:", inputRef.current);
    // Only submit if there's text
    if (inputRef.current && inputRef.current.trim().length > 0) {
      const syntheticEvent = new Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      handleSubmit(syntheticEvent as any);
    }
  }, [handleSubmit]);

  const {
    isListening,
    isSupported: isSpeechRecognitionSupported,
    toggleListening,
  } = useSpeechRecognition({
    onResult: (transcript) => {
      setInput(transcript);
    },
    onError: (error) => {
      console.error("Speech recognition error:", error);
    },
    lang: "id-ID", // Indonesian (Bahasa Indonesia)
    continuous: true, // Keep listening until manually stopped
    handleFinish: submitVoiceInput,
  });

  const handleToggleListening = useCallback(() => {
    console.log("Toggle listening clicked");
    toggleListening();
  }, [toggleListening]);

  const handleToggleAutoSpeak = useCallback(() => {
    console.log("Toggle auto-speak clicked");
    setAutoSpeak((prev) => !prev);
  }, []);

  const {
    speak,
    cancel,
    isSpeaking,
    isSupported: isSpeechSynthesisSupported,
  } = useSpeechSynthesis({
    lang: "id-ID", // Indonesian (Bahasa Indonesia)
    rate: 1,
    pitch: 1,
    volume: 1,
  });

  // Parse emotion from last assistant message and update agent
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        const emotion = inferEmotionFromSentiment(lastMessage.content);
        setCurrentEmotion(emotion);
        setEmotion(emotion);
      }
    }
  }, [messages, setEmotion]);

  // Auto-speak assistant responses
  useEffect(() => {
    console.log("Auto-speak effect triggered:", { autoSpeak, messagesLength: messages.length });
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log("Last message:", lastMessage);
      if (lastMessage.role === "assistant") {
        // Parse and remove emotion tags before speaking
        const { content: cleanContent } = parseEmotion(lastMessage.content);
        console.log("Speaking content:", cleanContent);
        speak(cleanContent);
      }
    }
  }, [messages, autoSpeak, speak]);

  // Sync agent speaking state with speech synthesis
  useEffect(() => {
    setAgentSpeaking(isSpeaking);
  }, [isSpeaking, setAgentSpeaking]);

  // Sync audio level with agent
  useEffect(() => {
    setAudioLevel(speechAudioLevel);
  }, [speechAudioLevel, setAudioLevel]);

  return (
    <div className="max-w-7xl flex flex-col items-center w-full h-full relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />

      <div className="flex flex-col lg:flex-row w-full gap-6 grow my-4 sm:my-8 p-6 sm:p-8 relative z-10">
        {/* Animated Agent Section */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="gradient-border p-4 backdrop-blur-sm sticky top-4">
            <AnimatedAgent
              emotion={agentState.emotion}
              isSpeaking={agentState.isSpeaking}
              audioLevel={agentState.audioLevel}
            />
          </div>
        </div>

        {/* Chat Section */}
        <div className="flex flex-col w-full gap-6 grow">
          <div className="gradient-border p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {isSpeechRecognitionSupported ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleListening}
                    className={cn(
                      "transition-all duration-300 border-border hover:border-primary/50",
                      isListening &&
                        "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20 ai-glow",
                    )}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2" />
                        Stop Listening
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Voice Input
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Voice input not supported
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isSpeechSynthesisSupported && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleAutoSpeak}
                      className={cn(
                        "transition-all duration-300 border-border hover:border-primary/50",
                        autoSpeak &&
                          "bg-primary/10 border-primary text-primary hover:bg-primary/20 ai-glow",
                      )}
                    >
                      {autoSpeak ? (
                        <>
                          <Volume2 className="h-4 w-4 mr-2" />
                          Auto-speak On
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-4 w-4 mr-2" />
                          Auto-speak Off
                        </>
                      )}
                    </Button>
                    {isSpeaking && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={cancel}
                        className="border-border hover:border-primary/50 transition-all duration-300"
                      >
                        Stop Speaking
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-start gap-6 grow overflow-y-auto px-2 pb-4">
            {messages.map(({ id, role, content }) => {
              // Parse and clean emotion tags from assistant messages
              const displayContent =
                role === "assistant" ? parseEmotion(content).content : content;

              return (
                <div
                  key={id}
                  className={cn(
                    "flex gap-4 items-start animate-in fade-in slide-in-from-bottom-4 duration-500",
                    role === "user" ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                      role === "user"
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-card border border-border ai-glow",
                    )}
                  >
                    {role === "user" ? (
                      <User className="w-5 h-5 text-primary" />
                    ) : (
                      <Bot className="w-5 h-5 text-primary" />
                    )}
                  </div>

                  <div
                    className={cn(
                      "flex-1 max-w-3xl rounded-2xl px-6 py-4 shadow-lg backdrop-blur-sm",
                      role === "user"
                        ? "bg-primary/10 border border-primary/20 text-foreground"
                        : "gradient-border",
                    )}
                  >
                    {role === "assistant" ? (
                      <div className="prose prose-slate prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0 text-foreground">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc ml-4 mb-2 text-foreground">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal ml-4 mb-2 text-foreground">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="mb-1 text-foreground">
                                {children}
                              </li>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-bold text-primary">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-foreground/70">
                                {children}
                              </em>
                            ),
                            code: ({ children }) => (
                              <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono text-primary">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-muted p-4 rounded-lg my-2 overflow-x-auto border border-border">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {displayContent}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-foreground">{displayContent}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-4 items-start animate-in fade-in duration-500">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border ai-glow">
                  <Bot className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="gradient-border rounded-2xl px-6 py-4 max-w-3xl">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex grow items-center justify-center flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                  <Bot className="w-24 h-24 text-primary/40 relative" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold gradient-text">
                    Start a Conversation
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Ask questions about your documents, analyze reports, or get
                    insights from your data
                  </p>
                </div>
              </div>
            )}
          </div>

          <form
            className="gradient-border p-4 backdrop-blur-sm sticky bottom-0"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center gap-3">
              <Input
                ref={inputElementRef}
                type="text"
                autoFocus
                placeholder="Ask anything about your documents..."
                value={input}
                onChange={handleInputChange}
                className="flex-1 bg-background/50 border-border focus:border-primary/50 transition-all duration-300"
              />
              <Button
                type="submit"
                disabled={isLoading || !authToken}
                className="bg-primary hover:bg-primary/90 text-primary-foreground ai-glow-lg transition-all duration-300 px-6"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>
          </form>
        </div>
        {/* End Chat Section */}
      </div>
    </div>
  );
}
