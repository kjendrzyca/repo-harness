#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const SCRIPT_DIR = __dirname
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..')
const PROMPT_TEMPLATE = path.join(SKILL_ROOT, 'assets', 'prompt.md')
const OUTPUT_SCHEMA = path.join(SKILL_ROOT, 'assets', 'output-schema.json')
const ARTIFACT_DIR = '.codex-ci'

function usage() {
  return `Usage: run-code-review.cjs [options]

Run the Codex PR review workflow locally from a checked-out git repository.

Options:
  --repo-dir DIR        Repository to review (default: current working directory)
  --base REV            Base ref/commit (default: origin/HEAD, origin/main, origin/master)
  --head REV            Head ref/commit to review (default: HEAD)
  --since SHA           Review commits after this SHA
  --full                Force a full diff review from merge-base(base, head)
  --reset               Ignore previous local review state
  --title TEXT          Review title shown in the prompt (default: current branch)
  --pr-number VALUE     PR number shown in the prompt (default: local)
  --pr-body-file FILE   Markdown/text file used as the PR description
  --model MODEL         Codex model (default: CODEX_MODEL or gpt-5.6-sol)
  --reasoning EFFORT    Reasoning effort (default: CODEX_REASONING or high)
  --sandbox MODE        Codex sandbox mode (default: CODEX_SANDBOX_MODE or workspace-write)
  --web-search MODE     Codex web search mode (default: CODEX_WEB_SEARCH_MODE or disabled)
  --no-codex            Build artifacts and prompt, but do not run Codex
  -h, --help            Show this help

Examples:
  node scripts/run-code-review.cjs --repo-dir ../my-repo --base origin/main
  node scripts/run-code-review.cjs --repo-dir ../my-repo --base origin/main --no-codex
  node scripts/run-code-review.cjs --repo-dir ../my-repo --base origin/main --since abc1234
`
}

function fail(message, code = 1) {
  console.error(`[code-review] ${message}`)
  process.exit(code)
}

function parseArgs(argv) {
  const opts = {
    repoDir: process.cwd(),
    base: '',
    head: 'HEAD',
    since: '',
    full: false,
    reset: false,
    title: '',
    prNumber: 'local',
    prBodyFile: '',
    model: process.env.CODEX_MODEL || 'gpt-5.6-sol',
    reasoning: process.env.CODEX_REASONING || 'high',
    sandbox: process.env.CODEX_SANDBOX_MODE || 'workspace-write',
    webSearch: process.env.CODEX_WEB_SEARCH_MODE || 'disabled',
    noCodex: false,
  }

  const takesValue = new Set([
    '--repo-dir',
    '--base',
    '--head',
    '--since',
    '--title',
    '--pr-number',
    '--pr-body-file',
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
      if (value == null) {
        value = argv[++i]
      }
      if (value == null || value === '') {
        fail(`${arg} requires a value`)
      }

      if (arg === '--repo-dir') opts.repoDir = value
      else if (arg === '--base') opts.base = value
      else if (arg === '--head') opts.head = value
      else if (arg === '--since') opts.since = value
      else if (arg === '--title') opts.title = value
      else if (arg === '--pr-number') opts.prNumber = value
      else if (arg === '--pr-body-file') opts.prBodyFile = value
      else if (arg === '--model') opts.model = value
      else if (arg === '--reasoning') opts.reasoning = value
      else if (arg === '--sandbox') opts.sandbox = value
      else if (arg === '--web-search') opts.webSearch = value
    } else if (arg === '--full') {
      opts.full = true
    } else if (arg === '--reset') {
      opts.reset = true
    } else if (arg === '--no-codex') {
      opts.noCodex = true
    } else {
      fail(`unknown option: ${arg}\n\n${usage()}`)
    }
  }

  if (opts.full && opts.reset) {
    fail('use either --full or --reset, not both')
  }

  return opts
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

function isAncestor(repoRoot, ancestor, descendant) {
  return (
    git(repoRoot, ['merge-base', '--is-ancestor', ancestor, descendant], {
      allowFailure: true,
    }).status === 0
  )
}

function detectBase(repoRoot) {
  const originHead = git(repoRoot, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], {
    allowFailure: true,
  })
  if (originHead.status === 0 && originHead.stdout.trim()) {
    return originHead.stdout.trim()
  }

  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (gitCommitExists(repoRoot, candidate)) return candidate
  }

  fail('could not detect a base ref; pass --base <ref>')
}

