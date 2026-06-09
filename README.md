# SectorOne DLMM CLI

TypeScript CLI for [SectorOne DLMM](https://sectorone.xyz) on **Base mainnet** — reads pools, quotes swaps, and builds **unsigned** calldata for [Base MCP](https://github.com/base/skills/tree/master/skills/base-mcp) `send_calls`.

**Agent skills** (Bankr planners, onboarding, plugin layout) live in a separate repository: [DoctorTangle/Sectoroneskills](https://github.com/DoctorTangle/Sectoroneskills).

## What This Is

- CLI (`npm run sectorone`) backed by `@sectorone/sdk-v2` and `viem`
- Normalization helper for Base MCP `send_calls` format
- Vendored SectorOne SDK (pinned commit, verified on install)

## What This Is Not

- Not a web app
- Default flow does **not** sign or broadcast (Base MCP approves in Base Account)
- Not multi-chain (Base `8453` only)

Optional **local signed execution** (`PRIVATE_KEY`, `npm run position:*`) is documented in `.env.example` — not for MCP/Bankr agent flows.

The user approves transactions in **Base Account** via Base MCP (default path).

## Liquidity / rebalance commands

| Command | Purpose |
| --- | --- |
| `discover-lp-bins` | Find wallet LP bins |
| `check-lp-approval` | ERC-1155 router approval on pair |
| `build-rebalance-liquidity` | Batched remove + add |
| `build-remove-liquidity --batch-size 10` | Split large removes |
| `build-add-liquidity --bin-count N` | SPOT/CURVE/BID_ASK width |

See [docs/agent-friction-report.md](docs/agent-friction-report.md) and Sectoroneskills `rebalance-playbook.md`.

## Install

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
# edit BASE_RPC_URL if needed
npm install
```

`preinstall` clones [DoctorTangle/SectorOne](https://github.com/DoctorTangle/SectorOne) into `_sectorone-ref/` (gitignored), pinned to the exact commit in `package.json` (`sectoroneSdkCommit`) and verified on every run. `postinstall` builds the SDK packages with `npm install --ignore-scripts` to limit install-time trust. Manual: `npm run bootstrap`.

### Agent skills

Install markdown skills from [Sectoroneskills](https://github.com/DoctorTangle/Sectoroneskills):

```bash
npx skills add DoctorTangle/Sectoroneskills --list
npx skills add DoctorTangle/Sectoroneskills --skill sectorone-dlmm -a cursor -y
```

Bankr-safe (no SDK): `swap-planner`, `liquidity-planner`. Full calldata: `dlmm-integration`. See [Sectoroneskills/docs/BANKR.md](https://github.com/DoctorTangle/Sectoroneskills/blob/main/docs/BANKR.md).

Clone **this** repo for Phase 2 CLI (quotes + calldata) in the same project directory when possible.

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
| `build-create-pool` | Deploy new LB pair (`createLBPair` on router) |
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

1. Install skills from [Sectoroneskills](https://github.com/DoctorTangle/Sectoroneskills) and complete Base MCP onboarding.
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

## Safety

- No private keys, no `writeContract`, no `cast send`
- Default slippage 50 bps; very-high (>20%) slippage is blocked unless `--confirm-high-slippage`
- TTL default 1200s, hard max 3600s
- `--native-*` flags require the token to be WETH (`0x4200...0006`)
- `--infinite-approval` needs a second `--confirm-infinite-approval`; exact approval is the default
- `normalize-calls` prints a risk summary (stderr) and rejects non-SectorOne / non-approve calls by default (strict mode); use `--allow-unknown-targets` to opt out
- Default **`--lb-version v2`** (Joe 2.0 / LB v2.0) — most Base liquidity; use `v22` for newer pools; **v2.1** not deployed on Base
- CI fails on **critical** vulnerabilities in the **production** dependency tree (`npm audit --omit=dev --audit-level=critical`); a full `npm audit --audit-level=high` runs non-blocking for visibility.
- Safety reference: [Sectoroneskills/skills/sectorone-dlmm/references/safety.md](https://github.com/DoctorTangle/Sectoroneskills/blob/main/skills/sectorone-dlmm/references/safety.md)

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
