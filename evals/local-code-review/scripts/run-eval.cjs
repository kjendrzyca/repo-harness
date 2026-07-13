#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const SCRIPT_DIR = __dirname
const EVAL_ROOT = path.resolve(SCRIPT_DIR, '..')
const REPO_ROOT = path.resolve(EVAL_ROOT, '..', '..')
const SKILL_ROOT = path.join(REPO_ROOT, 'skills', 'local-code-review')
const WORKSPACE_ROOT = path.join(EVAL_ROOT, 'workspaces')
const EVALS_JSON = path.join(EVAL_ROOT, 'evals.json')

function usage() {
  return `Usage: run-eval.cjs [options]

Run local-code-review eval fixtures against the legacy bot-parity runner and/or local runner.

Options:
  --runner NAME      Runner to evaluate: legacy, local, all (default: all)
  --model MODEL      Codex review model (default: CODEX_MODEL or gpt-5.6-sol)
  --reasoning LEVEL  Reasoning effort config (default: CODEX_REASONING or high)
  --run-id ID        Workspace run id safe slug (default: timestamp)
  --no-codex         Build prompts/artifacts without model calls
  --keep             Keep existing workspace for run id instead of replacing it
  -h, --help         Show this help

Examples:
  node evals/local-code-review/scripts/run-eval.cjs --runner all
  node evals/local-code-review/scripts/run-eval.cjs --runner local --model gpt-5.6-sol
  node evals/local-code-review/scripts/run-eval.cjs --runner all --no-codex
`
}

function fail(message, code = 1) {
  console.error(`[local-code-review-eval] ${message}`)
  process.exit(code)
}

function parseArgs(argv) {
  const opts = {
    runner: 'all',
    model: process.env.CODEX_MODEL || 'gpt-5.6-sol',
    reasoning: process.env.CODEX_REASONING || 'high',
    runId: new Date().toISOString().replace(/[:.]/g, '-'),
    noCodex: false,
    keep: false,
  }
  const takesValue = new Set(['--runner', '--model', '--reasoning', '--run-id'])

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]
    let value = null

    if (arg === '-h' || arg === '--help') {
      console.log(usage())
      process.exit(0)
    }

    const eq = arg.indexOf('=')
    if (eq !== -1 && arg.startsWith('--')) {
      value = arg.slice(eq + 1)
      arg = arg.slice(0, eq)
    }

    if (takesValue.has(arg)) {
      if (value == null) value = argv[++i]
      if (value == null || value === '') fail(`${arg} requires a value`)
      if (arg === '--runner') opts.runner = value
      else if (arg === '--model') opts.model = value
      else if (arg === '--reasoning') opts.reasoning = value
      else if (arg === '--run-id') opts.runId = value
    } else if (arg === '--no-codex') {
      opts.noCodex = true
    } else if (arg === '--keep') {
      opts.keep = true
    } else {
      fail(`unknown option: ${arg}\n\n${usage()}`)
    }
  }

  if (opts.runner === 'native') opts.runner = 'local'
  if (!['legacy', 'local', 'all'].includes(opts.runner)) fail('--runner must be legacy, local, or all')
  return opts
}

function resolveRunDir(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId)) {
    fail('--run-id must be a 1-128 character slug using only letters, numbers, dot, underscore, and dash')
  }

  const workspaceRoot = path.resolve(WORKSPACE_ROOT)
  const runDir = path.resolve(workspaceRoot, runId)
  const relative = path.relative(workspaceRoot, runDir)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`resolved run directory escapes workspace root: ${runId}`)
  }
  return runDir
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    stdio: options.inherit ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) {
    if (options.allowFailure) return result
    fail(`${command} failed to start: ${result.error.message}`)
  }
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = (result.stderr || '').trim()
    const stdout = (result.stdout || '').trim()
    fail(
      `${command} ${args.join(' ')} failed with exit ${result.status}` +
        (stderr ? `\n${stderr}` : stdout ? `\n${stdout}` : ''),
    )
  }
  return result
}

