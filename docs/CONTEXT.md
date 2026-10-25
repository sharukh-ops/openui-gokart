# Project context: GoCart on OpenUI

Everything a new person (or a new Claude session) needs to continue this repo.
Last updated: 18 Oct 2026, phase one done; Ask button added (first part of phase two).

## 1. Why this exists

Users of SaaS apps want their screens arranged their own way, but no team rewrites legacy code for
every request. The idea: describe each page as a **recipe** in OpenUI Lang (text) instead of fixed
React code. Then a page can change without a code change, and later an AI can write new cards for a
user by asking.

**GoCart** (open-source shop, `D:\WORK\DELFEE\web_open_ui`, from github.com/GreatStackDev/goCart) is
only the **test subject**. If the method works on GoCart, it can be applied to other apps.

## 2. Current plan (decided 17 Oct 2026)

- Migrate **one page first**: GoCart's **admin dashboard** (`/admin`): 4 number cards + the
  Orders / Day chart.
- Build it in **this separate repo**, not inside GoCart.
- The page becomes OpenUI cards drawn from a recipe, using **our own basic React components**.
- **Phase one = migration only.** No AI, no Ask button yet.

### Decisions taken for phase one (with the user)
| # | Decision |
|---|---|
| 1 | Page: `/admin` (4 cards + Orders/Day chart) |
| 2 | No AI in phase one |
| 3 | Only the admin shell (top bar, sidebar) plus this page; not the whole shop |
| 4 | Data served from the server through one tool, ready for the AI later |
| 5 | Newest Next.js + TypeScript |
| 6 | The recipe lives in a file for now (`layouts/`); a database in phase two |
| 7 | A dev-only live recipe editor to show the page is recipe-driven |
| 8 | Keep GoCart's UTC-date chart quirk for an exact match; fix later |
| 9 | No login yet; always GoCart's `user_1` (admin) |
| 10 | Git initialised; **no commits unless the user asks** |

## 3. Phase one status: done

- `/admin` looks and counts like GoCart's original (checked side by side with screenshots):
  12 products, $423.40, 7 orders, 2 stores, 6 days on the chart.
- Small differences from newer libraries: the Total Orders icon (lucide-react 1.x) and the chart now
  reaches the right edge (recharts 3.10).
- Typecheck, lint, production build, `npm audit` (0 vulnerabilities) and **91 tests** pass.
  Coverage: 100% lines and functions, 96% branches.
- See `README.md` for how the code is organised and how to run it.

### Bug found and fixed during phase one
`AreaChart` and `BarChart` shared one zod schema object. OpenUI's `defineComponent` tags the schema
with the component's name, so the second definition renamed the shared schema and `AreaChart`
vanished from the library. Fix: each component gets its own schema instance (`chartProps()`), with a
regression test in `tests/openui/recipe.test.ts`.

## 3b. Ask button: done in a first version (18 Oct 2026)

Decisions taken with the user:
| # | Decision |
|---|---|
| 1 | AI provider: **Groq** (OpenAI-compatible API, plain `fetch`, no SDK). Default model `openai/gpt-oss-120b`, change with `GROQ_MODEL`. Key in `.env.local` as `GROQ_API_KEY`. |
| 2 | The answer **replaces the dashboard**; "Back to dashboard" restores it. Not saved yet (no database, no login). |
| 3 | New read-only tools so there is more to ask about: `get_sales_by_store`, `get_orders_by_status`, `get_orders_by_payment_method`, `get_products_by_category`, `get_top_products`. All return `{ rows: [...] }`. |
| 4 | New component `PieChart`. |

How it follows the plan in section 6, step 3: the model gets `library.prompt()` and tool schemas only;
the server checks the recipe (parses, known tools for the role, no Mutation, no typed-in values, size
limits), does a dry run through `runTool`, and sends problems back to the model once. **Not done yet:**
saving per user (needs login and a database).

Facts learned:
- A route handler **cannot import `@openuidev/react-lang`**: it calls React's `createContext` at import
  time, which fails in the server build ("createContext is not a function" at `next build`). So the
  component specs (name, description, props) live in `src/openui/specs.ts` with no React, and the server
  builds its library from them with `@openuidev/lang-core` (`src/server/ai/library.ts`). A test checks
  both libraries give the same JSON schema and prompt.
