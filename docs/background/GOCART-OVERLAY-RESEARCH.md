# Context handoff: GoCart on OpenUI

Everything decided and learned so far, so a new Claude chat can continue without re-explaining.
Last updated: 12 Oct 2026 (plan revision 2 + two mock pages).

## How to work with me (the user)
- Explain in **simple words**. Short sections, tables, plain language.
- **Check facts before stating them.** For OpenUI, MCP or AI SDK capabilities, cite the official docs
  (openui.com, github.com/thesysdev/openui) or the installed package types. Mark guesses as guesses.
- Never `git commit` or `git push` unless I ask for that exact action.

## 1. The goal
Users want their screens set up their own way. SaaS teams won't rewrite legacy code for each user.
We are designing a way for users to **change pages by asking**: a floating **Ask** button, the user types
"show orders waiting more than 2 days", and a live card appears.

**Current direction:** migrate the **whole app to OpenUI**. Every page becomes an OpenUI Lang layout stored in
a database. Hand-written pages and AI-made cards are the same kind of thing.

**GoCart is only a test subject.** It's an open-source shop app (github.com/GreatStackDev/goCart).
If a full migration works on GoCart, the same method works on other apps.

## 2. Folders
| Path | What |
|---|---|
| `D:\WORK\DELFEE\web_open_ui` | GoCart, branch `claude/clone-gocart-repo-jtezb1` |
| `D:\WORK\DELFEE\web_open_ui\Understanding\gocart-api-usage.xlsx` | Map of components to mock API calls (verified correct) |
| `D:\WORK\DELFEE\MCP_ZOOM_INFO\Open-UI-POC` | Reference: the ZoomInfo generative-UI POC (MCP server + `portal/` + `openui-spike/`) |
| `D:\WORK\DELFEE\MCP_ZOOM_INFO\PRODUCT-UNDERSTANDING.md` | Long explanation of the POC |

| Page | Link |
|---|---|
| Team plan (revision 2) | https://claude.ai/artifact/AhqP3MVsiVyt56un3awtBc |
| Mock: Seller → Orders as an OpenUI app | https://claude.ai/artifact/G9JPmpZ4h8B6w9qAzTEwWr |
| Mock: shopper home page + Ask | https://claude.ai/artifact/LVFiYDhqXTRS184dAdpezH |

All three are private until shared from each page's Share menu.

## 3. GoCart today (analysed)
- Next.js 15.3.5 (App Router), React 19, Redux Toolkit, Tailwind 4. Builds cleanly (19 routes).
- **No backend.** `data/db.json` is seed data; `lib/mockApi.js` has 28 async functions (31 exports incl.
  helpers) and saves every change to browser `localStorage` (`gocart_db`). The signed-in user is `user_1`
  (admin + owner of "Happy Shop").
- Areas: storefront `(public)`, seller `/store`, admin `/admin`. Role checks are client-side only.
- `prisma/schema.prisma` is unused, but it's a useful blueprint for a real database.
- Notable issues:
  - `next` 15.3.5 has **critical** npm audit advisories.
  - Checkout sends hidden cart items (from inactive stores).
  - localStorage quota failures are silent (image data URLs).
  - Out-of-stock products can be added to the cart.
  - `forMember` coupons aren't enforced.
  - Seed coupons expire 2026-12-31.
- The spreadsheet's 30 call sites, 18 components, 28 used functions and 2 unused ones (`resetDatabase`,
  `getCurrentUser`) were verified against the code. Its REST endpoint column is a proposal, not real endpoints.

## 4. How the ZoomInfo POC works (the pattern we copy)
- **Ask path (`/api/ask`, uses AI):** the model gets the question, the component list (`spec.json`) and the
  MCP tools' **schemas only, no data rows** (`SEND_DATA_TO_MODEL=false`). It writes OpenUI Lang, for example
  `q = Query("tool", args, defaults)` then `Table(...)`.
- **Validator (`lib/validate.ts`):**
  - refuses plain-text answers
  - refuses layouts with no `Query()` in blind mode (the data would be made up)
  - strips markdown fences and invisible characters
- **Saved** as a row; the `widget.layout` column holds the text (SQLite `portal/.data/portal.db`).
  The 9 shipped cards are hand-written OpenUI Lang in `lib/widgets/builtin.ts`.
- **Tool path (`/api/tool`, no AI):** the Renderer's `Query()` → `/api/tool` (checks login) → MCP server
  (stdio) → fixture data. Filters and refreshes are cheap: no model call.
- Latest commit adds **edit an existing card**: `api/account-ask` classifies each request as
  new_card / edit_card / note with a cheap model call.
- **`session.ts`** (`src/state/session.ts`) is the **MCP server's own code, not OpenUI**. It's a
  server-side store of view state (filters, sort, selection) saved to `.data/session.json` under one
  shared key `"demo"` (single user). It exists so filters survive reloads.

