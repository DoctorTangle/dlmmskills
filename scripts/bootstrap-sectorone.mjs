import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')
const sectorOneDir = join(projectRoot, '_sectorone-ref')
const SECTORONE_REPO = 'https://github.com/DoctorTangle/SectorOne.git'

if (!existsSync(join(sectorOneDir, 'packages', 'core', 'package.json'))) {
  console.error('[dlmmskills] Cloning SectorOne SDK into _sectorone-ref...')
  execSync(`git clone --depth 1 ${SECTORONE_REPO} "${sectorOneDir}"`, {
    stdio: 'inherit',
    env: process.env
  })
}

const v2PkgPath = join(sectorOneDir, 'packages', 'v2', 'package.json')
if (existsSync(v2PkgPath)) {
  const pkg = JSON.parse(readFileSync(v2PkgPath, 'utf8'))
  if (pkg.dependencies?.['@sectorone/sdk-core']?.startsWith('workspace:')) {
    pkg.dependencies['@sectorone/sdk-core'] = 'file:../core'
    writeFileSync(v2PkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}
