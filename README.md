# SectorOne Base MCP Skill

Production-quality **SectorOne DLMM** skill and TypeScript CLI for AI agents using [Base MCP](https://github.com/base/skills/tree/master/skills/base-mcp). Reads pools, quotes swaps, and builds **unsigned** calldata for `send_calls` on Base mainnet.

## What This Is

- Agent skill under `skills/sectorone-dlmm/` (install via `npx skills add`)
- Legacy Base-MCP layout also under `skills/base-mcp/`
- CLI (`npm run sectorone`) backed by `@sectorone/sdk-v2` and `viem`
- Normalization helper for Base MCP `send_calls` format

## What This Is Not

- Not a web app
- Does **not** sign or broadcast transactions
- Does **not** use private keys or local wallets
- Not multi-chain (Base `8453` only)

The user approves transactions in **Base Account** via Base MCP.

## Install

### For AI agents (Cursor, Claude Code, Codex)

**Phase 1 — skill instructions** (markdown only):

```bash
npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm -a cursor -y
```

Add other agents with `-a claude-code`, `-a codex`, etc. List available skills: `npx skills add DoctorTangle/dlmmskills --list`.

**Phase 2 — CLI** (required for quotes and calldata):

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
# edit BASE_RPC_URL if needed
npm install
```

**Phase 3 — Base MCP** — connect [Base MCP](https://docs.base.org/ai-agents/quickstart) in your host before write flows.

Run Phase 1 and Phase 2 in the **same project directory** when possible so the agent can execute `npm run sectorone` from the cloned repo.

### CLI only (no Skills CLI)

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
npm install
```

`preinstall` clones [DoctorTangle/SectorOne](https://github.com/DoctorTangle/SectorOne) into `_sectorone-ref/` (gitignored), pinned to the exact commit in `package.json` (`sectoroneSdkCommit`) and verified on every run. `postinstall` builds the SDK packages with `npm install --ignore-scripts` to limit install-time trust. Manual: `npm run bootstrap`.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `BASE_RPC_URL` | Yes (live commands) | Base JSON-RPC URL |

## Commands

| Command | Purpose |
| --- | --- |
| `list-pairs` | Discover LB pairs for a token pair |
| `read-pool` | Active bin + reserves |
| `read-bin-price` | Bin id ↔ price math |
| `quote` | Exact-input swap quote |
| `check-approval` | ERC-20 approval calldata if needed |
| `build-swap` | Approval + swap calls for `send_calls` |
| `build-add-liquidity` | Approvals + add liquidity calls |
| `build-remove-liquidity` | Remove LP from specific bins |
| `read-position` | LP amounts per bin via LiquidityHelper |
| `normalize-calls` | Legacy unsigned tx → Base MCP shape |

```bash
npm run sectorone -- --help
npm run sectorone -- quote --help
```

Use `--json` on any command that returns structured data (stdout = JSON only).

## Base MCP Usage

1. Complete Base MCP onboarding ([skills/sectorone-dlmm/SKILL.md](skills/sectorone-dlmm/SKILL.md)).
2. `get_wallets` → pass address to `--wallet`.
3. Run e.g. `npm run sectorone -- build-swap ... --json`.
4. Submit:

```json
{
  "chain": "base",
  "calls": [ ... ]
}
```

via `send_calls`.

Skill entry points for agents:

- **`skills/sectorone-dlmm/SKILL.md`** — canonical skill (`npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm`)
- `skills/sectorone-dlmm/plugin.md` — full command playbook
- `SKILL.md` (repo root) — pointer to the canonical skill
- `skills/base-mcp/` — legacy layout (deprecated; see note in that folder)

## Safety

- No private keys, no `writeContract`, no `cast send`
- Default slippage 50 bps; very-high (>20%) slippage is blocked unless `--confirm-high-slippage`
- TTL default 1200s, hard max 3600s
- `--native-*` flags require the token to be WETH (`0x4200...0006`)
- `--infinite-approval` needs a second `--confirm-infinite-approval`; exact approval is the default
- `normalize-calls` prints a risk summary (stderr) and rejects non-SectorOne / non-approve calls by default (strict mode); use `--allow-unknown-targets` to opt out
- Default **`--lb-version v2`** (Joe 2.0 / LB v2.0) — most Base liquidity; use `v22` for newer pools; **v2.1** not deployed on Base
- CI fails on **critical** vulnerabilities in the **production** dependency tree (`npm audit --omit=dev --audit-level=critical`); a full `npm audit --audit-level=high` runs non-blocking for visibility. Dev-only advisories (e.g. the `vitest` UI server, never started in CI) are excluded from the blocking gate so it stays meaningful.
- See `skills/sectorone-dlmm/references/safety.md`

## Development

```bash
pnpm typecheck
pnpm test
```

Optional live tests:

```bash
# PowerShell
$env:SECTORONE_INTEGRATION_TESTS="1"
$env:BASE_RPC_URL="https://base-rpc.publicnode.com"
npm test
```

## Troubleshooting

- **`BASE_RPC_URL is required`** — export RPC before live commands.
- **`No SectorOne DLMM route found`** — check pair exists (`list-pairs --lb-version v2`) and RPC quality.
- **SDK build fails on postinstall** — run `npm run bootstrap` (needs `git` for SectorOne clone).

## License

MIT (tooling). SectorOne SDK is subject to its upstream license.
