# SectorOne Base MCP Skill

Production-quality **SectorOne DLMM** skill and TypeScript CLI for AI agents using [Base MCP](https://github.com/base/skills/tree/master/skills/base-mcp). Reads pools, quotes swaps, and builds **unsigned** calldata for `send_calls` on Base mainnet.

## What This Is

- Base-MCP-compatible plugin docs under `skills/base-mcp/`
- CLI (`npm run sectorone`) backed by `@sectorone/sdk-v2` and `viem`
- Normalization helper for Base MCP `send_calls` format

## What This Is Not

- Not a web app
- Does **not** sign or broadcast transactions
- Does **not** use private keys or local wallets
- Not multi-chain (Base `8453` only)

The user approves transactions in **Base Account** via Base MCP.

## Install

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
# edit BASE_RPC_URL if needed
npm install
```

`preinstall` clones [DoctorTangle/SectorOne](https://github.com/DoctorTangle/SectorOne) into `_sectorone-ref/` (gitignored). `postinstall` builds the SDK packages. Manual: `npm run bootstrap`.

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
| `read-position` | LP amounts per bin via LiquidityHelper |
| `normalize-calls` | Legacy unsigned tx → Base MCP shape |

```bash
npm run sectorone -- --help
npm run sectorone -- quote --help
```

Use `--json` on any command that returns structured data (stdout = JSON only).

## Base MCP Usage

1. Complete Base MCP onboarding (`SKILL.md` in base/skills).
2. `get_wallets` → pass address to `--wallet`.
3. Run e.g. `pnpm sectorone build-swap ... --json`.
4. Submit:

```json
{
  "chain": "base",
  "calls": [ ... ]
}
```

via `send_calls`.

Skill entry points for agents:

- `SKILL.md` (repo root) — auto-discovery for Cursor/Claude/Codex
- `skills/base-mcp/SKILL.md` — Base MCP onboarding flow
- `skills/base-mcp/plugins/sectorone.md` — full command playbook

## Safety

- No private keys, no `writeContract`, no `cast send`
- Default slippage 50 bps; see `skills/base-mcp/references/sectorone-safety.md`
- Default **`--lb-version v2`** (Joe 2.0 / LB v2.0) — most Base liquidity; use `v22` for newer pools; **v2.1** not deployed on Base

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
