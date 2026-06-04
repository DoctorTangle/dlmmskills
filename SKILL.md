---
name: sectorone-dlmm
description: Read SectorOne (Liquidity Book / DLMM) pools on Base and build unsigned swap and liquidity calldata for Base MCP send_calls. Use when the user wants to discover SectorOne / Joe 2.0 LB pools on Base, quote a swap, prepare a swap or add-liquidity transaction, read an active bin, or inspect LP exposure. Base mainnet only (chainId 8453). Requires shell access.
---

# SectorOne DLMM Skill

Build **unsigned** SectorOne DLMM transactions on **Base mainnet** and submit them through Base MCP `send_calls`. The CLI never signs and never broadcasts.

> [!WARNING]
> This skill runs a local TypeScript CLI. It only works in environments with shell/terminal access (Cursor, Claude Code, Codex). It does not work on chat-only surfaces.

> [!IMPORTANT]
> This skill never signs or broadcasts. It only emits `{ chain, calls }` for Base MCP `send_calls`. The user approves in Base Account.

## When to use

- "Find SectorOne / Joe 2.0 WETH/USDC pools on Base"
- "Quote 100 USDC to WETH on SectorOne"
- "Prepare / build a SectorOne swap"
- "Add liquidity to a SectorOne DLMM pool"
- "Show the active bin" / "Show my LP exposure"

## One-time setup

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env        # set BASE_RPC_URL to a reliable Base RPC
npm install                 # clones + builds the SectorOne SDK
npm run sectorone -- --help
```

`npm install` runs `preinstall` (clones SectorOne into `_sectorone-ref/`) and `postinstall` (builds the SDK). `git` must be available. If it fails: `npm run bootstrap`.

## Base MCP onboarding (do this before any write flow)

1. Ensure Base MCP is connected in the host (Cursor/Claude/Codex).
2. Fetch the wallet address with Base MCP `get_wallets` only when you need to build a transaction. Pass it as `--wallet`.
3. Set `BASE_RPC_URL` in the environment before running live commands.
4. Build calldata with the CLI (`--json`), then call `send_calls({ chain: "base", calls: [...] })`.
5. Show the Base Account approval URL; poll `get_request_status` after the user acts.

Never request a seed phrase or private key. Never sign or broadcast locally.

## Default version

On Base, most liquidity is in **LB v2.0 (Joe 2.0)** — the CLI defaults to `--lb-version v2`. Swap/build commands automatically target the router and ABI matching the quoted route (v2.0 vs v2.2). Use `--lb-version v22` for newer v2.2-factory pools. v2.1 is not deployed on Base.

## How to run

The full command reference, flags, and examples live in the plugin:

- **Plugin:** [skills/base-mcp/plugins/sectorone.md](skills/base-mcp/plugins/sectorone.md)
- **Safety:** [skills/base-mcp/references/sectorone-safety.md](skills/base-mcp/references/sectorone-safety.md)
- **Addresses:** [skills/base-mcp/references/sectorone-addresses.md](skills/base-mcp/references/sectorone-addresses.md)
- **Examples:** [skills/base-mcp/references/sectorone-examples.md](skills/base-mcp/references/sectorone-examples.md)

Read the plugin file before invoking a flow, then run commands with `--json` (stdout is JSON only; warnings go to stderr).

## Commands at a glance

| Command | Purpose |
| --- | --- |
| `list-pairs` | Discover LB pairs for a token pair |
| `read-pool` | Active bin + reserves |
| `read-bin-price` | Bin id ↔ price |
| `quote` | Exact-input swap quote |
| `check-approval` | ERC-20 approval calldata if needed |
| `build-swap` | Approval + swap calls for `send_calls` |
| `build-add-liquidity` | Approvals + add-liquidity calls |
| `read-position` | LP amounts per bin |
| `normalize-calls` | Legacy unsigned tx → Base MCP shape |
