---
name: sectorone-dlmm
description: Read SectorOne (Liquidity Book / DLMM) pools on Base and build unsigned swap and liquidity calldata for Base MCP send_calls. Use when the user wants SectorOne / Joe 2.0 LB on Base. Base mainnet only (chainId 8453). Requires shell access.
---

# SectorOne DLMM

**Canonical skill directory:** [skills/sectorone-dlmm/](skills/sectorone-dlmm/)

## Quick install

```bash
# Phase 1 — agent instructions (Skills CLI)
npx skills add DoctorTangle/dlmmskills --skill sectorone-dlmm -a cursor -y

# Phase 2 — CLI (quotes and calldata)
git clone https://github.com/DoctorTangle/dlmmskills.git
cd dlmmskills && cp .env.example .env && npm install
```

Full onboarding, Base MCP flow, and command reference: **[skills/sectorone-dlmm/SKILL.md](skills/sectorone-dlmm/SKILL.md)**
