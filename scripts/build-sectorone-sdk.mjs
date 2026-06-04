import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')
const vendorRoot = join(projectRoot, '_sectorone-ref', 'packages')

function distReady(pkgDir) {
  return existsSync(join(pkgDir, 'dist', 'index.js'))
}

function buildPkg(folder, name) {
  const pkgDir = join(vendorRoot, folder)
  if (!existsSync(join(pkgDir, 'package.json'))) {
    console.error(
      `[dlmmskills] ${name} not found at ${pkgDir}. Run: npm run bootstrap`
    )
    process.exit(1)
  }
  if (distReady(pkgDir)) return
  console.error(`[dlmmskills] Building ${name}...`)
  if (!existsSync(join(pkgDir, 'node_modules'))) {
    execSync('npm install', { cwd: pkgDir, stdio: 'inherit', env: process.env })
  }
  execSync('npm run build', { cwd: pkgDir, stdio: 'inherit', env: process.env })
}

buildPkg('core', '@sectorone/sdk-core')
buildPkg('v2', '@sectorone/sdk-v2')
