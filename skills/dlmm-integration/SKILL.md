---
name: dlmm-integration
description: SectorOne DLMM unsigned calldata on Base for Base MCP send_calls — quote, build-swap, build-add-liquidity, build-remove-liquidity. Requires shell + dlmmskills CLI (npm install clones SDK). NOT for Bankr-only bots — use swap-planner instead.
allowed-tools: Read, Glob, Grep, Bash(*), WebFetch
license: MIT
metadata:
  author: dlmmskills
  version: "0.1.0"
  plugin: sectorone-trading
---

# SectorOne DLMM Integration (CLI)

> **Bankr chat-only bots:** use `swap-planner` / `liquidity-planner` instead.

## Install

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git && cd dlmmskills
npm install   # needs git
export BASE_RPC_URL="https://base-rpc.publicnode.com"
npm run sectorone -- --help
```

Preflight: `bash packages/plugins/sectorone-trading/scripts/check-cli.sh`

## Full playbook

- [../sectorone-dlmm/plugin.md](../sectorone-dlmm/plugin.md)
- [../sectorone-dlmm/references/safety.md](../sectorone-dlmm/references/safety.md)

## Base MCP

`get_wallets` → CLI `--json` → `send_calls({ chain: "base", calls })`

See [docs/BANKR.md](../../docs/BANKR.md) for Uniswap vs SectorOne comparison.
