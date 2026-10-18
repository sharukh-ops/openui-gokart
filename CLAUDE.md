# CLAUDE.md

@AGENTS.md

## Start here

Read `docs/CONTEXT.md` first: why this repo exists, the decisions taken, current status and next steps.
`README.md` explains the code structure.

## Working with this user

- Explain in **simple words**: short sections, tables, plain language.
- **Check before stating.** For OpenUI, Next.js 16 or any library, use the installed package (types,
  README, `node_modules/next/dist/docs/`) or the official docs, and cite them. Mark guesses as guesses.
- **Never `git commit` or `git push`** unless the user asks for that exact action.
- Ask clarifying questions with a recommended default before building anything new.

## Rules for this code

- Recipes (`layouts/*.oui`) hold the page's shape, never its data. Values come only from `Query()`.
- Calculations live in code (`src/server/tools/`), not in components or recipes.
- Tool context (who is calling) comes from `src/server/session.ts`, never from tool arguments.
- Every tool declares roles and zod input/output schemas in the registry.
- Each OpenUI component needs **its own** zod schema object (a shared one gets renamed; see docs/CONTEXT.md).
- Keep the browser's `TOOL_NAMES` in sync with the server registry (a test checks this).

## Commands

```bash
npm run dev        # http://localhost:3000/admin
npm run verify     # typecheck + lint + tests
npm run coverage   # tests with a coverage report
npm run build
```
