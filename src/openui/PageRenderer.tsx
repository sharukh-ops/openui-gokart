"use client";

/**
 * Draws one page from its recipe (OpenUI Lang).
 *
 * Loads the recipe from /api/layouts/<name>, renders it with the GoCart library,
 * and runs its Query() calls through /api/tool. Like GoCart, it shows a spinner
 * until data arrives, so the zero defaults never flash up as real numbers.
 * The Ask button can swap in a recipe written by the AI; "Back to dashboard"
 * restores the one from the file.
 */
import { Renderer, useRendererQuery, type OpenUIError } from "@openuidev/react-lang";
import { useEffect, useMemo, useState } from "react";
import Loading from "@/components/Loading";
import AskButton from "./AskButton";
import { gocartLibrary } from "./library";
import RecipeEditor from "./RecipeEditor";
import { createToolProvider } from "./toolProvider";

type RecipeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; fileSource: string };

const SHOW_EDITOR = process.env.NODE_ENV !== "production";

/** The page, hidden behind the spinner until the first data arrives and while a new query loads. */
function Content({ settled }: { settled: boolean }) {
  const { isLoading } = useRendererQuery();
  const show = settled && !isLoading;
  return (
    <>
      {!show && <Loading />}
      <Renderer.Content hidden={!show} />
    </>
  );
}

export default function PageRenderer({ layout }: { layout: string }) {
  const [recipe, setRecipe] = useState<RecipeState>({ status: "loading" });
  const [source, setSource] = useState("");
  const [dataSettled, setDataSettled] = useState(false);
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  const [asked, setAsked] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/layouts/${layout}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
        return body.source as string;
      })
      .then((text) => {
        if (cancelled) return;
        setRecipe({ status: "ready", fileSource: text });
        setSource(text);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRecipe({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [layout]);

  // Created once so the Renderer keeps its query cache between edits.
  const toolProvider = useMemo(() => createToolProvider(() => setDataSettled(true)), []);

  if (recipe.status === "loading") return <Loading />;
  if (recipe.status === "error") {
    return (
      <div role="alert" className="text-red-700 bg-red-50 rounded-lg p-4 max-w-2xl">
        Could not load the page recipe &quot;{layout}&quot;: {recipe.message}
      </div>
    );
  }

  const hasQuery = /\bQuery\(/.test(source);
  const ready = dataSettled || !hasQuery;
  const layoutErrors = errors.filter((e) => e.source !== "query");

  const fileSource = recipe.fileSource;

  return (
    <>
      {asked !== null && (
        <div className="mb-6 max-w-4xl flex flex-wrap items-center justify-between gap-3 text-sm bg-indigo-50 text-indigo-900 rounded-lg px-4 py-2.5">
          <span>
            Showing your request: <q className="font-medium">{asked}</q>
          </span>
          <button
            type="button"
            onClick={() => {
              setSource(fileSource);
              setAsked(null);
            }}
            className="px-3 py-1 rounded bg-white border border-indigo-200 hover:bg-indigo-100"
          >
            Back to dashboard
          </button>
        </div>
      )}

      <Renderer.Root response={source} library={gocartLibrary} toolProvider={toolProvider} onError={setErrors}>
        <Content settled={ready} />
        <Renderer.QueryError>
          <div role="alert" className="mt-6 max-w-2xl text-sm text-red-700 bg-red-50 rounded-lg p-4 flex items-center gap-4">
            <span>Could not load the dashboard data.</span>
            <Renderer.Retry className="px-3 py-1 rounded bg-white border border-red-200 hover:bg-red-100">
              Try again
            </Renderer.Retry>
          </div>
        </Renderer.QueryError>
      </Renderer.Root>

      {ready && layoutErrors.length > 0 && (
        <div role="alert" className="mt-6 max-w-2xl text-sm text-amber-800 bg-amber-50 rounded-lg p-4">
          <p className="font-medium">The page recipe has problems, so parts may be missing:</p>
          <ul className="list-disc pl-5 mt-2">
            {layoutErrors.map((e, i) => (
              <li key={i}>
                {e.statementId ? <code>{e.statementId}</code> : null} {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {SHOW_EDITOR && ready && (
        <RecipeEditor value={source} original={recipe.fileSource} onChange={setSource} />
      )}

      {ready && (
        <AskButton
          onRecipe={(next, question) => {
            setSource(next);
            setAsked(question);
          }}
        />
      )}
    </>
  );
}
