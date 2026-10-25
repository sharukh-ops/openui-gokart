# GoCart on OpenUI

GoCart's admin dashboard rebuilt so the page is drawn from a **recipe** (a few lines of
[OpenUI Lang](https://openui.com/docs/api-reference/react-lang)) instead of hard-coded JSX.
Change the recipe and the page changes with no code change. An **Ask** button lets a user describe a
chart in plain words; an AI writes the recipe, the server checks it, and the page redraws.

[GoCart](https://github.com/GreatStackDev/goCart) is only the test subject. The goal is a method that
works for any React app: pages as data, components as an allow-list, data through server tools.

| | Status |
|---|---|
| Admin dashboard (`/admin`) migrated, same look and numbers as GoCart | Done |
| Ask button (Groq), with server-side recipe checks | Done (first version) |
| Login, database, saving AI pages per user, rate limit | Not yet |
| Stores, Approve Store, Coupons pages | Not migrated (disabled in the sidebar) |

---

## Quick start

```bash
npm install
```

Create `.env` in the project folder (git-ignored) for the Ask button:

```bash
GROQ_API_KEY=gsk_...                 # https://console.groq.com/keys
# GROQ_MODEL=openai/gpt-oss-120b     # optional; this is the default
```

```bash
npm run dev          # http://localhost:3000/admin
npm run verify       # typecheck + lint + all tests
npm run coverage     # tests with a coverage report (coverage/index.html)
npm run build        # production build
npm start            # run the production build
```

Without a key the app works; only the Ask button answers "GROQ_API_KEY is not set".

---

## How it works

### The recipe

`layouts/admin-dashboard.oui` is the whole dashboard:

```
root = Dashboard("Admin", "Dashboard", [stats, chart])
q = Query("get_admin_dashboard", {}, {"products": 0, "revenue": 0, "orders": 0, "stores": 0, "ordersPerDay": []})
stats = StatRow([products, revenue, orders, stores])
products = StatCard("Total Products", q.products, "products")
revenue = StatCard("Total Revenue", q.revenue, "revenue", "currency")
orders = StatCard("Total Orders", q.orders, "orders")
stores = StatCard("Total Stores", q.stores, "stores")
chart = AreaChart("Orders /", "Day", q.ordersPerDay, "date", "orders", "Orders")
```

- Each line is `name = Expression`; `root` is where drawing starts. Order of lines does not matter.
- Component arguments are **positional**, in the order of the component's zod props.
- `Query(tool, args, defaults)` names a server tool. `q.revenue` binds a field of its result.
- A recipe holds **layout only**. Every value on screen comes from a `Query`.

### Flow 1: opening the page

```
Browser                                   Next.js server
───────                                   ──────────────
/admin → <PageRenderer layout="admin-dashboard">
   │ GET /api/layouts/admin-dashboard ──► reads layouts/admin-dashboard.oui
   │ ◄── { source }                        (read per request: edit the file, reload)
   │
   │ OpenUI <Renderer> parses the text, matches names to the component
   │ library already in the browser bundle, validates props (zod).
   │ Spinner stays up until the first data arrives.
   │
   │ POST /api/tool {name, args} ───────► runTool():
   │   (one call per Query)                 1 tool exists?   2 caller's role allowed?
   │                                        3 zod input      4 handler (reads db.json)
   │ ◄── { result }                         5 zod output
   │
   ▼ bindings resolve (q.revenue → 423.4) → React renders the cards and chart
```

Components are never fetched: they are bundled JavaScript. Only **text** (the recipe) and **data**
(tool results) cross the network.

### Flow 2: the Ask button

```
User: "Orders by status as a pie chart"
   │ POST /api/ask {question} ──────────► askForRecipe()
   │                                        a. getContext()            who is asking
   │                                        b. prompt = library.prompt() + tool SCHEMAS (never data)
   │                                        c. Groq writes a recipe    (~1 s, ~1,850 tokens)
   │                                        d. checkRecipe()           see below
   │                                        e. problems? send back to the model once, else 422
   │ ◄── { source }   (checked recipe, text only)
   │
   │ PageRenderer swaps the recipe in → same as Flow 1 from the parse step:
   │ POST /api/tool {name: "get_orders_by_status"} → { result: { rows: [...] } }
   ▼ PieChart draws. "Back to dashboard" restores the file's recipe (no AI call).
```

**`checkRecipe()` treats the AI's answer as untrusted input** (`src/server/ai/checkRecipe.ts`):

1. **Parses** against our library, root is `Dashboard`; limits: 6,000 characters, 40 statements, 4 queries.
2. **Read-only:** no `Mutation()`; only tools the caller's role may use.
3. **No typed-in values:** `StatCard.value` and chart `data` must be a plain Query field (`q.rows`,
   `q.rows[0].orders`). Literals, `@functions`, arithmetic and ternaries are rejected. The parser keeps
   bindings as AST (`Member → RuntimeRef(query)`), which is how this is checked.
4. **Dry run:** each Query runs through `runTool` with the caller's context; every bound field must exist
   and pass the component's zod schema; chart keys must be columns of the rows.

Problems sent back to the model name fields and types only, never values, so **no data leaves the server**.

### Session and data (current state)

| | Today | Later |
|---|---|---|
| **Session** | `getContext()` in `src/server/session.ts` returns `user_1` (admin). No login. Identity never comes from tool args (strict zod input rejects them). | Real login; same function returns the signed-in user |
| **Data** | `src/server/data/db.json` (GoCart's seed), imported read-only | A database behind the same tools |
| **Recipes** | Files in `layouts/`, served by `/api/layouts/[name]` | A database table behind the same URL |
| **AI pages** | Live in browser state only; a reload shows the normal dashboard | Saved per user |

OpenUI itself has no session store; persistence is the app's job.

---

## API

| Route | Method | Body | Returns | Errors |
|---|---|---|---|---|
| `/api/layouts/[name]` | GET | — | `{ name, source }` | 400 bad name (`^[a-z0-9-]+$`), 404 |
| `/api/tool` | POST | `{ name, args? }` | `{ result }` | 400 bad args, 403 role, 404 unknown tool, 500 invalid output |
| `/api/ask` | POST | `{ question }` (3–500 chars) | `{ source }` | 400, 422 invalid recipe (with `problems`), 429 rate limited (`Retry-After`), 502 Groq failed, 503 no key |

## Components (what a recipe may use)

Defined once in `src/openui/specs.ts` (name, description, zod props; no React). The browser adds the
React renderers (`src/openui/components/`); the server builds the same library without React.

| Component | Recipe signature | Notes |
|---|---|---|
| `Dashboard` | `Dashboard(muted, title, sections)` | Page root. Sections: StatRow, AreaChart, BarChart, PieChart |
| `StatRow` | `StatRow(cards)` | Row of StatCards |
| `StatCard` | `StatCard(title, value, icon, format?)` | icon: `products` `revenue` `orders` `stores`; format: `number` `currency` |
| `AreaChart` | `AreaChart(muted, title, data, xKey, yKey, yLabel?)` | GoCart's Orders / Day chart |
| `BarChart` | `BarChart(muted, title, data, xKey, yKey, yLabel?)` | Same props as AreaChart, so they swap |
| `PieChart` | `PieChart(muted, title, data, nameKey, valueKey)` | 2 to 8 slices |

Styling (GoCart's exact Tailwind classes, colours, icons) is fixed in the components; recipes cannot change it.

## Tools (what a recipe may query)

All read-only, role `admin`, input `{}`. Registered in `src/server/tools/index.ts`.

| Tool | Returns |
|---|---|
| `get_admin_dashboard` | `{products, revenue, orders, stores, ordersPerDay: {date, orders}[]}` |
| `get_sales_by_store` | `{rows: {store, status, products, orders, revenue}[]}` |
| `get_orders_by_status` | `{rows: {status, orders, revenue}[]}` |
| `get_orders_by_payment_method` | `{rows: {method, orders, revenue}[]}` |
| `get_products_by_category` | `{rows: {category, products, inStock}[]}` |
| `get_top_products` | `{rows: {product, unitsSold, revenue}[]}` (best seller first, before coupons) |

---

## Project layout

```
layouts/                      page recipes (.oui)
src/
  app/
    admin/                    /admin page + admin layout (Next.js App Router)
    api/layouts/[name]/       GET recipe text
    api/tool/                 POST run a tool
    api/ask/                  POST question → checked recipe
  components/                 plain React: Loading, shell/AdminNavbar, shell/AdminSidebar
  openui/
    specs.ts                  component specs (no React) — single source of truth
    components/               React renderers: Layout (Dashboard, StatRow), StatCard, Charts
    library.ts                browser library (createLibrary)
    PageRenderer.tsx          loads + renders a recipe; spinner, errors, Ask banner
    toolProvider.ts           Query() → POST /api/tool; TOOL_NAMES
    AskButton.tsx             floating Ask button and panel
    RecipeEditor.tsx          dev-only live recipe editor
    format.ts                 number / currency display
  server/
    session.ts                who is calling (user_1 for now)
    data/                     db.json seed + types
    tools/                    registry.ts (defineTool, runTool), adminDashboard.ts, breakdowns.ts
    ai/                       ask.ts (prompt, retry), checkRecipe.ts, groq.ts, library.ts (no React), errors.ts
tests/
  server/                     tools, registry, session, routes, checker, Groq client (fetch mocked)
  openui/                     components, renderer, PageRenderer, Ask flow, recipe swap
  app/                        shell, pages, layouts
docs/
  CONTEXT.md                  why, decisions, status, lessons learned — read this first
  page-components.xlsx        every part of the page: OpenUI vs React vs Next.js
  background/                 earlier research and the GoCart API map
```

## How to extend

**Add a tool**
1. Write a pure `computeX(data)` and a `defineTool({ name, description, roles, input, output, handler })`
   in `src/server/tools/`. Keep input `z.object({}).strict()` unless it truly needs arguments.
2. Register it in `src/server/tools/index.ts` and add its name to `TOOL_NAMES` in
   `src/openui/toolProvider.ts` (a test fails if they differ).
3. Test the numbers against the seed data. The Ask prompt picks the tool up automatically.

**Add a component**
1. Add a spec to `src/openui/specs.ts` with **its own** `z.object(...)` (never share a schema object).
2. Add the React renderer in `src/openui/components/` with `defineComponent({ ...Spec, component })`.
3. Register it in `src/openui/library.ts` **and** `src/server/ai/library.ts`; add it to
   `DashboardSpec.sections` if it is a section. If it shows data, add it to `MUST_BIND` (and
   `ROW_KEYS` for charts) in `checkRecipe.ts`.
4. Components must tolerate data that has not arrived yet (see `rowsOf` in `Charts.tsx`).

**Add a page**
Add tools, write `layouts/<name>.oui`, and create `src/app/<route>/page.tsx` with
`<PageRenderer layout="<name>" />`.

## Rules

- Recipes hold the page's shape, never its data. Values come only from `Query()`.
- Calculations live in `src/server/tools/`, not in components or recipes.
- The caller comes from `session.ts`, never from tool arguments.
- Every tool declares roles and zod input **and** output schemas; output is validated too.
- AI output is untrusted: it is checked on the server before any browser sees it, and the model only
  ever gets schemas, never data.

## Known issues and limits

- **No login, no rate limit on `/api/ask`.** Anyone who can reach the server can spend Groq credits.
- **Groq free plan:** 8,000 tokens a minute for `gpt-oss-120b` (~4 questions a minute). Over the limit
  the user sees "try again in N seconds".
- **AI pages are not saved**, and each question starts fresh (no memory of the previous page).
- **UTC dates** on the Orders / Day chart, kept for parity with GoCart.
- **Small visual differences** from newer libraries (one lucide icon; chart reaches the right edge).
- Recharts logs "width(0) and height(0)" warnings while charts sit hidden behind the spinner. Harmless.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "GROQ_API_KEY is not set" | Add it to `.env` and restart `npm run dev`. An empty `GROQ_API_KEY=` in `.env.local` overrides `.env`. |
| "The AI is busy … try again in N seconds" (429) | Groq's per-minute token limit. Wait, or try `GROQ_MODEL=openai/gpt-oss-20b`. |
| "The AI could not build a valid page" (422) | The model failed the checks twice; the server log lists the problems. Rephrase. |
| `createContext is not a function` at build | Server code imported `@openuidev/react-lang`. Server code must use `@openuidev/lang-core` and `src/server/ai/library.ts`. |
| A component vanished from the library | Two components share one zod schema object. Give each its own. |
| "Another next dev server is already running" | Next 16 allows one dev server per folder; use the running one or stop it. |

## Versions

Next.js 16.4.2 (App Router, `cacheComponents` on) · React 19.3 · OpenUI `@openuidev/react-lang` /
`lang-core` 1.0.1 · zod 4 · recharts 3.10 · Tailwind 4 · lucide-react 1.x · Vitest 5 + Testing Library.

OpenUI APIs were checked against the installed 1.0.1 types and README, not older docs (an earlier POC
used 0.3.0, which differs). Next.js 16 docs ship in `node_modules/next/dist/docs/`.
