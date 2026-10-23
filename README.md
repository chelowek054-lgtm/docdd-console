# DocDD Console

**English** · [Русский](README.ru.md)

**Documentation Driven Development, enforced.** A local web console that reads your project's
process records — requirements, tasks, checks, decisions and system maps, all plain markdown in
git — and refuses to start a task until the documents behind it are approved by a human.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%5E20.19%20%7C%7C%20%3E%3D22.12-339933)
![Status](https://img.shields.io/badge/status-early%20but%20used%20daily-orange)

![Strategy screen: project contours with computed health](docs/assets/strategy.png)

## Why

Docs drift from code because the order is wrong: code changes first, the doc is updated
"later". AI coding makes the drift faster. DocDD flips the order and makes it machine-checkable:

```
intent → doc change → human approval → code → verification
```

- A task can't move to **ready** until its requirement is **approved** — not shown, approved.
- AI agents can write code in a task branch, but **can't approve documents** or accept their own
  work. A human merges (fast-forward only, no history rewrites, no push).
- After merge, the code is **verified against system maps**: every edge on a map points to a file
  and a line.

It's close in spirit to spec-driven development (Spec Kit, Kiro), with two additions: a human
approval gate before work starts, and verification of the code against the maps after it ends.

## What's inside

- **Process records as files.** Requirements, tasks, checks, phases, decisions, contracts and
  references live in `docs/development` of *your* repository (contract `docdd.workspace/1`). No
  database: delete the cache and nothing is lost ([ADR-0001](docs/adr/0001-files-are-the-truth.md)).
- **Validation.** Schemas, referential integrity and process rules — "task in progress with an
  unapproved document", "requirement without a single check", "closed task with a failed test".
- **Strategic map.** One per project: the project vision on top, contours below, a capability tree
  of any depth. Health of every contour is computed from progress, deadlines, check quality and
  violations — never set by hand.
- **Working maps.** Codebase, data flows, user paths — or your own maps from templates. Edges carry
  evidence (`file:line` + fragment) and are re-checked against the code.
- **"What do we want?"** One phrase on the strategic map is broken down by a model into a place on
  the map, requirements, checks and tasks — as drafts you approve.
- **Work through the console.** A task gets its own branch and worktree; the model writes code; you
  review the diff and merge.
- **Role agents with limits.** Agents are accounts with roles: no approving, no accepting their own
  work, signed log entries, token budgets per task.
- **CLI check for CI.** `npm run check -- <project>` fails the build on process violations.

| Strategic map | Codebase map |
|---|---|
| ![Strategic map tree](docs/assets/strategic-map.png) | ![Codebase map with layers](docs/assets/codebase.png) |

![Overview: project readiness and progress](docs/assets/overview.png)

> The screenshots show DocDD managing its own development. The project's records are written in
> Russian, so record titles appear in Russian; the interface itself is available in English and
> Russian.

## Quick start

Requires Node.js `^20.19` or `>=22.12`.

```bash
git clone https://github.com/chelowek054-lgtm/docdd-console.git
cd docdd-console
npm install
npm run build
npm run start:built
```

Open `http://127.0.0.1:3000`, add a project folder, and either point it at an existing
`docs/development` or let the console scaffold one. For hacking on the console itself use
`npm run dev` (slower page loads — Vite serves ~240 modules per full reload).

**Model features are optional.** Everything that reads, validates and shows works without a model.
Breaking down intents, describing maps and working on tasks use [Claude Code](https://claude.com/claude-code)
installed on the same machine, or a chat provider (Anthropic or an OpenAI-compatible API)
configured in the console.

The server listens on `127.0.0.1` only and never reads or writes outside the declared project root.
For a shared Ubuntu server there is an install script with nginx and authentication in front —
see [docs/14-deploy.md](docs/14-deploy.md).

## Check a project from the command line

The same validator without a browser, so the build fails on a process violation before anyone
opens a screen:

```bash
npm run check -- /path/to/your/project
npm run check -- /path/to/your/project --json
```

Exit code `1` — errors, `2` — the project could not be read, `0` — clean. Warnings are printed but
don't fail the build. The check writes nothing.

## The repository describes itself

DocDD is developed with DocDD: `docs/development` holds this project's own requirements, tasks,
checks and maps, and `tests/self-map.spec.ts` fails the build if the code drifts from the map.

```bash
npm run check -- .
npm run typecheck && npm run test && npm run lint
```

## Documentation

The design docs are currently written in Russian; English translations are welcome.

| Document | About |
|---|---|
| [docs/00-overview.md](docs/00-overview.md) | Purpose, scope, what it deliberately doesn't do |
| [docs/02-workspace-contract.md](docs/02-workspace-contract.md) | The file format the console reads and writes |
| [docs/07-maps.md](docs/07-maps.md) | Strategic and working maps, evidence, verification |
| [docs/08-usage.md](docs/08-usage.md) | How to use it and the implementation rules |
| [docs/09-execution.md](docs/09-execution.md) | Working on a task: branch, diff, merge |
| [docs/adr/](docs/adr/) | Architecture decisions with rejected alternatives |

## Contributing

Issues and pull requests are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) first: this
repository follows its own rule, so a change in behaviour starts with a change in the docs.
Security issues: see [SECURITY.md](SECURITY.md).

## License

[Apache License 2.0](LICENSE).
