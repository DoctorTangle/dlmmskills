import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')
const sectorOneDir = join(projectRoot, '_sectorone-ref')
const SECTORONE_REPO = 'https://github.com/DoctorTangle/SectorOne.git'

// Pin the external SDK to an exact commit (single source of truth in package.json)
// so a fresh install can never silently pull new upstream code.
const projectPkg = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf8')
)
const SECTORONE_COMMIT = projectPkg.sectoroneSdkCommit
if (!/^[0-9a-f]{40}$/.test(SECTORONE_COMMIT ?? '')) {
  throw new Error(
    '[dlmmskills] package.json "sectoroneSdkCommit" must be a full 40-char commit SHA.'
  )
}

if (!existsSync(join(sectorOneDir, 'packages', 'core', 'package.json'))) {
  console.error(
    `[dlmmskills] Cloning SectorOne SDK @ ${SECTORONE_COMMIT} into _sectorone-ref...`
  )
  execSync(`git clone ${SECTORONE_REPO} "${sectorOneDir}"`, {
    stdio: 'inherit',
    env: process.env
  })
  execSync(`git -C "${sectorOneDir}" checkout --detach ${SECTORONE_COMMIT}`, {
    stdio: 'inherit',
    env: process.env
  })
}

// Verify the checkout matches the pin on every run (detects drift / tampering).
const head = execSync(`git -C "${sectorOneDir}" rev-parse HEAD`)
  .toString()
  .trim()
if (head !== SECTORONE_COMMIT) {
  throw new Error(
    `[dlmmskills] SectorOne SDK commit mismatch: expected ${SECTORONE_COMMIT}, got ${head}. ` +
      'Delete _sectorone-ref and re-run "npm run bootstrap".'
  )
}

const v2PkgPath = join(sectorOneDir, 'packages', 'v2', 'package.json')
if (existsSync(v2PkgPath)) {
  const pkg = JSON.parse(readFileSync(v2PkgPath, 'utf8'))
  if (pkg.dependencies?.['@sectorone/sdk-core']?.startsWith('workspace:')) {
    pkg.dependencies['@sectorone/sdk-core'] = 'file:../core'
    writeFileSync(v2PkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}
