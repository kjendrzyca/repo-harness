#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const SCRIPT_DIR = __dirname
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..')
const PROMPT_TEMPLATE = path.join(SKILL_ROOT, 'references', 'review-prompt.md')
const OUTPUT_SCHEMA = path.join(SKILL_ROOT, 'assets', 'local-output-schema.json')
const MAX_IGNORED_CONTENT_BYTES = 50 * 1024 * 1024
const MAX_GIT_OUTPUT_BUFFER_BYTES = envPositiveInteger('CODEX_REVIEW_MAX_GIT_OUTPUT_BUFFER_BYTES', 64 * 1024 * 1024)

function envPositiveInteger(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function usage() {
  return `Usage: run-local-review.cjs [options]

Run the repo-harness local review workflow using Codex exec plus a local continuity ledger.

Options:
  --repo-dir DIR        Repository to review (default: current working directory)
  --base REV            Review current branch against base ref (default: origin/HEAD, origin/main, origin/master)
  --commit SHA          Review a single checked-out commit instead of a branch diff; SHA must match HEAD
  --uncommitted         Review staged, unstaged, and untracked changes
  --reset               Ignore previous local review state
  --force               Review even if HEAD was already reviewed
  --title TEXT          Review title shown in the prompt
  --pr-body-file FILE   Markdown/text file used as extra review context
  --ledger-dir DIR      Store prompt/output/state here (default: git private codex-review path)
  --model MODEL         Codex model (default: CODEX_MODEL or gpt-5.5)
  --reasoning EFFORT    Reasoning effort config (default: CODEX_REASONING or xhigh)
  --sandbox MODE        Codex sandbox_mode config (default: CODEX_SANDBOX_MODE or workspace-write)
  --web-search MODE     Codex web_search config (default: CODEX_WEB_SEARCH_MODE or disabled)
  --no-codex            Build prompt and copy schema, but do not run Codex
  -h, --help            Show this help

Examples:
  node scripts/run-local-review.cjs --repo-dir ../my-repo --base origin/main
  node scripts/run-local-review.cjs --repo-dir ../my-repo --uncommitted
  node scripts/run-local-review.cjs --repo-dir ../my-repo --commit HEAD --title "Fix billing reset"
  node scripts/run-local-review.cjs --repo-dir ../my-repo --base origin/main --no-codex
`
}

function fail(message, code = 1) {
  console.error(`[local-code-review] ${message}`)
  process.exit(code)
}

function parseArgs(argv) {
  const opts = {
    repoDir: process.cwd(),
    base: '',
    commit: '',
    uncommitted: false,
    reset: false,
    force: false,
    title: '',
    prBodyFile: '',
    ledgerDir: '',
    model: process.env.CODEX_MODEL || 'gpt-5.5',
    reasoning: process.env.CODEX_REASONING || 'xhigh',
    sandbox: process.env.CODEX_SANDBOX_MODE || 'workspace-write',
    webSearch: process.env.CODEX_WEB_SEARCH_MODE || 'disabled',
    noCodex: false,
  }

  const takesValue = new Set([
    '--repo-dir',
    '--base',
    '--commit',
    '--title',
    '--pr-body-file',
    '--ledger-dir',
    '--model',
    '--reasoning',
    '--sandbox',
    '--web-search',
  ])

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

      if (arg === '--repo-dir') opts.repoDir = value
      else if (arg === '--base') opts.base = value
      else if (arg === '--commit') opts.commit = value
      else if (arg === '--title') opts.title = value
      else if (arg === '--pr-body-file') opts.prBodyFile = value
      else if (arg === '--ledger-dir') opts.ledgerDir = value
      else if (arg === '--model') opts.model = value
      else if (arg === '--reasoning') opts.reasoning = value
      else if (arg === '--sandbox') opts.sandbox = value
      else if (arg === '--web-search') opts.webSearch = value
    } else if (arg === '--uncommitted') {
      opts.uncommitted = true
    } else if (arg === '--reset') {
      opts.reset = true
    } else if (arg === '--force') {
      opts.force = true
    } else if (arg === '--no-codex') {
      opts.noCodex = true
    } else {
      fail(`unknown option: ${arg}\n\n${usage()}`)
    }
  }

  const scopeCount = [Boolean(opts.base), Boolean(opts.commit), opts.uncommitted].filter(Boolean).length
  if (scopeCount > 1) fail('use only one of --base, --commit, or --uncommitted')

  return opts
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? MAX_GIT_OUTPUT_BUFFER_BYTES,
    stdio: options.inherit ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) {
    const commandLine = `${command} ${args.join(' ')}`
    if (result.error.code === 'ENOBUFS') {
      fail(
        `${commandLine} exceeded the ${MAX_GIT_OUTPUT_BUFFER_BYTES} byte output buffer. ` +
          'Refusing to continue because the review mutation guard would be incomplete.',
      )
    }
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

function git(repoRoot, args, options = {}) {
  return run('git', args, { ...options, cwd: repoRoot })
}

function gitText(repoRoot, args, options = {}) {
  const result = git(repoRoot, args, options)
  return (result.stdout || '').trim()
}

function gitRaw(repoRoot, args, options = {}) {
  const result = git(repoRoot, args, options)
  return result.stdout || ''
}

function gitCommitExists(repoRoot, rev) {
  return git(repoRoot, ['cat-file', '-e', `${rev}^{commit}`], { allowFailure: true }).status === 0
}

function detectBase(repoRoot) {
  const originHead = git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], {
    allowFailure: true,
  })
  if (originHead.status === 0 && originHead.stdout.trim()) return originHead.stdout.trim()

  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (gitCommitExists(repoRoot, candidate)) return candidate
  }

  fail('could not detect a base ref; pass --base <ref>, --commit <sha>, or --uncommitted')
}