## 5. OpenUI facts (verified in official docs + installed @openuidev 0.3.0 types)
- The `<Renderer>` draws **new UI where you mount it**. Props: `response`, `library`, `toolProvider`,
  `onAction`, `onStateUpdate`, `initialState`, `onError`, `isStreaming`. It does **not** patch an existing
  app's components.
- **Custom components are supported** (`defineComponent` + `createLibrary`), so an app's own React
  components can be registered.
- `toolProvider` accepts **a plain function map** `{tool: async(args)=>result}` **or an MCP client**.
- Language: `Query()` (read), `Mutation()` (write), `@Run(ref)` (run a mutation / refetch a query; a failed
  mutation stops the remaining steps), `$variables`, `@Set`, `@Reset`, actions `@ToAssistant`, `@OpenUrl`.
- State: an in-memory `Store` per Renderer. **OpenUI has no session store**; saving is up to the app.
- Building blocks: 54 components in `@openuidev/react-ui` (`openuiLibrary`), described by a generated
  `spec.json`. Describing all 54 costs ~10k tokens, so the POC sends a trimmed list
  (`lib/prompt-library.ts`).
- **Unverified:** whether two separate Renderers can share a `$variable` (assumed no).

## 6. The plan (revision 2, edited by the user, replaces revision 1)
Team plan page: https://claude.ai/artifact/AhqP3MVsiVyt56un3awtBc

**The one rule:** the AI proposes a screen; the server decides what is valid, what the user may see and
what runs. The AI never sees data; each card fetches its own data every time it opens.

### Architecture: one app, one tool registry, one database
- Everything runs inside the GoCart Next.js app. **MCP is an optional adapter later** (for outside
  agents), generated from the same registry. It is not in the path of page loads.
- A **tool registry** defines each tool once:
  - fields: `name`, `roles`, zod `input` (`.strict()`) and `output`, `reads` / `invalidates`,
    `timeoutMs`, `maxRows`, `handler(ctx, args)`
  - the same definition feeds `/api/tool` (pages), the AI prompt spec (schemas only) and the future MCP adapter
- `ctx {userId, storeId, role}` comes **only from the session cookie**, never from args. Handlers use only
  store-scoped repository functions.
- Browser: a React shell (nav, header, login, payment, upload) + a Renderer for the role page layout + one
  Renderer per user card + the Ask button + a **query cache keyed by user** + a client **page store**
  (date range).

### Creating a card (`/api/ask`)
1. **Prompt:** question + trimmed component list + the schemas of **only this role's read tools**. No rows.
2. **LLM:** one complete response, not streamed.
3. **Validate:**
   - registered components only
   - each tool exists and its args match the schema
   - every binding path exists in the output schema
   - **no `Mutation`**
   - **no hard-coded values in data components** (Table, Chart, Stat)
   - **one repair attempt**: errors are sent back to the model once
4. **Dry run:** the card's queries run once as this user; the rows are used only to check bindings, never
   sent to the model.
   - rows → save
   - zero rows → save with an empty state
   - binding doesn't resolve → reject or repair
   - query fails → report the error, never treat it as empty
   - timeout or row cap → fail safely and name the limit
   - an optional or nullable field that is null is allowed
5. **Save** a `user_cards` row: stable card id, tool versions, audit (who, when, tokens, latency).

### Using a card (`/api/tool`)
- `Query()` → cache (dedupes) → `/api/tool` → session → role check → schema check → handler → output
  checked and size-capped.
