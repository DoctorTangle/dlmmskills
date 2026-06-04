---
title: "Base MCP — SectorOne DLMM"
description: "Base MCP onboarding flow and plugin index for building unsigned SectorOne DLMM calldata and submitting it through send_calls on Base mainnet."
---

# Base MCP — SectorOne DLMM

> [!NOTE]
> **Canonical skill:** [skills/sectorone-dlmm/SKILL.md](../sectorone-dlmm/SKILL.md). Install with `npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm`. This `skills/base-mcp/` tree is a legacy layout kept for compatibility; new installs should use `sectorone-dlmm`.

This is the Base MCP entry point for the SectorOne DLMM plugin. Complete the onboarding flow below before calling any SectorOne flow.

> [!WARNING]
> The SectorOne plugin builds unsigned calldata with a local TypeScript CLI, then submits unsigned calls through Base MCP `send_calls`. It requires shell/terminal access (Cursor, Claude Code, Codex). It does not work on chat-only surfaces.

**Chain:** Base mainnet only (`chainId` `8453`, Base MCP chain string `"base"`).

---

## Onboarding flow

1. **Confirm Base MCP is available** in the host. If there is no Base MCP server connected, stop and tell the user.
2. **Confirm shell access.** If the surface cannot run commands, stop — this plugin is CLI-only.
3. **Set the RPC.** Ensure `BASE_RPC_URL` points to a reliable Base RPC before any live read or tx build.
4. **Install once** (from the repo root): `npm install` (clones + builds the SectorOne SDK).
5. **Fetch the wallet lazily.** Only when a write flow needs it, call Base MCP `get_wallets` and pass the address as `--wallet`. Do not ask the user for a private key or seed phrase.
6. **Build calldata** with the CLI using `--json`.
7. **Submit** with `send_calls({ "chain": "base", "calls": [...] })`, preserving call order (approvals first).
8. **Approve.** Show the Base Account approval URL and let the user approve.
9. **Poll** `get_request_status` only after the user acts.

If a CLI command exits non-zero, do not submit partial output — read the error, fix flags/RPC, and rerun.

---

## Safety boundary

- Never ask for or use a private key.
- Never sign locally.
- Never broadcast transactions directly.
- Never use `walletClient.writeContract`.
- Never use `cast send`.
- Always submit through Base MCP `send_calls`; let the user approve in Base Account.
- Base mainnet only. v2.1 is not deployed on Base.

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

If you have legacy unsigned txs (`from`, decimal `value`), normalize first:

```bash
npm run sectorone -- normalize-calls --json --input unsigned.json
```

---

## Plugins

- [plugins/sectorone.md](plugins/sectorone.md) — legacy copy; prefer [../sectorone-dlmm/plugin.md](../sectorone-dlmm/plugin.md)

## References

- [../sectorone-dlmm/references/safety.md](../sectorone-dlmm/references/safety.md)
- [../sectorone-dlmm/references/addresses.md](../sectorone-dlmm/references/addresses.md)
- [../sectorone-dlmm/references/examples.md](../sectorone-dlmm/references/examples.md)
