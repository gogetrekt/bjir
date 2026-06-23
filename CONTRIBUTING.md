# Contributing to BJIR

Thanks for your interest in BJIR. It's focused on token reduction, so most
contributions fall into one of these buckets:

- Bug fixes
- New or improved token-reduction optimizations (the `packages/core/src/bjir/` layer)
- Better provider / gateway support (`packages/router/`)
- Environment-specific fixes
- Documentation improvements

For anything large or user-facing, **open an issue first** to discuss the approach
before you write code. It saves everyone time.

## Development setup

Requirements: [Bun](https://bun.sh) 1.3+ and Git.

```bash
git clone https://github.com/gogetrekt/bjir
cd bjir
bun install
./bin/bjir.sh            # run the agent (starts the gateway for you)
```

`bun dev` runs the agent directly without the launcher (no gateway auto-start):

```bash
bun dev                  # TUI in packages/opencode
bun dev <directory>      # TUI against another project
bun dev serve --port 4096   # headless API server
bun dev --help           # all commands
```

### Layout

- `packages/opencode`: core agent logic, CLI, server.
- `packages/opencode/src/cli/cmd/tui/` and `packages/tui`: the terminal UI (SolidJS + [opentui](https://github.com/sst/opentui)).
- `packages/core/src/bjir/`: the BJIR optimization layer (caveman, ponytail, I/O refiner, context prune, read dedup, semantic read, the compress engines, savings).
- `packages/router`: the BJIR Gateway (multi-provider proxy + fallback).

### Typecheck

```bash
bun turbo typecheck                          # everything
node_modules/.bin/tsgo --noEmit --project packages/<pkg>/tsconfig.json   # one package
```

> If you change the server API or SDK, run `./script/generate.ts` to regenerate
> the SDK and related files.

### Debugging

Bun debugging is rough. The most reliable approach is to run manually and attach:

```bash
bun run --inspect=ws://localhost:6499/ --cwd packages/opencode ./src/index.ts serve --port 4096
bun attach http://localhost:4096   # or: bun dev attach ...
```

`--inspect-wait` / `--inspect-brk` are useful depending on your workflow. You can
also `export BUN_OPTIONS=--inspect=ws://localhost:6499/` to avoid repeating it.

## Pull requests

- **Keep PRs small and focused.** One concern per PR.
- **Explain the change in your own words:** what it does and why it works. Short
  and concrete beats a long AI-generated wall of text (which may be ignored).
- **Say how you verified it.** What did you test? How can a reviewer reproduce it?
- **Include before/after screenshots or a recording** for any UI change.
- **Don't regress token savings.** If your change touches a session turn, sanity-check
  with a real run and `bjir gain`, and keep `bun turbo typecheck` green.

### PR titles (conventional commits)

```
feat:     new feature
fix:      bug fix
docs:     documentation
chore:    maintenance / deps
refactor: behavior-preserving cleanup
test:     tests
```

Optionally scope it: `fix(router): …`, `feat(tui): …`, `chore(core): …`.

## Style guide

Not strictly enforced, but match the surrounding code:

- **Functions:** keep logic in one function unless splitting adds real reuse.
- **Destructuring:** avoid unnecessary destructuring.
- **Control flow:** avoid `else`; prefer early returns.
- **Errors:** prefer `.catch(...)` over `try`/`catch` where it reads cleanly.
- **Types:** precise types; avoid `any`.
- **Variables:** prefer immutable patterns; avoid `let`.
- **Naming:** concise, descriptive identifiers.
- **Runtime:** use Bun helpers (`Bun.file()`, etc.) where they fit.

## License

By contributing, you agree your contributions are licensed under the project's
[MIT License](./LICENSE).
