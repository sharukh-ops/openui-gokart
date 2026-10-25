"use client";

/**
 * The floating Ask button: the user describes a visualisation, /api/ask returns
 * a checked recipe, and the page is redrawn from it.
 */
import { SendIcon, SparklesIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EXAMPLES = ["Revenue by store as a bar chart", "Orders by status as a pie chart", "Top selling products"];

interface Props {
  onRecipe: (source: string, question: string) => void;
}

export default function AskButton({ onRecipe }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || asking) return;
    setAsking(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as
        | { source?: string; error?: { message?: string } }
        | null;
      if (!response.ok || typeof body?.source !== "string") {
        throw new Error(body?.error?.message ?? `The request failed (HTTP ${response.status}).`);
      }
      onRecipe(body.source, trimmed);
      setOpen(false);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <form
          role="dialog"
          aria-label="Ask for a visualisation"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-[22rem] max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-sm text-slate-600"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-slate-800">What would you like to see?</p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-slate-100"
            >
              <XIcon size={16} />
            </button>
          </div>
          <textarea
            ref={input}
            aria-label="Your question"
            value={question}
            maxLength={500}
            rows={3}
            disabled={asking}
            placeholder="e.g. Revenue by store as a bar chart"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
            className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:border-slate-400 resize-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={asking}
                onClick={() => {
                  setQuestion(example);
                  void ask(example);
                }}
                className="px-2 py-1 rounded-full bg-slate-100 text-xs hover:bg-slate-200 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-xs text-red-700 bg-red-50 rounded-lg p-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={asking || question.trim().length < 3}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {asking ? "Building your page…" : "Show me"}
            {!asking && <SendIcon size={14} />}
          </button>
        </form>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-5 py-3 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-900"
      >
        <SparklesIcon size={18} />
        Ask
      </button>
    </div>
  );
}