function git(repoDir, args, options = {}) {
  return run('git', args, { ...options, cwd: repoDir })
}

function gitText(repoDir, args, options = {}) {
  return (git(repoDir, args, options).stdout || '').trim()
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function copyIfExists(source, dest) {
  if (!fs.existsSync(source)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(source, dest)
}

function writeBaseFixture(repoDir) {
  writeFile(
    path.join(repoDir, 'AGENTS.md'),
    `# Repository Review Rules

- Tenant lifecycle code must clear every tenant-specific mutable field during reset.
- Billing state must never leak across tenant reset, reactivation, or test lifecycle paths.
- Reviewers should treat missing reset/copy/serialization updates for newly added fields as correctness issues.
`,
  )
  writeFile(
    path.join(repoDir, 'package.json'),
    `{
  "name": "local-code-review-eval-fixture",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
`,
  )
  writeFile(
    path.join(repoDir, 'src', 'tenantStore.js'),
    `export function createTenant(id, ownerEmail) {
  return {
    id,
    ownerEmail,
    status: 'active',
    featureFlags: [],
    auditLog: [],
  }
}

export function enableFeature(tenant, featureName) {
  tenant.featureFlags.push(featureName)
  tenant.auditLog.push({ type: 'feature-enabled', featureName })
}

export function resetTenant(tenant) {
  tenant.status = 'pending'
  tenant.featureFlags = []
  tenant.auditLog.push({ type: 'reset' })
}

export function serializeTenant(tenant) {
  return {
    id: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: tenant.status,
    featureFlags: [...tenant.featureFlags],
  }
}
`,
  )
}

function writeBugFixture(repoDir) {
  writeFile(
    path.join(repoDir, 'src', 'tenantStore.js'),
    `export function createTenant(id, ownerEmail) {
  return {
    id,
    ownerEmail,
    status: 'active',
    featureFlags: [],
    billingCredits: 0,
    auditLog: [],
  }
}

export function enableFeature(tenant, featureName) {
  tenant.featureFlags.push(featureName)
  tenant.auditLog.push({ type: 'feature-enabled', featureName })
}

export function addBillingCredits(tenant, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be positive')
  }
  tenant.billingCredits += amount
  tenant.auditLog.push({ type: 'billing-credits-added', amount })
}

export function resetTenant(tenant) {
  tenant.status = 'pending'
  tenant.featureFlags = []
  tenant.auditLog.push({ type: 'reset' })
}

export function serializeTenant(tenant) {
  return {
    id: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: tenant.status,
    featureFlags: [...tenant.featureFlags],
    billingCredits: tenant.billingCredits,
  }
}
`,
  )
}

function writeFixFixture(repoDir) {
  writeFile(
    path.join(repoDir, 'src', 'tenantStore.js'),
    `export function createTenant(id, ownerEmail) {
  return {
    id,
    ownerEmail,
    status: 'active',
    featureFlags: [],
    billingCredits: 0,
    auditLog: [],
  }
}

export function enableFeature(tenant, featureName) {
  tenant.featureFlags.push(featureName)
  tenant.auditLog.push({ type: 'feature-enabled', featureName })
}

export function addBillingCredits(tenant, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be positive')
  }
  tenant.billingCredits += amount
  tenant.auditLog.push({ type: 'billing-credits-added', amount })
}

export function resetTenant(tenant) {
  tenant.status = 'pending'
  tenant.featureFlags = []
  tenant.billingCredits = 0
  tenant.auditLog.push({ type: 'reset' })
}

export function serializeTenant(tenant) {
  return {
    id: tenant.id,
    ownerEmail: tenant.ownerEmail,
    status: tenant.status,
    featureFlags: [...tenant.featureFlags],
    billingCredits: tenant.billingCredits,
  }
}
`,
  )
}

function commitAll(repoDir, message) {
  git(repoDir, ['add', 'AGENTS.md', 'package.json', 'src/tenantStore.js'])
  git(repoDir, ['commit', '-m', message])
  return gitText(repoDir, ['rev-parse', 'HEAD'])
}

function createFixture(repoDir) {
  fs.mkdirSync(repoDir, { recursive: true })
  git(repoDir, ['init', '-b', 'main'])
  git(repoDir, ['config', 'user.name', 'Code Review Eval'])
  git(repoDir, ['config', 'user.email', 'local-code-review-eval@example.invalid'])
  writeBaseFixture(repoDir)
  const baseSha = commitAll(repoDir, 'Initial tenant store')
  git(repoDir, ['switch', '-c', 'review-target'])
  writeBugFixture(repoDir)
  const bugSha = commitAll(repoDir, 'Add tenant billing credits')
  return { baseSha, bugSha }
}

function applyFixCommit(repoDir) {
  writeFixFixture(repoDir)
  return commitAll(repoDir, 'Reset tenant billing credits')
}

function runnerCommand(runner, repoDir, opts, title) {
  const common = ['--repo-dir', repoDir, '--base', 'main', '--title', title, '--model', opts.model, '--reasoning', opts.reasoning]
  if (opts.noCodex) common.push('--no-codex')

  if (runner === 'legacy') {
    return {
      command: 'node',
      args: [path.join(SKILL_ROOT, 'scripts', 'run-code-review.cjs'), ...common],
    }
  }

  return {
    command: 'node',
    args: [path.join(SKILL_ROOT, 'scripts', 'run-local-review.cjs'), ...common],
  }
}

function collectOutputs(runner, repoDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true })

  if (runner === 'legacy') {
    copyIfExists(path.join(repoDir, '.codex-ci', 'review.md'), path.join(outputDir, 'review.md'))
    copyIfExists(path.join(repoDir, '.codex-ci', 'codex-review-output.json'), path.join(outputDir, 'codex-review-output.json'))
    copyIfExists(path.join(repoDir, '.codex-ci', 'state-current.json'), path.join(outputDir, 'state.json'))
    copyIfExists(path.join(repoDir, '.codex-ci', 'review-prompt.md'), path.join(outputDir, 'prompt.md'))
  } else {
    const ledgerDir = path.join(repoDir, '.git', 'codex-review')
    copyIfExists(path.join(ledgerDir, 'review.md'), path.join(outputDir, 'review.md'))
    copyIfExists(path.join(ledgerDir, 'codex-review-output.json'), path.join(outputDir, 'codex-review-output.json'))
    copyIfExists(path.join(ledgerDir, 'state.json'), path.join(outputDir, 'state.json'))
    copyIfExists(path.join(ledgerDir, 'prompt.md'), path.join(outputDir, 'prompt.md'))
  }

  writeFile(path.join(outputDir, 'git-head.txt'), `${gitText(repoDir, ['rev-parse', 'HEAD'])}\n`)
}