function resolveRepoRoot(repoDir) {
  const dir = path.resolve(repoDir)
  const result = run('git', ['-C', dir, 'rev-parse', '--show-toplevel'])
  return result.stdout.trim()
}

function resolveInputFile(repoRoot, filePath) {
  const direct = path.resolve(filePath)
  if (fs.existsSync(direct)) return direct

  const repoRelative = path.resolve(repoRoot, filePath)
  if (fs.existsSync(repoRelative)) return repoRelative

  fail(`file not found: ${filePath}`)
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function loadJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.error(`[local-code-review] ignoring invalid previous state: ${error.message}`)
    return null
  }
}

function loadGuidelines(repoRoot) {
  const files = ['AGENTS.md', 'REVIEW_GUIDELINES.md']
  const sections = []

  for (const file of files) {
    const filePath = path.join(repoRoot, file)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf8').trim()
    if (content) sections.push(`### ${file}\n\n${content}`)
  }

  return sections.length
    ? sections.join('\n\n---\n\n')
    : '_No repo guidelines found. Add AGENTS.md or REVIEW_GUIDELINES.md to your repo root for project-specific review rules._'
}

function buildPrompt(vars) {
  let template = fs.readFileSync(PROMPT_TEMPLATE, 'utf8')
  for (const [key, value] of Object.entries(vars)) {
    template = template.split(`\${${key}}`).join(String(value ?? ''))
  }
  return template
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function gitNullList(repoRoot, args) {
  const result = git(repoRoot, args)
  return result.stdout.split('\0').filter(Boolean).sort()
}

function fileType(stat) {
  if (stat.isFile()) return 'file'
  if (stat.isDirectory()) return 'directory'
  if (stat.isSymbolicLink()) return 'symlink'
  return 'other'
}

function fingerprintWorktreeFiles(repoRoot, files, options = {}) {
  let remainingContentBytes = options.maxContentBytes ?? Number.POSITIVE_INFINITY

  return files.map((file) => {
    const absolutePath = path.join(repoRoot, file)
    let stat
    try {
      stat = fs.lstatSync(absolutePath)
    } catch (error) {
      return { path: file, missing: true, error: error.code || error.message }
    }

    const entry = {
      path: file,
      type: fileType(stat),
      mode: stat.mode,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    }

    if (stat.isSymbolicLink()) {
      try {
        entry.target = fs.readlinkSync(absolutePath)
      } catch (error) {
        entry.readlinkError = error.code || error.message
      }
      return entry
    }

    if (stat.isFile() && options.hashContents !== false) {
      if (stat.size <= remainingContentBytes) {
        try {
          entry.sha256 = sha256File(absolutePath)
          remainingContentBytes -= stat.size
        } catch (error) {
          entry.hashError = error.code || error.message
        }
      } else {
        entry.sha256Skipped = 'content-byte-limit'
      }
    }

    return entry
  })
}

function currentHeadRef(repoRoot) {
  const result = git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true })
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim()
  return '(detached)'
}

