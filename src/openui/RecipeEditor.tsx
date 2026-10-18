"use client";

/**
 * Dev-only: edit the page recipe and watch the page change.
 * Changes live only in this browser tab; the file in layouts/ is not touched.
 */
import { useState } from "react";

interface Props {
  value: string;
  original: string;
  onChange: (next: string) => void;
}

export default function RecipeEditor({ value, original, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const edited = value !== original;

  return (
    <section className="mt-16 mb-10 max-w-4xl border border-dashed border-slate-300 rounded-lg text-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div>
          <p className="font-medium text-slate-700">Page recipe (dev only)</p>
          <p className="text-xs text-slate-400">
            Edit the OpenUI Lang below. The page above updates as you type. The file is not changed.
          </p>
        </div>
        <div className="flex gap-2">
          {edited && (
            <button
              type="button"
              onClick={() => onChange(original)}
              className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
            >
              Reset to file
            </button>
          )}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-1.5 rounded bg-slate-700 text-white hover:bg-slate-800"
          >
            {open ? "Hide recipe" : "Show recipe"}
          </button>
        </div>
      </div>
      {open && (
        <textarea
          id="recipe-editor"
          aria-label="Page recipe"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-64 font-mono text-xs leading-relaxed p-4 border-t border-dashed border-slate-300 outline-none resize-y bg-slate-50 text-slate-700"
        />
      )}
    </section>
  );
}
