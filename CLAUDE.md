# CLAUDE.md

@AGENTS.md

## Start here

1. `docs/CONTEXT.md`: why this repo exists, decisions taken, status, lessons learned, next steps.
2. `README.md`: how it works (flows, API, components, tools), project layout, how to extend.

GoCart's original source (for parity checks) is in `D:\WORK\DELFEE\web_open_ui`.

## Working with this user

- Explain in **simple words**: short sections, tables, plain language. When they ask for technical
  detail (e.g. for their lead), be precise but keep the structure simple.
- **Check before stating.** For OpenUI, Next.js 16, Groq or any library, use the installed package
  (types, README, `node_modules/next/dist/docs/`) or the official docs, and cite them. Mark guesses as guesses.
- **Never `git commit` or `git push`** unless the user asks for that exact action, every time.
- Ask clarifying questions with a recommended default before building anything new.
- Never print or ask for secrets. Check `.env` values by presence/length only.

## Commands

```bash
npm run dev        # http://localhost:3000/admin (Next 16 allows one dev server per folder)
npm run verify     # typecheck + lint + tests; run before saying work is done
npm run coverage   # tests with a coverage report
npm run build      # catches server/client import problems that tests miss
```

## Architecture in one screen

```
layouts/*.oui ──GET /api/layouts/[name]──► PageRenderer → OpenUI <Renderer> + gocartLibrary
                                                │ each Query()
                                                ▼
                                   POST /api/tool → runTool() → tools → db.json (read-only)

AskButton ──POST /api/ask──► askForRecipe(): serverLibrary.prompt() + tool schemas → Groq
                              → checkRecipe() (parse, roles, no Mutation, no typed-in values, dry run)
                              → { source } → PageRenderer swaps it in
```

- `src/openui/specs.ts` is the single source of truth for components (name, description, zod props).
  `src/openui/library.ts` (browser, React) and `src/server/ai/library.ts` (server, lang-core) are both
  built from it; `tests/server/serverLibrary.test.ts` asserts they match.
- Session: `src/server/session.ts` always returns `user_1` (admin). No login, no database yet.

## Rules for this code

- Recipes (`layouts/*.oui`) hold the page's shape, never its data. Values come only from `Query()`.
- Calculations live in code (`src/server/tools/`), not in components or recipes.
- Tool context (who is calling) comes from `src/server/session.ts`, never from tool arguments.
- Every tool declares roles and zod input/output schemas in the registry; inputs are `.strict()`.
- Each OpenUI component needs **its own** zod schema object (a shared one gets renamed and a
  component vanishes; see docs/CONTEXT.md).
- Keep the browser's `TOOL_NAMES` in sync with the server registry (a test checks this).
- **Server code must not import `@openuidev/react-lang`** (it calls React's `createContext` at import
  time and breaks `next build`). Use `@openuidev/lang-core` and `serverLibrary`.
- **AI output is untrusted.** Every AI recipe goes through `checkRecipe()` before a browser sees it.
  The model gets component signatures and tool **schemas only**; feedback to it names fields and
  types, never data values.
- New data-showing components go in `MUST_BIND` (and charts in `ROW_KEYS`) in `checkRecipe.ts`.
- Components must tolerate data that has not arrived yet: when a swapped-in recipe reuses a Query
  name, OpenUI keeps the old result for one render (see `rowsOf` in `Charts.tsx`).
- Keep the Ask prompt small: Groq's free plan is 8,000 tokens/minute for `gpt-oss-120b`.
  `library.prompt()` is called with `toolCalls: false`; `ask.ts` adds its own short Data section.
  A test caps the prompt at 7,000 characters.

## Gotchas

- Next.js 16 has `cacheComponents` on: reading files inside a component counts as uncached data, so
  file reads go in route handlers. Route params are a Promise (`RouteContext<'/path/[param]'>`).
- OpenUI is 1.0.1 here; an earlier POC used 0.3.0 and the APIs differ. Check installed types.
- `library.prompt()` with tool calls on includes generic advice (Mutation, @Count, "mock data") that
  contradicts our rules; that is why tool sections are off.
- `.env.local` overrides `.env`; an empty `GROQ_API_KEY=` there hides the real key.
- Recharts "width(0) and height(0)" warnings come from charts hidden behind the spinner; harmless.
- `localhost.har` files in the repo root contain full request/response data: don't commit them.

## Testing

Vitest 5 with two projects: `*.test.ts` in Node, `*.test.tsx` in jsdom (`vitest.config.mts`).
Groq is never called in tests (`fetch` is stubbed). For a bug seen in the app, write a failing test
that reproduces it first, then fix.
