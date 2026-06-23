# Third-Party Notices

## chopratejas/headroom (Apache License 2.0)

Portions of bjir's tool-output compression engine (`packages/core/src/bjir/compress/`)
are native TypeScript reimplementations of compression *behavior* from the headroom
project (https://github.com/chopratejas/headroom), which is licensed under the
Apache License, Version 2.0. No headroom source code or package is bundled or
depended upon; the algorithms were re-implemented from their documented behavior.

Affected files carry a per-file attribution header. The Apache 2.0 license text is
available at: https://www.apache.org/licenses/LICENSE-2.0

Components adapted: ContentRouter (content-type detection), SmartCrusher (JSON-array
statistical compression), LogCompressor (log-level-aware compression), and CCR
(compress-cache-retrieve, reversible compression).

## Response-style rule text (caveman / ponytail)

BJIR's built-in response-style rules embed compiled copies of rule *text* adapted
from two upstream rulesets:

- **caveman** (terse-response rules): https://github.com/JuliusBrussee/caveman
- **ponytail** (code-minimalism, "Bloat Judgement" rules): https://github.com/DietrichGebert/ponytail

The text is adapted and embedded directly in `packages/core/src/bjir/optimize.ts`;
no upstream package, plugin, hooks, or skills are bundled or depended upon. Refer to
each upstream repository for its license terms.

## Bundled coding skills

The coding skills shipped under `packages/bjir/share/skills/` (seeded into
`~/.config/opencode/skills/` on first run) are from:

- **addyosmani/agent-skills** (MIT) — https://github.com/addyosmani/agent-skills

Each skill retains its original `SKILL.md` content and license.