function worktreeMutationSignature(repoRoot) {
  const untracked = gitNullList(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z'])
  const ignored = gitNullList(repoRoot, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'])
  return JSON.stringify({
    headSha: gitText(repoRoot, ['rev-parse', 'HEAD']),
    headRef: currentHeadRef(repoRoot),
    unstagedDiff: gitRaw(repoRoot, ['diff', '--binary', '--no-ext-diff']),
    stagedDiff: gitRaw(repoRoot, ['diff', '--cached', '--binary', '--no-ext-diff']),
    untrackedFiles: fingerprintWorktreeFiles(repoRoot, untracked),
    ignoredFiles: fingerprintWorktreeFiles(repoRoot, ignored, { maxContentBytes: MAX_IGNORED_CONTENT_BYTES }),
    statusIncludingIgnored: gitRaw(repoRoot, ['status', '--short', '--untracked-files=all', '--ignored=matching']),
  })
}

function worktreeMutationFingerprint(repoRoot) {
  return sha256(worktreeMutationSignature(repoRoot))
}

function copyLedgerSnapshot(ledgerDir, runDir) {
  fs.mkdirSync(runDir, { recursive: true })
  for (const name of ['prompt.md', 'codex-review-output.json', 'review.md', 'state.json']) {
    const source = path.join(ledgerDir, name)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(runDir, name))
  }
}

function resolveLedgerDir(repoRoot, requested) {
  if (requested) return path.resolve(repoRoot, requested)
  return path.resolve(repoRoot, gitText(repoRoot, ['rev-parse', '--git-path', 'codex-review']))
}

function currentScope(opts, repoRoot) {
  if (opts.uncommitted) {
    return {
      kind: 'uncommitted',
      base: '',
      commit: '',
      label: 'staged, unstaged, and untracked changes',
      headSha: gitText(repoRoot, ['rev-parse', 'HEAD']),
    }
  }

  if (opts.commit) {
    if (!gitCommitExists(repoRoot, opts.commit)) fail(`commit does not resolve to a commit: ${opts.commit}`)
    const commit = gitText(repoRoot, ['rev-parse', opts.commit])
    const headSha = gitText(repoRoot, ['rev-parse', 'HEAD'])
    if (commit !== headSha) {
      fail(
        `commit reviews require the target commit to be checked out as HEAD.\n` +
          `Requested commit: ${commit}\n` +
          `Current HEAD:      ${headSha}\n\n` +
          'Check out the target commit in this repository or in a temporary git worktree, then rerun with --commit HEAD.',
      )
    }
    return {
      kind: 'commit',
      base: '',
      commit,
      label: `commit ${opts.commit}`,
      headSha,
    }
  }

  const base = opts.base || detectBase(repoRoot)
  if (!gitCommitExists(repoRoot, base)) fail(`base ref does not resolve to a commit: ${base}`)
  return {
    kind: 'base',
    base,
    commit: '',
    label: `current branch against ${base}`,
    headSha: gitText(repoRoot, ['rev-parse', 'HEAD']),
  }
}

function requireCleanWorktreeForCommittedScope(repoRoot, scopeKind) {
  const rawStatus = git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']).stdout
  if (!rawStatus.trim()) return
  const status = rawStatus.trimEnd()

  fail(
    `${scopeKind} reviews require a clean worktree so Codex reads exactly the committed scope under review.\n` +
      'Use --uncommitted when local staged, unstaged, or untracked changes are part of the review.\n\n' +
      `Current git status:\n${status}`,
  )
}

function scopeKey(repoRoot, scope) {
  if (scope.kind === 'uncommitted') {
    return sha256(
      JSON.stringify({
        kind: scope.kind,
        headSha: scope.headSha,
        worktree: worktreeMutationFingerprint(repoRoot),
      }),
    )
  }

  if (scope.kind === 'commit') {
    return sha256(
      JSON.stringify({
        kind: scope.kind,
        commit: scope.commit,
        headSha: scope.headSha,
      }),
    )
  }

  return sha256(
    JSON.stringify({
      kind: scope.kind,
      baseSha: gitText(repoRoot, ['rev-parse', scope.base]),
      mergeBaseSha: gitText(repoRoot, ['merge-base', scope.base, 'HEAD']),
      headSha: scope.headSha,
    }),
  )
}

function scopeInstructions(scope) {
  if (scope.kind === 'uncommitted') {
    return [
      'Review staged, unstaged, and untracked changes in the current working tree.',
      'Start with:',
      '- `git status --short`',
      '- `git diff --cached --stat` and `git diff --cached` for staged changes',
      '- `git diff --stat` and `git diff` for unstaged changes',
      '- `git ls-files --others --exclude-standard` for untracked files, then read each relevant file',
    ].join('\n')
  }

  if (scope.kind === 'commit') {
    return [
      `Review the changes introduced by commit ${scope.commit}.`,
      'Start with:',
      `- \`git show --stat --oneline --decorate --no-renames ${scope.commit}\``,
      `- \`git show --find-renames --unified=80 ${scope.commit}\``,
      '- Read touched source files and their callers/siblings as needed.',
    ].join('\n')
  }

  return [
    `Review the current branch against base ref ${scope.base}.`,
    'Start with:',
    `- \`git log --oneline ${scope.base}..HEAD\``,
    `- \`git diff --stat ${scope.base}...HEAD\``,
    `- \`git diff --find-renames --unified=80 ${scope.base}...HEAD\``,
    '- Read touched source files and their callers/siblings as needed.',
  ].join('\n')
}

function normalizeState(outputState, previousState, headSha, reviewNumber, currentScopeKey) {
  const state = outputState && typeof outputState === 'object' ? outputState : {}
  state.schema_version = 1
  state.last_reviewed_head_sha = headSha
  state.scope_key = currentScopeKey
  state.review_count = reviewNumber
  state.updated_at = new Date().toISOString()
  if (!Array.isArray(state.open_issues)) state.open_issues = []
  if (!Array.isArray(state.recently_resolved_issues)) state.recently_resolved_issues = []

  for (const issue of state.open_issues) {
    if (!issue.first_seen_head_sha) issue.first_seen_head_sha = headSha
    issue.last_seen_head_sha = headSha
    issue.status = 'open'
  }

  const previousOpenIds = new Set((previousState?.open_issues || []).map((issue) => issue.id).filter(Boolean))
  state.recently_resolved_issues = state.recently_resolved_issues.filter((issue) => {
    return issue && issue.id && previousOpenIds.has(issue.id)
  })

  return state
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const repoRoot = resolveRepoRoot(opts.repoDir)
  const scope = currentScope(opts, repoRoot)
  if (scope.kind !== 'uncommitted') requireCleanWorktreeForCommittedScope(repoRoot, scope.kind)
  const currentScopeKey = scopeKey(repoRoot, scope)
  const ledgerDir = resolveLedgerDir(repoRoot, opts.ledgerDir)
  const statePath = path.join(ledgerDir, 'state.json')
  const reviewPath = path.join(ledgerDir, 'review.md')
  const outputPath = path.join(ledgerDir, 'codex-review-output.json')
  const promptPath = path.join(ledgerDir, 'prompt.md')
  const schemaPath = path.join(ledgerDir, 'local-output-schema.json')

  const previousState = opts.reset ? null : loadJsonIfExists(statePath)
  const previousReview = opts.reset ? '' : readFileIfExists(reviewPath)
  const reviewNumber = Number(previousState?.review_count || 0) + 1
  const alreadyReviewed =
    !opts.reset &&
    !opts.force &&
    previousState?.last_reviewed_head_sha &&
    previousState.last_reviewed_head_sha === scope.headSha &&
    previousState.scope_key === currentScopeKey

  if (alreadyReviewed) {
    console.log(
      `[local-code-review] No new scope to review. Last reviewed head: ${scope.headSha.slice(0, 8)}. Use --force to re-review.`,
    )
    process.exit(0)
  }

  const prBody = opts.prBodyFile
    ? fs.readFileSync(resolveInputFile(repoRoot, opts.prBodyFile), 'utf8')
    : '(local review; no PR description supplied)'
  const title =
    opts.title ||
    (scope.kind === 'commit'
      ? gitText(repoRoot, ['show', '-s', '--format=%s', scope.commit])
      : gitText(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFailure: true }) || 'local review')
  const continuityReason = opts.reset
    ? 'reset_requested'
    : previousState
      ? previousState.scope_key === currentScopeKey
        ? 'previous_state_loaded'
        : 'previous_state_loaded_for_different_scope'
      : 'no_previous_review'
  const prompt = buildPrompt({
    REVIEW_TITLE: title,
    REVIEW_SCOPE: `${scope.label}\n\nExtra context:\n${prBody}`,
    BASE_REF: scope.base || '(not used)',
    COMMIT_REF: scope.commit || '(not used)',
    HEAD_SHA: scope.headSha,
    SCOPE_KEY: currentScopeKey,
    REVIEW_NUMBER: reviewNumber,
    CONTINUITY_REASON: continuityReason,
    SCOPE_INSTRUCTIONS: scopeInstructions(scope),
    PREVIOUS_STATE_JSON: previousState ? JSON.stringify(previousState, null, 2) : '{}',
    PREVIOUS_REVIEW_MARKDOWN: previousReview || '(none)',
    GUIDELINES_SECTION: loadGuidelines(repoRoot),
  })

  fs.mkdirSync(ledgerDir, { recursive: true })
  writeFile(promptPath, prompt)
  fs.copyFileSync(OUTPUT_SCHEMA, schemaPath)

  console.error(`[local-code-review] Scope: ${scope.label}`)
  console.error(`[local-code-review] Ledger: ${path.relative(repoRoot, ledgerDir) || ledgerDir}`)

  if (opts.noCodex) {
    console.log(`[local-code-review] Prompt built: ${promptPath}`)
    process.exit(0)
  }

  const codexArgs = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--model',
    opts.model,
    '--sandbox',
    opts.sandbox,
    '-c',
    'allow_login_shell=false',
    '-c',
    `web_search="${opts.webSearch}"`,
    '-c',
    `model_reasoning_effort="${opts.reasoning}"`,
    '-c',
    'sandbox_workspace_write.network_access=false',
    '--output-schema',
    schemaPath,
    '-o',
    outputPath,
  ]
  codexArgs.push('-')

  const beforeSignature = worktreeMutationSignature(repoRoot)
  const started = Date.now()
  const codexResult = run('codex', codexArgs, {
    cwd: repoRoot,
    input: prompt,
    inherit: true,
    allowFailure: true,
  })
  const durationSeconds = Math.round((Date.now() - started) / 1000)
  const afterSignature = worktreeMutationSignature(repoRoot)

  if (afterSignature !== beforeSignature) {
    fail('Codex changed the worktree during review. Inspect git status and diff before continuing.')
  }
  if (codexResult.status !== 0) fail(`codex exec failed with exit ${codexResult.status}`)
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    fail('codex exec produced no structured review output')
  }

  let output
  try {
    output = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${outputPath}: ${error.message}`)
  }

  const reviewMarkdown = String(output.review_markdown || '').trim()
  if (!reviewMarkdown) fail('structured output did not include review_markdown')

  const state = normalizeState(output.state, previousState, scope.headSha, reviewNumber, currentScopeKey)
  writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
  writeFile(reviewPath, `${reviewMarkdown}\n`)

  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  copyLedgerSnapshot(ledgerDir, path.join(ledgerDir, 'runs', runId))

  console.error(`[local-code-review] Review completed in ${durationSeconds}s`)
  console.error(`[local-code-review] Review: ${reviewPath}`)
  console.log(reviewMarkdown)
}

main()
