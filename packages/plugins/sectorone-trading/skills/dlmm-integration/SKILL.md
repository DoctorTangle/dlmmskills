---
name: dlmm-integration
description: Use when the user needs SectorOne DLMM unsigned calldata on Base for Base MCP send_calls — quote, build-swap, build-add-liquidity, build-remove-liquidity, read-pool, read-position. Requires shell access and the dlmmskills CLI (npm install clones vendored SDK). NOT for Bankr chat-only bots; use sectorone-driver swap-planner instead.
allowed-tools: Read, Glob, Grep, Bash(*), WebFetch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-trading
---

# SectorOne DLMM Integration (CLI + Base MCP)

Full calldata builder for SectorOne on **Base mainnet** (`8453`). Mirrors Uniswap's `swap-integration` pattern but uses the **local dlmmskills CLI** instead of a public Trading API.

> [!WARNING]
> **Bankr / sandbox bots:** This skill requires `git clone`, `npm install` (preinstall clones SectorOne SDK), and `npm run sectorone`. If the environment blocks git or lifecycle scripts, use **sectorone-driver** (`swap-planner`, `liquidity-planner`) and execute in the SectorOne app.

## Preflight

```bash
bash packages/plugins/sectorone-trading/scripts/check-cli.sh
# or from repo root after clone:
npm run sectorone -- --help
export BASE_RPC_URL="https://base-rpc.publicnode.com"
```

Set `SECTORONE_CLI_ROOT=/path/to/dlmmskills` if the CLI is not in the current directory.

## Install (once per environment)

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env
npm install    # needs git; clones _sectorone-ref at pinned commit
```

## Base MCP flow

1. Connect Base MCP; `get_wallets` when building txs.
2. `npm run sectorone -- <command> --json` (stdout only = JSON).
3. `send_calls({ chain: "base", calls: [...] })` — approvals first.
4. User approves in Base Account.

## Commands

| Command | Purpose |
| --- | --- |
| `list-pairs` | Discover pools |
| `quote` | Swap quote |
| `build-swap` | Swap + approval calldata |
| `build-add-liquidity` | Add LP calldata |
| `build-remove-liquidity` | Remove LP (`--remove-all`, `--fraction`, or `--amounts`) |
| `read-pool` / `read-position` | Reads |
| `normalize-calls` | Strict by default |

Full playbook: [skills/sectorone-dlmm/plugin.md](../../../../skills/sectorone-dlmm/plugin.md)

## Example — swap

```bash
npm run sectorone -- quote \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 --token-out-decimals 18 \
  --amount-in 100 --json

npm run sectorone -- build-swap \
  --wallet "$WALLET" \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 --token-out-decimals 18 \
  --amount-in 100 --slippage-bps 50 --json
```

## Why Bankr fails today (and the fix)

| Uniswap | SectorOne (before split) | SectorOne (after split) |
| --- | --- | --- |
| Trading API over HTTP | Vendored SDK + preinstall git clone | **Driver:** curl + app link |
| Multiple small skills | One monolithic skill | **Driver + Trading** plugins |
| `allowed-tools` in frontmatter | Missing | Added |
| No npm for swap-planner | npm always required | npm only for `dlmm-integration` |

## Safety

- No private keys; no local signing.
- `--confirm-infinite-approval` for infinite approvals.
- `normalize-calls` strict by default.

See [skills/sectorone-dlmm/references/safety.md](../../../../skills/sectorone-dlmm/references/safety.md).
