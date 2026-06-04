import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
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
    // --ignore-scripts: do not run lifecycle scripts from the external SDK's
    // (transitive) dependencies. Narrows the install-time trust boundary.
    execSync('npm install --ignore-scripts', {
      cwd: pkgDir,
      stdio: 'inherit',
      env: process.env
    })
  }
  // The vendored SDK packages build with `tsup src/index.ts --dts` but do NOT
  // declare tsup/typescript in their own devDependencies, so `npm run build`
  // resolves them via npm hoisting from this project's root node_modules.
  // Keep `tsup` and `typescript` in this repo's root devDependencies — removing
  // them breaks the SDK build on a fresh clone / in CI.
  execSync('npm run build', { cwd: pkgDir, stdio: 'inherit', env: process.env })
}

// Each SDK package installs its own copy of shared math libs (jsbi, big.js, ...).
// At runtime that creates multiple JSBI instances and the SDK's instanceof guards
// throw "Convert JSBI instances to native numbers". After the dist is built we drop
// the nested node_modules so every package resolves the single hoisted copy at the
// project root, giving one shared JSBI instance across core, v2 and this CLI.
function dedupeNestedModules(folder) {
  const nested = join(vendorRoot, folder, 'node_modules')
  if (existsSync(nested)) {
    rmSync(nested, { recursive: true, force: true })
  }
}

buildPkg('core', '@sectorone/sdk-core')
buildPkg('v2', '@sectorone/sdk-v2')
dedupeNestedModules('core')
dedupeNestedModules('v2')
