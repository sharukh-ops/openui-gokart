# GoCart on OpenUI

GoCart's admin dashboard (`/admin`), rebuilt so the page is drawn from a **recipe**: a short
OpenUI Lang file. Change the recipe and the page changes, with no code change.

Phase one migrates only this page. It looks and counts the same as GoCart's original
(`web_open_ui/app/admin/page.jsx`): 12 products, $423.40 revenue, 7 orders, 2 stores, and the
Orders / Day chart.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000/admin
npm run verify       # typecheck + lint + tests
npm run coverage     # tests with a coverage report (coverage/index.html)
npm run build        # production build
```

In dev mode, a **Page recipe** panel under the dashboard lets you edit the recipe and see the
page change live. It doesn't touch the file and isn't shown in production.

## How a page is drawn

```
layouts/admin-dashboard.oui          the recipe (OpenUI Lang text)
        │  GET /api/layouts/admin-dashboard
        ▼
<PageRenderer>  →  OpenUI <Renderer> + gocartLibrary
        │  each Query("get_admin_dashboard", …)
        ▼
POST /api/tool  →  runTool(): session → role check → input schema → handler → output schema
        ▼
src/server/data/db.json  (GoCart's seed data, read-only)
```

## Folders

| Path | What it holds |
|---|---|
| `layouts/` | Page recipes, one `.oui` file per page. Phase two moves them to a database. |
| `src/openui/components/` | Our basic React building blocks, each registered with `defineComponent`: `Dashboard`, `StatRow`, `StatCard`, `AreaChart`, `BarChart`. They use GoCart's exact Tailwind classes. |
| `src/openui/library.ts` | `createLibrary`: the full list of blocks a recipe may use. |
| `src/openui/PageRenderer.tsx` | Loads a recipe, renders it, shows GoCart's spinner until data arrives, and shows a retry box if data fails or a warning if the recipe is broken. |
| `src/openui/toolProvider.ts` | Browser side of `Query()`: calls `/api/tool`. |
| `src/openui/RecipeEditor.tsx` | The dev-only live editor. |
| `src/server/tools/` | Tool registry (`registry.ts`) and tools (`adminDashboard.ts`). Each tool declares roles and zod input/output schemas. |
| `src/server/session.ts` | Who is calling. Phase one has no login: always GoCart's `user_1` (admin). |
| `src/components/shell/` | The admin top bar and sidebar, plain React, copied from GoCart. |
| `tests/server/` | Node tests: number parity with GoCart, the tool registry, the session, seed data, and both API routes. |
| `tests/openui/` | Formatting, the tool caller, each building block, the real recipe drawn by OpenUI's Renderer, the page drawer (loading, errors, retry, broken recipe, editor) and the editor. React tests run in jsdom. |
| `tests/app/` | The shell (top bar, sidebar, spinner), the pages and the layouts. |
| `docs/` | `CONTEXT.md` (why, decisions, status, next steps) and earlier research in `docs/background/`. |

## Rules the code follows

- **Recipes hold the page's shape, never its data.** Values come only from `Query()` bindings.
- **Calculations live in code** (`computeAdminDashboard`), not in components or recipes.
- **The caller comes from the server session**, never from tool arguments. Unknown arguments are rejected.
- **Tool output is checked against its schema**, so a handler bug is an error, not a wrong number.

## Known issues kept on purpose

- **UTC dates on the chart.** Orders are grouped by UTC date, as in GoCart, so an order placed late in
  the evening in India counts on the previous day. Kept for parity; fix later.
- **Small visual differences from newer libraries.** The Total Orders icon (lucide-react 1.x) is drawn
  slightly differently, and the chart now reaches the right edge (recharts 3.10).
- **Sidebar links.** Stores, Approve Store and Coupons are shown but disabled; they are not migrated yet.

## Versions

Next.js 16.4.2 · React 19.3 · OpenUI `@openuidev/react-lang` / `lang-core` 1.0.1 · zod 4 · recharts 3.10 ·
Tailwind 4 · vitest 5.

OpenUI API used here was checked against the installed 1.0.1 types and README:
https://openui.com/docs/api-reference/react-lang
