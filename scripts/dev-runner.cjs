const { execFileSync, spawn } = require('node:child_process')
const path = require('node:path')

function normalizeFsPath(value) {
  return (value || '').replace(/^\\\\\?\\/, '')
}

function resolveProjectRoot() {
  const packageJsonPath = normalizeFsPath(process.env.npm_package_json || '')
  if (packageJsonPath) return path.dirname(packageJsonPath)
  return path.resolve(__dirname, '..')
}

function mergeNoProxy(env) {
  const defaults = ['localhost', '127.0.0.1', '::1']
  const current = String(env.NO_PROXY || env.no_proxy || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const merged = Array.from(new Set([...current, ...defaults])).join(',')
  return { ...env, NO_PROXY: merged, no_proxy: merged }
}

const projectRoot = resolveProjectRoot()
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const viteConfig = path.join(projectRoot, 'vite.config.ts')

function cleanupProjectViteProcesses() {
  if (process.platform !== 'win32') return

  const escapedRoot = projectRoot.replace(/'/g, "''")
  const script = [
    `$root='${escapedRoot}'`,
    "Get-CimInstance Win32_Process",
    "| Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match [regex]::Escape($root) -and $_.CommandLine -match 'vite\\\\bin\\\\vite\\.js' }",
    '| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
  ].join(' ')

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
  } catch {
    // Best effort cleanup only.
  }
}

cleanupProjectViteProcesses()

const child = spawn(
  process.execPath,
  [viteBin, '--config', viteConfig, '--host', '127.0.0.1', '--port', '5173'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: mergeNoProxy(process.env),
  },
)

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