function includesBillingResetFinding(reviewText, state) {
  const text = `${reviewText}\n${JSON.stringify(state || {})}`.toLowerCase()
  return (
    (text.includes('billingcredits') || text.includes('billing credits')) &&
    text.includes('reset')
  )
}

function hasFailureScenario(reviewText, state) {
  const text = `${reviewText}\n${JSON.stringify(state || {})}`.toLowerCase()
  return text.includes('failure scenario') || text.includes('scenario') || text.includes('leak')
}

function gradeRunnerOutput(runnerDir) {
  const firstReview = readText(path.join(runnerDir, 'pass-1', 'review.md'))
  const secondReview = readText(path.join(runnerDir, 'pass-2', 'review.md'))
  const firstState = readJson(path.join(runnerDir, 'pass-1', 'state.json'))
  const secondState = readJson(path.join(runnerDir, 'pass-2', 'state.json'))
  const secondStateText = JSON.stringify(secondState || {}).toLowerCase()

  const results = [
    {
      assertion: 'Pass 1 identifies that resetTenant fails to clear billingCredits.',
      passed: includesBillingResetFinding(firstReview, firstState),
    },
    {
      assertion: 'Pass 1 includes a concrete failure scenario.',
      passed: hasFailureScenario(firstReview, firstState),
    },
    {
      assertion: 'Pass 1 writes at least one open issue to continuity state.',
      passed: Array.isArray(firstState?.open_issues) && firstState.open_issues.length > 0,
    },
    {
      assertion: 'Pass 2 marks the previous billingCredits issue as resolved after the fix commit.',
      passed:
        (Array.isArray(secondState?.recently_resolved_issues) &&
          secondState.recently_resolved_issues.length > 0 &&
          secondStateText.includes('billing')) ||
        secondReview.toLowerCase().includes('resolved'),
    },
    {
      assertion: 'Pass 2 does not keep the fixed billingCredits issue open.',
      passed: !JSON.stringify(secondState?.open_issues || []).toLowerCase().includes('billing'),
    },
  ]

  return {
    assertion_results: results,
    summary: {
      passed: results.filter((item) => item.passed).length,
      failed: results.filter((item) => !item.passed).length,
      total: results.length,
    },
  }
}