- A write declares `invalidates: ["orders"]`; every query whose tool `reads` orders refetches
  (including the React header's cart badge).
- AI cards are read-only; only hand-written layouts use `Mutation` + `@Run`.

### Storage (no full page copies any more)
| Table | Holds | Key |
|---|---|---|
| `page_layouts` | role default page (OpenUI Lang) + `version` | role + page |
| `user_cards` | the user's own cards: layout, position, size, pinned, hidden, tool versions, `version` | user + page + card_id |
| `user_page_prefs` | which default blocks the user hid or moved | user + page |
| `ui_state` | screen state JSON | user + scope (`page:orders` or `card:<id>`) |
| `sessions` | session id, user, expiry | session id |
| `audit_log` | actor, tool or ask, outcome, latency, tokens; no full payloads | time + user |

Further rules:
- **Reset** deletes `user_page_prefs`; the user's own cards stay.
- **Two tabs:** layout and card saves send their `version`, and a stale save is rejected. Screen state is
  last-write-wins.

### Sessions and state
- **Cookie:** session id only, `HttpOnly`, `Secure`, `SameSite=Lax`; a CSRF check on POSTs.
- **Cache:** keys are `[userId, tool, args]`. Logout or an account switch clears it, and nothing renders
  until the new session has loaded.
- **Card state:** `onStateUpdate` → wait 400ms → `/api/state` (+ `sendBeacon` on tab close) → `initialState`
  on the next visit.
- **Page-wide state** (date range): a client store saved to `/api/state`. Cards pass it into their query
  args, so a change refetches every card. **It is not a tool any more.**
- **Other tabs:** `BroadcastChannel` in production.

### Demo vs production
- **Day one (demo):**
  - session `ctx` and store-scoped repositories
  - the registry with zod schemas
  - registered components and server-side validation
  - read-only AI cards
  - timeouts and row limits
  - the dry run
  - a user-keyed cache
  - "needs rebuild" fallback
  - one repair attempt
  - token and latency logging
- **Deferred:** Postgres, the MCP adapter, cross-tab refresh, optimistic updates, migration tooling,
  advanced rate limits, the full audit dashboard, registering GoCart's own components.
- **Before real customer data:**
  - Postgres with row-level security per store
  - rate limits on `/api/ask` and `/api/tool`
  - a full audit log with retention rules
  - schema versioning with a rebuild workflow
  - CI that re-checks saved layouts when tools change
  - agreed LLM provider terms and a budget
  - a security review

### Build plan (25 phases; one vertical slice first)
**Milestone lifecycle:** ask → validate → run queries safely → save → change the date range → refresh →
write → dependent cards refresh.

0. **Agree:** (1) the plan and decisions, (2) the mock of Seller → Orders with the Ask button.
1. **Vertical slice:**
   - (3) upgrade Next.js and agree one version with the POC
   - (4) mock data into SQLite behind store-scoped repositories
   - (5) login, sessions, cookie, CSRF, `ctx`
   - (6) the registry + `/api/tool` with `get_store_orders`, plus a cross-store test
   - (7) Renderer + `toolProvider` + user-keyed cache; Seller Orders loaded from `page_layouts`
   - (8) date range store saved to `/api/state` ← **slice works**
2. **AI card:**
   - (9) Ask UI
   - (10) `/api/ask` prompt
   - (11) parse, validate, repair
   - (12) dry run
   - (13) save to `user_cards` with empty, error and needs-rebuild states ← **AI card works**
3. **Interactive:**
   - (14) `update_order_status` write with `invalidates` ← **full lifecycle**
   - (15) card state
   - (16) edit a card by asking (keeps its id and state)
   - (17) drag, resize, pin, hide, reset, version check
4. **Hardening:**
   - (18) tenant and account-switch tests
   - (19) failure tests (invalid layout, tool error, timeout, row cap, a tool schema change)
   - (20) a 20-question eval including made-up-number traps
   - (21) browser tests
5. **Widen:**
   - (22) the remaining read tools + the toggle-stock write
   - (23) seller dashboard and products pages
   - (24) admin pages
   - (25) optional MCP adapter from the registry

### Decisions for the call (9)
1. Data path: browser → `/api/tool` → registry inside the app; MCP as an optional adapter.
2. Demo first with the day-one list; no real customer data until the production list is done.
3. Seller → Orders as the slice, then seller and admin pages; shopper pages later.
4. React for routing, header, login, payment and upload; page bodies in OpenUI.
5. AI cannot write layouts that change data (validator-enforced); future AI writes need their own
   permission and confirmation flow.
6. Users add cards and hide or move blocks for themselves; an admin changes the role default for everyone.
7. OpenUI's built-in components with GoCart's colours to start.
8. Model: Gemini or Claude? Needs a key and a budget.
9. SQLite for the demo; Postgres with RLS for production.

### Options not picked (revision 2)
- **Overlay without migration:** keep it for apps we can't migrate.
- **Browser extension.**
- **A widget builder without AI, or a separate low-code tool.**
- **AI writes raw HTML/React.**
- **Send data to the AI:** debug switch only.
- **Generate or stream the page on every visit.**
- **A separate MCP server in every page load:** the AI only reads schemas, so it would add a hop and a
  second auth layer. Keep it later as an adapter.
- **Browser calls functions directly:** prototype only.
- **A full page copy per user:** replaced, because copies go stale.
- **Page-wide state as a server tool:** replaced, because other cards wouldn't know to refetch.
- **In-memory-only state, or everything in localStorage.**

### Risks
- Cross-store data leaks.
- The previous user's data showing on a shared browser.
- Unknown AI reliability (measure it in phase 20).
- Made-up numbers in cards.
- Tool changes breaking saved cards (tool versions + "needs rebuild" + CI).
- Cost per question (~10k tokens for the full component list, still to be measured).
- Renderers sharing a `$variable` is unverified; the client store doesn't depend on it.
- Next.js 15.3.5 vs 16.

### Open engineering questions found while reviewing revision 2 (not yet verified)
- **How does an outside change reach a Renderer that's already mounted?** In the installed 0.3.0 types,
  the Renderer props have no "refetch" or "set variable" input, and `initialState` is described as
  hydration on load. Options:
  - re-mount the Renderer with a `key` that includes the date range and the invalidation counter
  - have the cached `toolProvider` push fresh results
  - check lang-core's `QueryManager.invalidate` / `Store`

  Prove this in phase 8 before building on it.
- **Validator checks need our own code:**
  - "binding paths exist in the output schema" and "no hard-coded values in data components" mean walking
    the parsed AST (`walkAST` / `parse` are exported by lang-core 0.3.0) against JSON Schema
  - the POC only checked `Query()` count > 0
- **`user_page_prefs` needs stable block ids** in role layouts, and prefs that point at removed blocks must
  be ignored when an admin edits the default.

## 7. Mock pages (phase 2, built)
Both are single HTML pages with **scripted AI answers**, no backend and no real model. Cards and state are
saved in the viewer's browser (localStorage), standing in for the database tables.

### Mock A: Seller → Orders as an OpenUI app (follows plan revision 2)
- GoCart's seller look: "gocart. Store" bar, sidebar, Outfit font, green accent.
- **Not an exact copy of the current page:**
  - 34 made-up orders instead of the 7 in `db.json`
  - columns are Order / Customer / Placed / Total / Payment / Status, while the real page has Sr. No.,
    Customer, Total, Payment, Coupon, Status, Date
  - no order-details pop-up
  - a user switcher instead of "Hi, Seller"
- **Shows:**
  - the date range as page-wide state
  - Summary and Orders role blocks (`page_layouts` v3); the status dropdown is a Mutation that invalidates
    "orders" and refreshes dependent cards
  - Ask with the 6 steps: prompt → model → validate → repair → dry run → save
  - refused requests: "Predict next month's sales" (made-up data), "Cancel all unpaid orders" (Mutation)
  - "Who are my top customers?" shows a repair
  - edit a card in place ("Make it a bar chart"), which keeps the ID and bumps the version
  - pin, resize, sort (card state), delete with undo
  - hide or move role blocks (`user_page_prefs`) and reset
  - switching user clears the cache
  - a "How it works" drawer with every call and the stored rows
- **Possible follow-up:** match the real page exactly (the 7 real orders, the same columns, the details
  pop-up, "Hi, Seller").

### Mock B: shopper home page, an exact copy + Ask
- Rebuilt from GoCart's **own component markup and Tailwind classes**: Banner, Navbar, Hero,
  CategoriesMarquee, LatestProducts, BestSelling, OurSpec, Newsletter, Footer.
  - Tailwind browser build pinned to the app's version, `@tailwindcss/browser@4.1.12` (jsdelivr), plus Lucide
    `0.525.0` (unpkg) and the Outfit font.
  - The real images from `assets/` and `public/images/` are published alongside the page.
  - The real 12 products from `db.json`, with ratings averaged from the 42 reviews.
- **The only addition:** a dark **Ask** button. Its cards appear **between the hero and Latest Products**,
  drawn with GoCart's own `ProductCard` (shown as a registered component, `ProductGrid`).
  - Tools: `search_products` (category, maxPrice, sort by discount or rating) and `compare_products`.
  - Works: "Show only watches", "Biggest discounts", "Top rated audio", "Compare smart watch white and black"
    (a comparison table).
  - "Items under $20" gives an empty state, because every product costs $29.
  - Refused: "Add all watches to my cart" (Mutation), "Say everything is 50% off today" (made-up offer).
  - Each card has Layout (shows its OpenUI Lang) and Remove.
- **Known:**
  - Links and search go nowhere.
  - "Smart watch black" shows a speaker picture. The real app does the same, because `db.json` points
    prod_5 at `product_img5.png`.
- **Reported issue, "no cards, it just scrolls":**
  - Tested in headless Chrome with "Show only watches": the card **was** created under the hero and the
    panel said "Card added below the hero".
  - Likely causes: the HTML file was opened directly from disk instead of through the artifact link, or the
    card sat under the Ask panel or just above the viewport.
  - Not yet confirmed with the user; ask for a screenshot of the Ask panel's step list if it happens again.
- The user said "it's just an HTML": **don't over-engineer mock testing**; keep checks light.

## 8. Next step
- Confirm the home mock works for the user through the artifact link.
- Optionally bring the Seller → Orders mock to the same accuracy as the home mock.
- Then present the plan and the mocks to the team and settle the 9 decisions (section 6).
- After that, phase 3 onward: upgrade Next.js, move data to SQLite, add login and sessions, the tool registry.