- In `lang-core`, `defineComponent` returns `{ ...config, ref: config.props }`: a ref is the props schema.
- Parsed props keep bindings as AST: `q.x` is `{k: "Member", obj: {k: "RuntimeRef", refType: "query"}}`,
  a typed-in value is a plain literal. That is how "no typed-in values" is checked.
- **Groq free plan: 8,000 tokens a minute** for `openai/gpt-oss-120b`. With OpenUI's tool sections the
  prompt was about 11,000 characters and a question cost about 4,300 tokens (one or two a minute, HTTP
  429). So `library.prompt()` is now called with `toolCalls: false` (that also drops its advice to use
  `Mutation`, `@Count` and "mock data"), and `ask.ts` adds a short "Data" section for our tools. gpt-oss
  gets `reasoning_effort: "low"` and `include_reasoning: false`. A question now costs about 1,850 tokens.
  A 429 becomes a clear "try again in N seconds" message (HTTP 429 with Retry-After). A test caps the
  prompt at 7,000 characters.
- Seen in a live run: for "top products" the model made one StatCard per row (`q.rows[11]` ...). The
  checker rejected it; a rule now says to bind one chart to `q.rows` for lists.

## 4. OpenUI facts (checked against the installed 1.0.1 package, not memory)

The ZoomInfo POC used OpenUI **0.3.0**; this repo uses **1.0.1**. Check the installed types and README
(`node_modules/@openuidev/react-lang`) before using any API. The online docs pages don't cover the API
details. Reference: https://openui.com/docs/api-reference/react-lang

- `defineComponent({ name, description, props: z.object(...), component: ({ props, renderNode }) => ... })`
  with zod 4 (`import { z } from "zod/v4"`). Children are typed as `z.array(Child.ref)`.
- `createLibrary({ id, root, components })`; `library.toJSONSchema()` feeds `createParser(schema, root)`.
- `<Renderer response library toolProvider onError ...>`, or `Renderer.Root` with slots
  `Renderer.Content`, `Renderer.QueryLoading`, `Renderer.QueryError`, `Renderer.Retry`, and
  `useRendererQuery()`.
- `toolProvider` is either a function map `{ tool: async (args) => result }` (result used as-is) or an
  MCP client (unwrapped with `extractToolResult`).
- Query syntax: `q = Query("tool", {args}, {defaults}, refreshInterval?)`.
- OpenUI has **no session store**. Saving state is up to the app (`onStateUpdate` / `initialState`).
- Parse error codes include `unknown-component`, `missing-required`, `type-mismatch`, `excess-args`.

## 5. Next.js 16 notes

- `AGENTS.md` (written by Next) says to read `node_modules/next/dist/docs/` before coding; versions differ
  from training data.
- `cacheComponents` is on. An `await readFile()` inside a component counts as uncached data, so the
  recipe is read in a **GET route handler** (`/api/layouts/[name]`), which runs per request.
- Route handlers type params with the global `RouteContext<'/path/[param]'>`; params are a Promise.

## 6. Next steps (phase two, not started)

1. Move recipes from `layouts/` to a database table (keep the `/api/layouts/[name]` URL).
2. Real login and sessions; the tool context comes from the session.
3. The Ask button: **first version done** (see 3b). Still to do: save the answer per user, add a
   rate limit, and let the user add a card to the dashboard instead of only replacing it.
4. Fix the UTC-date chart quirk.
5. Migrate the other admin pages (Stores, Approve Store, Coupons).

## 7. Background documents (`docs/background/`)

| File | What it is |
|---|---|
| `GOCART-OVERLAY-RESEARCH.md` | Earlier research and the broader whole-app plan (revision 2): GoCart analysis, the ZoomInfo POC pattern, tool registry, per-user state, 25-phase plan, options rejected. Written before the single-page plan. |
| `GoCart-OpenUI-Plan-rev2.html` | The team plan page (revision 2) as HTML. |
| `gocart-api-usage.xlsx` | Map of GoCart components to their mock API calls. |

Related places outside this repo:
- GoCart source: `D:\WORK\DELFEE\web_open_ui`
- ZoomInfo POC (the pattern this follows): `D:\WORK\DELFEE\MCP_ZOOM_INFO\Open-UI-POC`
- Mocks (artifacts): seller orders https://claude.ai/artifact/G9JPmpZ4h8B6w9qAzTEwWr ·
  shopper home https://claude.ai/artifact/LVFiYDhqXTRS184dAdpezH
