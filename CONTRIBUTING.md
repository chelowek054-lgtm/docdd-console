# Contributing to DocDD Console

Thanks for taking the time to help. This repository follows the same rule the tool enforces for
others, so the workflow is a little different from most projects.

## The rule: the document leads the code

```
intent → doc change → human approval → code → verification
```

1. **Find the document** in `docs/` that describes what you want to change.
2. **Propose the doc change first** — in an issue or as a draft pull request that touches only
   `docs/`. Say what will change in the code.
3. **Wait for a maintainer to approve it.** Silence is not approval.
4. **Write the code** — exactly what the approved doc says, nothing more.
5. **Verify** that the doc and the code say the same thing.

Exceptions that don't need a doc change first: typos, formatting, renaming internals, and bug fixes
that restore behaviour the docs already describe. If a bug shows the doc itself was wrong, fix the
doc first.

New features start on the strategic map (`docs/development/maps`, kind `functional`), then a
requirement, a check, a task — then code. See [docs/08-usage.md](docs/08-usage.md),
"Правила реализации".

## Before you open a pull request

```bash
npm install
npm run typecheck
npm run test
npm run lint
```

All three must pass. `tests/self-map.spec.ts` checks that the code still matches this repository's
own code map: if you move code, update the evidence in `docs/development/maps` in the same pull
request.

## Code style

- TypeScript, strict mode. `any` needs a comment explaining why.
- Parsing and validation live in `server/lib/` as pure functions with no Nuxt dependency, so they
  can be tested without a server.
- Components never touch the file system — only the HTTP API described in
  [docs/03-server-api.md](docs/03-server-api.md).
- Comments explain **why**, not what the code does.
- The server must never read or write outside the declared project root. Unknown fields in user
  files are preserved as they were.

## Language

The interface supports English and Russian (`app/i18n/en`, `app/i18n/ru`) — add new strings to
both. Design docs are currently in Russian; English translations of them are a welcome
contribution. Issues and pull requests can be written in English or Russian.

## Licence of contributions

By submitting a contribution you agree that it is licensed under the
[Apache License 2.0](LICENSE), as described in section 5 of the licence.
