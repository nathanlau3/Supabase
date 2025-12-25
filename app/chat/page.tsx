"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useChat } from "ai/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatPage() {
  const supabase = createClientComponentClient();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const inputRef = useRef<string>("");

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
    lang: "id-ID", // Indonesian
    continuous: true, // Keep listening until manually stopped
    handleFinish: submitVoiceInput,
  });

  const {
    speak,
    cancel,
    isSpeaking,
    isSupported: isSpeechSynthesisSupported,
  } = useSpeechSynthesis({
    lang: "id-ID", // Indonesian
    rate: 1,
    pitch: 1,
    volume: 1,
  });

  // Auto-speak assistant responses
  useEffect(() => {
    if (autoSpeak && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        speak(lastMessage.content);
      }
    }
  }, [messages, autoSpeak, speak]);

  return (
    <div className="max-w-6xl flex flex-col items-center w-full h-full">
      <div className="flex flex-col w-full gap-6 grow my-2 sm:my-10 p-4 sm:p-8 sm:border rounded-sm overflow-y-auto">
        {/* Speech Controls */}
        <div className="flex items-center justify-between gap-4 p-2 border-b">
          <div className="flex items-center gap-2">
            {isSpeechRecognitionSupported ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleListening}
                className={cn(
                  isListening && "bg-red-100 border-red-500 text-red-700",
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
              <p className="text-xs text-gray-500">Voice input not supported</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSpeechSynthesisSupported && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={cn(autoSpeak && "bg-green-100 border-green-500")}
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
                  >
                    Stop Speaking
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-slate-400 rounded-lg flex flex-col justify-start gap-4 pr-2 grow overflow-y-scroll">
          {messages.map(({ id, role, content }) => (
            <div
              key={id}
              className={cn(
                "rounded-xl bg-gray-500 text-white px-4 py-2 max-w-lg",
                role === "user" ? "self-end bg-blue-600" : "self-start",
              )}
            >
              {role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Customize rendering for better styling
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc ml-4 mb-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal ml-4 mb-2">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="mb-1">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-bold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      code: ({ children }) => (
                        <code className="bg-gray-700 px-1 py-0.5 rounded text-sm">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-gray-700 p-2 rounded my-2 overflow-x-auto">
                          {children}
                        </pre>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="self-start m-6 text-gray-500 before:text-gray-500 after:text-gray-500 dot-pulse" />
          )}
          {messages.length === 0 && (
            <div className="self-stretch flex grow items-center justify-center">
              <svg
                className="opacity-10"
                width="150px"
                height="150px"
                version="1.1"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g>
                  <path d="m77.082 39.582h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25h20.832l8.332 8.332v-8.332c3.543 0 6.25-2.918 6.25-6.25v-16.668c0-3.5391-2.707-6.25-6.25-6.25z" />
                  <path d="m52.082 25h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25v8.332l8.332-8.332h6.25v-8.332c0-5.832 4.582-10.418 10.418-10.418h10.418v-4.168c-0.003907-3.543-2.7109-6.25-6.2539-6.25z" />
                </g>
              </svg>
            </div>
          )}
        </div>
        <form
          className="flex items-center space-x-2 gap-2"
          onSubmit={handleSubmit}
        >
          <Input
            type="text"
            autoFocus
            placeholder="Send a message or use voice input"
            value={input}
            onChange={handleInputChange}
          />
          <Button type="submit" disabled={isLoading || !authToken}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
