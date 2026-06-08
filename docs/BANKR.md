# Bankr Bot Compatibility

Bankr bots ([skills.bankr.bot](https://skills.bankr.bot)) work well with Uniswap because Uniswap splits **lightweight driver skills** from **heavy trading integration**. SectorOne now follows the same pattern.

## Install skills (Skills CLI)

```bash
# Bankr-safe — no SDK, no npm install
npx skills add DoctorTangle/dlmmskills --skill swap-planner
npx skills add DoctorTangle/dlmmskills --skill liquidity-planner

# Full calldata (needs git + npm install in dlmmskills repo)
npx skills add DoctorTangle/dlmmskills --skill dlmm-integration
```

List discoverable skills:

```bash
npx skills add DoctorTangle/dlmmskills --list
```

## Which skill when?

| User goal | Skill | Needs CLI? |
| --- | --- | --- |
| "Swap on SectorOne" (human executes in app) | `swap-planner` | No |
| "Add/remove LP" (plan + app) | `liquidity-planner` | No |
| Base MCP `send_calls`, exact SDK quote | `dlmm-integration` | Yes |
| Cursor / Claude Code all-in-one | `sectorone-dlmm` | Yes |

## Why the old single skill failed on Bankr

1. **`npm install` runs preinstall** — clones SectorOne into `_sectorone-ref/` (needs **git**).
2. **`file:` dependencies** — SDK is not on npm registry; hoisted build needs **tsup** at root.
3. **No HTTP quote API** — unlike Uniswap Trading API; everything goes through the CLI.
4. **One skill, two phases** — Bankr often installs markdown only and never clones the repo.
5. **Missing Bankr frontmatter** — no `allowed-tools`, no trigger phrases, no `metadata.version`.

## Plugin layout (Uniswap-style)

```text
packages/plugins/
  sectorone-driver/     # Bankr-safe planners
    skills/swap-planner/
    skills/liquidity-planner/
  sectorone-trading/      # CLI + Base MCP
    skills/dlmm-integration/
    scripts/check-cli.sh
```

Legacy umbrella: `skills/sectorone-dlmm/` (still valid for Cursor + Base MCP monorepo users).

## Limitations vs Uniswap driver

- SectorOne does **not** publish stable swap deep-link URLs like `app.uniswap.org/swap?...`.
- Driver skill opens **https://linktr.ee/SectorOneDEX** and uses **docs.sectorone.xyz?ask=** + DexScreener for research.
- For parity with Uniswap Trading API, a hosted **SectorOne quote/calldata API** would be the long-term fix.

## Publishing to skills.bankr.bot

After merge to `main`, skills are picked up from GitHub by the Skills CLI / Bankr index (same as Uniswap/uniswap-ai). Ensure frontmatter includes `name`, `description`, `license`, and `metadata.author`.