function shortRev(repoRoot, rev) {
  const result = git(repoRoot, ['rev-parse', '--short=8', rev], { allowFailure: true })
  return result.status === 0 ? result.stdout.trim() : String(rev).slice(0, 8)
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function resolveInputFile(repoRoot, filePath) {
  const direct = path.resolve(filePath)
  if (fs.existsSync(direct)) return direct

  const repoRelative = path.resolve(repoRoot, filePath)
  if (fs.existsSync(repoRelative)) return repoRelative

  fail(`file not found: ${filePath}`)
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function loadGuidelines(repoRoot) {
  const files = ['AGENTS.md', 'REVIEW_GUIDELINES.md']
  const sections = []

  for (const file of files) {
    const filePath = path.join(repoRoot, file)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf8').trim()
    if (content) {
      sections.push(`### ${file}\n\n${content}`)
    }
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

function trackedDiffSignature(repoRoot) {
  const unstaged = gitRaw(repoRoot, ['diff', '--binary', '--no-ext-diff', '--', ':!.codex-ci'], {
    allowFailure: true,
  })
  const staged = gitRaw(repoRoot, ['diff', '--cached', '--binary', '--no-ext-diff', '--', ':!.codex-ci'], {
    allowFailure: true,
  })
  return `${unstaged}\n--cached--\n${staged}`
}

function determineScope(repoRoot, { base, head, since, full, reset, lastReviewedSha }) {
  const mergeBase = gitText(repoRoot, ['merge-base', base, head])
  let mode = 'full'
  let reason = 'no_previous_review'
  let diffBase = mergeBase
  const sinceRev = since || lastReviewedSha || ''

  if (reset) {
    reason = 'reset_requested'
  } else if (full) {
    reason = 'forced_full_review'
  } else if (sinceRev) {
    if (gitCommitExists(repoRoot, sinceRev)) {
      if (isAncestor(repoRoot, sinceRev, head)) {
        const count = Number(gitText(repoRoot, ['rev-list', '--count', `${sinceRev}..${head}`]))
        if (count === 0) {
          mode = 'skip'
          reason = 'no_new_commits'
        } else {
          mode = 'incremental'
          diffBase = sinceRev
          reason = since ? 'since_requested_sha' : 'since_last_review'
        }
      } else {
        reason = 'history_rewritten'
      }
    } else {
      reason = 'previous_sha_missing'
    }
  }

  const commitCount =
    mode === 'skip' ? 0 : Number(gitText(repoRoot, ['rev-list', '--count', `${diffBase}..${head}`]))
  const commitRange = mode === 'skip' ? '' : `${shortRev(repoRoot, diffBase)}..${shortRev(repoRoot, head)}`

  return { mode, reason, mergeBase, diffBase, commitCount, commitRange }
}

function resolveRepoRoot(repoDir) {
  const dir = path.resolve(repoDir)
  const result = run('git', ['-C', dir, 'rev-parse', '--show-toplevel'])
  return result.stdout.trim()
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const repoRoot = resolveRepoRoot(opts.repoDir)
  const base = opts.base || detectBase(repoRoot)
  const head = opts.head || 'HEAD'
  const branch = gitText(repoRoot, ['rev-parse', '--abbrev-ref', head], { allowFailure: true }) || head
  const headSha = gitText(repoRoot, ['rev-parse', head])
  const stateDir = path.resolve(repoRoot, gitText(repoRoot, ['rev-parse', '--git-path', 'codex-review']))
  const statePath = path.join(stateDir, 'state.json')
  const previousReviewPath = path.join(stateDir, 'review.md')
  const artifactPath = path.join(repoRoot, ARTIFACT_DIR)

  if (!gitCommitExists(repoRoot, base)) {
    fail(`base ref does not resolve to a commit: ${base}`)
  }
  if (!gitCommitExists(repoRoot, head)) {
    fail(`head ref does not resolve to a commit: ${head}`)
  }

  let previousState = null
  if (!opts.reset && fs.existsSync(statePath)) {
    try {
      previousState = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    } catch (error) {
      console.error(`[code-review] ignoring invalid previous state: ${error.message}`)
    }
  }

  const reviewNumber = Number(previousState?.review_count || 0) + 1
  const scope = determineScope(repoRoot, {
    base,
    head,
    since: opts.since,
    full: opts.full,
    reset: opts.reset,
    lastReviewedSha: previousState?.last_reviewed_head_sha || '',
  })

  fs.mkdirSync(artifactPath, { recursive: true })
  writeFile(
    path.join(artifactPath, 'state-prev.json'),
    previousState ? `${JSON.stringify(previousState, null, 2)}\n` : '',
  )
  writeFile(path.join(artifactPath, 'review-prev.md'), readFileIfExists(previousReviewPath))

  if (scope.mode === 'skip') {
    console.log(
      `[code-review] No new commits to review. Last reviewed head: ${shortRev(repoRoot, headSha)}`,
    )
    process.exit(0)
  }

  writeFile(
    path.join(artifactPath, 'pr-diff.patch'),
    git(repoRoot, ['diff', scope.diffBase, head]).stdout,
  )
  writeFile(
    path.join(artifactPath, 'changed-files.txt'),
    `${gitText(repoRoot, ['diff', '--name-only', scope.diffBase, head])}\n`,
  )

  if (scope.mode === 'incremental') {
    writeFile(
      path.join(artifactPath, 'pr-diff-full.patch'),
      git(repoRoot, ['diff', scope.mergeBase, head]).stdout,
    )
    writeFile(
      path.join(artifactPath, 'changed-files-full.txt'),
      `${gitText(repoRoot, ['diff', '--name-only', scope.mergeBase, head])}\n`,
    )
  } else {
    fs.copyFileSync(path.join(artifactPath, 'pr-diff.patch'), path.join(artifactPath, 'pr-diff-full.patch'))
    fs.copyFileSync(
      path.join(artifactPath, 'changed-files.txt'),
      path.join(artifactPath, 'changed-files-full.txt'),
    )
  }

  writeFile(
    path.join(artifactPath, 'review-commits.txt'),
    `${gitText(repoRoot, ['log', '--oneline', `${scope.diffBase}..${head}`])}\n`,
  )

  const prBody = opts.prBodyFile
    ? fs.readFileSync(resolveInputFile(repoRoot, opts.prBodyFile), 'utf8')
    : '(local review; no PR description supplied)'
  const prompt = buildPrompt({
    PR_NUMBER: opts.prNumber,
    PR_TITLE: opts.title || branch,
    PR_BODY: prBody,
    BASE_REF: base,
    HEAD_REF: branch,
    REVIEW_MODE: scope.mode,
    REVIEW_SCOPE_REASON: scope.reason,
    COMMIT_RANGE: scope.commitRange,
    COMMIT_COUNT: scope.commitCount,
    DIFF_BASE_SHA: gitText(repoRoot, ['rev-parse', scope.diffBase]),
    HEAD_SHA: headSha,
    MERGE_BASE_SHA: scope.mergeBase,
    REVIEW_NUMBER: reviewNumber,
    GUIDELINES_SECTION: loadGuidelines(repoRoot),
  })

  writeFile(path.join(artifactPath, 'review-prompt.md'), prompt)
  fs.copyFileSync(OUTPUT_SCHEMA, path.join(artifactPath, 'output-schema.json'))

  console.error(
    `[code-review] Scope: mode=${scope.mode} reason=${scope.reason} commits=${scope.commitCount} range=${scope.commitRange}`,
  )
  console.error(`[code-review] Artifacts: ${path.relative(process.cwd(), artifactPath) || ARTIFACT_DIR}`)

  if (opts.noCodex) {
    console.log(`[code-review] Prompt built: ${path.join(ARTIFACT_DIR, 'review-prompt.md')}`)
    process.exit(0)
  }

  const beforeSignature = trackedDiffSignature(repoRoot)
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
    path.join(ARTIFACT_DIR, 'output-schema.json'),
    '-o',
    path.join(ARTIFACT_DIR, 'codex-review-output.json'),
    '-',
  ]

  const started = Date.now()
  const codexResult = run('codex', codexArgs, {
    cwd: repoRoot,
    input: prompt,
    inherit: true,
    allowFailure: true,
  })
  const durationSeconds = Math.round((Date.now() - started) / 1000)

  const afterSignature = trackedDiffSignature(repoRoot)
  if (afterSignature !== beforeSignature) {
    fail('Codex changed tracked files during review. Inspect git diff before continuing.')
  }

  if (codexResult.status !== 0) {
    fail(`codex exec failed with exit ${codexResult.status}`)
  }

  const outputPath = path.join(artifactPath, 'codex-review-output.json')
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    fail('codex exec produced no structured review output')
  }

  let output
  try {
    output = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${path.join(ARTIFACT_DIR, 'codex-review-output.json')}: ${error.message}`)
  }

  const reviewMarkdown = String(output.review_markdown || '').trim()
  if (!reviewMarkdown) {
    fail('structured output did not include review_markdown')
  }

  if (output.state && typeof output.state === 'object') {
    output.state.review_count = reviewNumber
    fs.mkdirSync(stateDir, { recursive: true })
    writeFile(statePath, `${JSON.stringify(output.state, null, 2)}\n`)
    writeFile(path.join(artifactPath, 'state-current.json'), `${JSON.stringify(output.state, null, 2)}\n`)
  }

  writeFile(path.join(artifactPath, 'review.md'), `${reviewMarkdown}\n`)
  fs.mkdirSync(stateDir, { recursive: true })
  writeFile(previousReviewPath, `${reviewMarkdown}\n`)

  console.error(`[code-review] Review completed in ${durationSeconds}s`)
  console.error(`[code-review] Review: ${path.join(ARTIFACT_DIR, 'review.md')}`)
  console.log(reviewMarkdown)
}

main()