function runOneRunner(runner, runDir, opts) {
  const runnerDir = path.join(runDir, runner)
  const repoDir = path.join(runnerDir, 'repo')
  fs.mkdirSync(runnerDir, { recursive: true })

  const fixture = createFixture(repoDir)
  writeFile(path.join(runnerDir, 'fixture.json'), `${JSON.stringify(fixture, null, 2)}\n`)

  console.error(`[local-code-review-eval] ${runner}: pass 1 on bug commit ${fixture.bugSha.slice(0, 8)}`)
  let command = runnerCommand(runner, repoDir, opts, 'Eval: tenant billing credits reset omission')
  run(command.command, command.args, { cwd: REPO_ROOT, inherit: true })
  collectOutputs(runner, repoDir, path.join(runnerDir, 'pass-1'))

  const fixSha = applyFixCommit(repoDir)
  writeFile(path.join(runnerDir, 'fix-sha.txt'), `${fixSha}\n`)

  console.error(`[local-code-review-eval] ${runner}: pass 2 on fix commit ${fixSha.slice(0, 8)}`)
  command = runnerCommand(runner, repoDir, opts, 'Eval: tenant billing credits reset omission')
  run(command.command, command.args, { cwd: REPO_ROOT, inherit: true })
  collectOutputs(runner, repoDir, path.join(runnerDir, 'pass-2'))

  const grade = opts.noCodex
    ? { skipped: true, reason: '--no-codex' }
    : gradeRunnerOutput(runnerDir)
  writeFile(path.join(runnerDir, 'grading.json'), `${JSON.stringify(grade, null, 2)}\n`)
  return grade
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const evalSpec = JSON.parse(fs.readFileSync(EVALS_JSON, 'utf8'))
  const runDir = resolveRunDir(opts.runId)

  if (fs.existsSync(runDir) && !opts.keep) fs.rmSync(runDir, { recursive: true, force: true })
  fs.mkdirSync(runDir, { recursive: true })
  writeFile(path.join(runDir, 'evals.json'), `${JSON.stringify(evalSpec, null, 2)}\n`)

  const runners = opts.runner === 'all' ? ['legacy', 'local'] : [opts.runner]
  const grades = {}
  for (const runner of runners) {
    grades[runner] = runOneRunner(runner, runDir, opts)
  }

  const benchmark = {
    run_id: opts.runId,
    model: opts.model,
    reasoning: opts.reasoning,
    eval_id: evalSpec.evals[0].id,
    runners,
    grades,
  }
  writeFile(path.join(runDir, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`)

  console.log(JSON.stringify(benchmark, null, 2))
  console.error(`[local-code-review-eval] Workspace: ${runDir}`)
}

main()
