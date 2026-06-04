# SectorOne CLI Examples

Set RPC and install from the **dlmmskills** repository root:

```bash
export BASE_RPC_URL=https://base-rpc.publicnode.com
npm install
```

Wallet placeholder: replace with Base MCP `get_wallets` result.

## User Prompts → Commands

### Find WETH/USDC pools

> Find SectorOne WETH/USDC DLMM pools on Base.

```bash
npm run sectorone -- list-pairs \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --lb-version v2 \
  --json
```

### Quote 100 USDC → WETH

> Quote 100 USDC to WETH on SectorOne.

```bash
npm run sectorone -- quote \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --amount-in 100 \
  --slippage-bps 50 \
  --json
```

### Prepare swap (Base MCP)

> Prepare a SectorOne swap of 100 USDC to WETH with 0.5% slippage.

```bash
npm run sectorone -- build-swap \
  --wallet 0xYourBaseMcpWallet \
  --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-out 0x4200000000000000000000000000000000000006 \
  --token-in-decimals 6 \
  --token-out-decimals 18 \
  --amount-in 100 \
  --slippage-bps 50 \
  --ttl 1200 \
  --json
```

Submit `chain` + `calls` via Base MCP `send_calls`.

### Active bin (25 bps pool)

> Show the active bin for the WETH/USDC 25 bps/binStep pool.

```bash
npm run sectorone -- read-pool \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --bin-step 25 \
  --lb-version v2 \
  --json
```

### Create a new LB pair

> Deploy a new USDC/WETH 25 bps pool (only if `list-pairs` shows it does not exist yet).

```bash
npm run sectorone -- build-create-pool \
  --token-x 0x4200000000000000000000000000000000000006 \
  --token-y 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-x-decimals 18 \
  --token-y-decimals 6 \
  --bin-step 25 \
  --price-sorted-y-per-sorted-x 3000 \
  --lb-version v2 \
  --confirm-create \
  --json
```

Or USDC-first CLI order (~3000 USDC per 1 WETH as Y per X = WETH/USDC):

```bash
npm run sectorone -- build-create-pool \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --bin-step 25 \
  --price-token-y-per-token-x 0.000333 \
  --confirm-create \
  --json
```

### Add liquidity calldata

> Build add-liquidity calldata for WETH/USDC around the active bin.

```bash
npm run sectorone -- build-add-liquidity \
  --wallet 0xYourBaseMcpWallet \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --amount-x 100 \
  --amount-y 0.05 \
  --bin-step 25 \
  --distribution SPOT \
  --json
```

### Remove all liquidity from bins

> Remove all my SectorOne LP from these bin IDs.

```bash
npm run sectorone -- build-remove-liquidity \
  --wallet 0xYourBaseMcpWallet \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --bin-step 25 \
  --bin-ids 8376297,8376298,8376299 \
  --remove-all \
  --json
```

Use `read-position` first to pick `--bin-ids`. For partial exits use `--fraction 0.5` or explicit `--amounts`.

### LP exposure by bin IDs

> Show my SectorOne LP exposure for these bin IDs.

```bash
npm run sectorone -- read-position \
  --wallet 0xYourBaseMcpWallet \
  --pair 0xLbPairFromListPairs \
  --bin-ids 8376297,8376298,8376299 \
  --token-x 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --token-y 0x4200000000000000000000000000000000000006 \
  --token-x-decimals 6 \
  --token-y-decimals 18 \
  --json
```

### Normalize legacy unsigned txs

```bash
echo '[{"from":"0xWallet","to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0x","value":0}]' \
  | npm run sectorone -- normalize-calls --json
```
