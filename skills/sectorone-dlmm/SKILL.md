---
name: sectorone-dlmm
description: Read SectorOne (Liquidity Book / DLMM) pools on Base and build unsigned swap and liquidity calldata for Base MCP send_calls. Use for SectorOne / Joe 2.0 LB on Base — discover pools, deploy new pairs (build-create-pool), quote swaps, add or remove liquidity, inspect LP per bin, or rebalance positions. Base mainnet only (chainId 8453). Requires shell access.
---

# SectorOne DLMM Skill

Build **unsigned** SectorOne DLMM transactions on **Base mainnet** and submit them through Base MCP `send_calls`. The CLI never signs and never broadcasts.

> [!WARNING]
> This skill runs a local TypeScript CLI. It only works in environments with shell/terminal access (Cursor, Claude Code, Codex). It does not work on chat-only surfaces.

> [!IMPORTANT]
> This skill never signs or broadcasts. It only emits `{ chain, calls }` for Base MCP `send_calls`. The user approves in Base Account.

**Chain:** Base mainnet only (`chainId` `8453`, Base MCP chain string `"base"`).

---

## Installation (two phases)

> **Bankr bots:** Install `swap-planner` or `liquidity-planner` instead — no npm/SDK. See [docs/BANKR.md](../../docs/BANKR.md).

### Phase 1 — Agent skill (instructions)

Install from this repository with the [Skills CLI](https://skills.sh):

```bash
npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm -a cursor -y
```

Repeat `-a` for other agents (`claude-code`, `codex`, etc.) as needed. This copies skill markdown into your agent config; it does **not** install the CLI.

### Phase 2 — CLI (required for quotes and calldata)

Clone and build the executable tooling (once per machine or project):

```bash
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills
cp .env.example .env        # set BASE_RPC_URL to a reliable Base RPC
npm install                 # clones + builds the SectorOne SDK (needs git)
npm run sectorone -- --help
```

`npm install` runs `preinstall` (clones SectorOne into `_sectorone-ref/`, pinned commit in `package.json`) and `postinstall` (builds SDK). If it fails: `npm run bootstrap`.

**Best practice:** Run Phase 1 and Phase 2 in the **same project directory** so the agent can run `npm run sectorone` from the cloned repo.

### Phase 3 — Base MCP

Connect [Base MCP](https://docs.base.org/ai-agents/quickstart) (`mcp.base.org`) in your host before any write flow.

---

## When to use

- "Find SectorOne / Joe 2.0 WETH/USDC pools on Base"
- "Quote 100 USDC to WETH on SectorOne"
- "Prepare / build a SectorOne swap"
- "Create a new SectorOne DLMM pool" (`build-create-pool` + `--confirm-create`)
- "Add liquidity to a SectorOne DLMM pool"
- "Remove / close my SectorOne LP" (full or partial — use `build-remove-liquidity`)
- "Show the active bin" / "Show my LP exposure"
- "Rebalance my DLMM position" (typical flow: `read-position` → `build-remove-liquidity` → optional `build-swap` → `build-add-liquidity`; confirm each step with the user before `send_calls`)

For remove flows, read [plugin.md](plugin.md) § Build Remove Liquidity. Run `read-position` first to get bin IDs; require explicit confirmation before `--remove-all`.

---

## Base MCP onboarding (before any write flow)

1. **Confirm Base MCP is available** in the host. If there is no Base MCP server connected, stop and tell the user.
2. **Confirm shell access** and that Phase 2 CLI is installed in a known directory.
3. **Set `BASE_RPC_URL`** to a reliable Base RPC before live reads or tx builds.
4. **Fetch the wallet lazily** — only when building a transaction, call Base MCP `get_wallets` and pass the address as `--wallet`. Never ask for a seed phrase or private key.
5. **Build calldata** with `npm run sectorone -- <command> --json` from the **dlmmskills** repo root.
6. **Submit** with `send_calls({ "chain": "base", "calls": [...] })`, preserving call order (approvals first).
7. **Approve** — show the Base Account approval URL; let the user approve.
8. **Poll** `get_request_status` only after the user acts.

If the CLI exits non-zero, do not submit partial output.

---

## Default protocol version

On Base, most liquidity is in **LB v2.0 (Joe 2.0)** — default `--lb-version v2`. Swap/build commands target the router matching the quoted route (v2 vs v2.2). Use `--lb-version v22` for v2.2-factory pools. **v2.1 is not deployed on Base.**

---

## Documentation (read before invoking flows)

| File | Purpose |
| --- | --- |
| [plugin.md](plugin.md) | Full command playbook, orchestration, examples |
| [references/safety.md](references/safety.md) | Slippage, approvals, normalize-calls, MEV |
| [references/addresses.md](references/addresses.md) | Base contract addresses |
| [references/examples.md](references/examples.md) | Copy-paste CLI examples |

Read **plugin.md** before running a flow. Use `--json` on structured commands (stdout = JSON only; warnings on stderr).

---

## Commands at a glance

| Command | Purpose |
| --- | --- |
| `list-pairs` | Discover LB pairs for a token pair |
| `read-pool` | Active bin + reserves |
| `read-bin-price` | Bin id ↔ price |
| `quote` | Exact-input swap quote |
| `check-approval` | ERC-20 approval calldata if needed |
| `build-swap` | Approval + swap calls for `send_calls` |
| `build-create-pool` | Deploy new LB pair (`--confirm-create`; explicit price flags only) |
| `build-add-liquidity` | Approvals + add-liquidity calls |
| `build-remove-liquidity` | Remove LP from specific bins (`send_calls`) |
| `read-position` | LP amounts per bin |
| `normalize-calls` | Legacy unsigned tx → Base MCP shape (strict by default) |

```bash
npm run sectorone -- <command> --help
```

---

## send_calls shape

```json
{
  "chain": "base",
  "calls": [
    { "to": "0xTarget", "data": "0xCalldata", "value": "0x0" }
  ]
}
```

Legacy unsigned txs (`from`, decimal `value`):

```bash
npm run sectorone -- normalize-calls --json --input unsigned.json
```

Strict mode rejects unknown targets by default; use `--allow-unknown-targets` only for trusted input (not recommended).
