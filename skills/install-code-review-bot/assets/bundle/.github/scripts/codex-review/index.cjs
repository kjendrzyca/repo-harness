// Codex Code Review — Core logic for state management, posting, and prompt building.
// This file is loaded by actions/github-script steps in the workflow.
'use strict'

const fs = require('fs')
const path = require('path')

// ─── Comment Markers ──────────────────────────────────────────────────────────
// These HTML comments identify bot-managed comments on the PR.
const MARKERS = {
  state: 'codex-review:state:v1:base64',
  review: 'codex-review:review',
  stale: 'codex-review:stale',
}

const SEVERITY_EMOJI = {
  P0: '🔴',
  P1: '🟡',
  P2: '🔵',
}

function formatReviewLabel(reviewNumber) {
  return `Codex Review Pass ${reviewNumber}`
}

function formatSeverityBadge(severity) {
  const emoji = SEVERITY_EMOJI[severity]
  return emoji ? `${emoji} [${severity}]` : null
}

function buildIssueSeverityMap(reviewState) {
  const map = new Map()
  for (const issue of reviewState?.open_issues || []) {
    if (issue?.id && issue?.severity) {
      map.set(issue.id, issue.severity)
    }
  }
  return map
}

// ─── State Management ─────────────────────────────────────────────────────────

/**
 * Load previous review state from GitHub PR comments.
 *
 * State is stored as base64-encoded JSON inside a hidden HTML comment.
 * The review comment is identified by a marker and must not be stale.
 *
 * @returns {{ stateCommentId, reviewCommentId, lastReviewedSha, reviewCount, lastInlineReviewId, state, previousReviewBody }}
 */
async function loadPreviousState({ github, owner, repo, prNumber, reset }) {
  const result = {
    stateCommentId: null,
    reviewCommentId: null,
    lastReviewedSha: null,
    reviewCount: 0,
    lastInlineReviewId: null,
    state: null,
    previousReviewBody: null,
  }

  if (reset) {
    console.log('Reset requested — ignoring previous state')
    return result
  }

  const comments = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
    sort: 'updated',
    direction: 'desc',
  })

  for (const comment of comments.data) {
    if (comment.user?.login !== 'github-actions[bot]') continue
    const body = comment.body || ''

    // Find latest non-stale review comment
    if (
      !result.reviewCommentId &&
      body.includes(`<!-- ${MARKERS.review} -->`) &&
      !body.includes(`<!-- ${MARKERS.stale} -->`)
    ) {
      result.reviewCommentId = comment.id
      result.previousReviewBody = body
    }

    // Find state comment
    if (!result.stateCommentId && body.includes(MARKERS.state)) {
      result.stateCommentId = comment.id
      const escaped = MARKERS.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`<!--\\s*${escaped}\\s*\\n([A-Za-z0-9+/=\\n]+)\\n\\s*-->`)
      const match = body.match(re)
      if (match?.[1]) {
        try {
          const json = Buffer.from(match[1].replace(/\s+/g, ''), 'base64').toString('utf8')
          result.state = JSON.parse(json)
          result.lastReviewedSha = result.state.last_reviewed_head_sha || null
          result.reviewCount = result.state.review_count || 0
          result.lastInlineReviewId = result.state.lastInlineReviewId || null
          console.log(
            `Loaded state: review_count=${result.reviewCount}, last_sha=${result.lastReviewedSha?.slice(0, 8) || 'none'}`,
          )
        } catch (e) {
          console.log(`Failed to parse state: ${e.message}`)
        }
      }
    }

    if (result.stateCommentId && result.reviewCommentId) break
  }

  return result
}

function summarizePreviousState(previousState) {
  const activeInlineReviewIds = previousState?.activeInlineReviewIds?.length
    ? previousState.activeInlineReviewIds
    : previousState?.state?.activeInlineReviewIds?.length
      ? previousState.state.activeInlineReviewIds
      : previousState?.lastInlineReviewId != null
        ? [previousState.lastInlineReviewId]
        : previousState?.state?.lastInlineReviewId != null
          ? [previousState.state.lastInlineReviewId]
          : []

  return {
    stateCommentId: previousState?.stateCommentId ?? null,
    reviewCommentId: previousState?.reviewCommentId ?? null,
    lastReviewedSha: previousState?.lastReviewedSha ?? null,
    reviewCount: previousState?.reviewCount ?? 0,
    activeInlineReviewIds,
    lastInlineReviewId: activeInlineReviewIds[activeInlineReviewIds.length - 1] ?? null,
  }
}

function normalizeActiveInlineReviewIds(previousState) {
  const summary = summarizePreviousState(previousState)
  return Array.from(
    new Set(
      (summary.activeInlineReviewIds || []).filter(
        (reviewId) => Number.isInteger(reviewId) && reviewId > 0,
      ),
    ),
  )
}

function buildInlineReviewTrackingState(activeInlineReviewIds) {
  return {
    activeInlineReviewIds,
    lastInlineReviewId: activeInlineReviewIds[activeInlineReviewIds.length - 1] ?? null,
  }
}

/**
 * Persist review state as a hidden comment on the PR.
 * Creates a new comment or updates the existing one.
 */
async function persistState({ github, owner, repo, prNumber, state, stateCommentId }) {
  const b64 = Buffer.from(JSON.stringify(state)).toString('base64')
  const openCount = (state.open_issues || []).length
  const body = [
    `<details>`,
    `<summary>Codex Review State (do not edit)</summary>\n`,
    `- Last reviewed: \`${(state.last_reviewed_head_sha || '').slice(0, 8) || 'none'}\``,
    `- Reviews completed: ${state.review_count || 0}`,
    `- Open issues: ${openCount}`,
    `\n</details>`,
    `<!-- ${MARKERS.state}`,
    b64,
    `-->`,
  ].join('\n')

  if (stateCommentId) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: stateCommentId,
      body,
    })
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    })
  }
}

// ─── Stale Comment Management ─────────────────────────────────────────────────

/**
 * Mark a previous review comment as stale.
 * Wraps the original body in a collapsed <details> with a "Superseded" banner.
 */
async function markCommentStale({ github, owner, repo, commentId, newReviewNumber }) {
  const comment = await github.rest.issues.getComment({
    owner,
    repo,
    comment_id: commentId,
  })
  const body = comment.data.body || ''
  if (body.includes(`<!-- ${MARKERS.stale} -->`)) return // Already stale

  const staleBody = [
    `<!-- ${MARKERS.stale} -->`,
    `> **Superseded** — See ${formatReviewLabel(newReviewNumber)} below for the latest review.\n`,
    `<details><summary>Previous review (collapsed)</summary>\n`,
    body,
    `\n</details>`,
  ].join('\n')

  await github.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body: staleBody,
  })
}

// ─── Review Posting ───────────────────────────────────────────────────────────

async function postReviewComment({ github, owner, repo, prNumber, body }) {
  const markedBody = `<!-- ${MARKERS.review} -->\n${body}`
  const comment = await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: markedBody,
  })
  return comment.data.id
}

// ─── Inline Review Comments ───────────────────────────────────────────────────

/**
 * Post inline review comments on the PR diff.
 * Always uses COMMENT event (never REQUEST_CHANGES) to avoid stale blocking reviews.
 * Returns the review ID, or null if posting failed (non-fatal).
 */
async function postInlineReview({
  github,
  owner,
  repo,
  prNumber,
  headSha,
  body,
  comments,
  issueSeverityById,
}) {
  try {
    const { data } = await github.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      body,
      event: 'COMMENT',
      comments: comments.map((c) => ({
        path: c.file,
        line: c.line,
        ...(c.start_line != null ? { start_line: c.start_line, start_side: 'RIGHT' } : {}),
        side: 'RIGHT',
        body: formatInlineBody(c, issueSeverityById?.get(c.issue_id)),
      })),
    })
    return { reviewId: data.id }
  } catch (e) {
    // 422 = invalid anchors, network errors, etc.
    // Non-fatal — summary comment is already posted
    console.log(`[codex-review] Inline review failed (non-fatal): ${e.message}`)
    return null
  }
}

/**
 * After posting an inline review, fetch the individual comment IDs
 * and map them back to issue IDs using file+line matching.
 * Returns { issueId: commentId } mapping for future reply-on-resolve.
 */
async function fetchInlineCommentMap({ github, owner, repo, prNumber, reviewId, inlineComments }) {
  const commentMap = {}
  try {
    const { data: reviewComments } = await github.rest.pulls.listCommentsForReview({
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      per_page: 100,
    })

    // Match review comments back to inline comments by order.
    // We create the review with comments in the same order as inlineComments,
    // and the API returns them in creation order, so positional matching works.
    // Also filter to only comments from this review to avoid cross-contamination.
    const thisReviewComments = reviewComments.filter((rc) => rc.pull_request_review_id === reviewId)
    for (let i = 0; i < Math.min(thisReviewComments.length, inlineComments.length); i++) {
      const rc = thisReviewComments[i]
      const ic = inlineComments[i]
      if (rc.path === ic.file && ic.issue_id) {
        commentMap[ic.issue_id] = rc.id
      }
    }
    console.log(
      `[codex-review] Comment map: ${JSON.stringify(commentMap)} (from ${reviewComments.length} review comments)`,
    )
  } catch (e) {
    console.log(`[codex-review] Failed to fetch inline comment IDs (non-fatal): ${e.message}`)
  }
  return commentMap
}

/**
 * Reply to inline comments for resolved issues with a "Resolved" message.
 * Uses pulls.createReplyForReviewComment to thread the reply.
 */
async function replyToResolvedComments({
  github,
  owner,
  repo,
  prNumber,
  resolvedIssues,
  inlineCommentMap,
  headSha,
}) {
  const log = (msg) => console.log(`[codex-review] ${msg}`)
  let repliedCount = 0
  const commentIdsToResolve = []

  for (const resolved of resolvedIssues) {
    const commentId = inlineCommentMap[resolved.id]
    if (!commentId) continue

    try {
      const shortSha = headSha?.slice(0, 8) || 'latest'
      const resolution = resolved.resolution || 'Fixed'
      await github.rest.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        comment_id: commentId,
        body: `> **Resolved** in \`${shortSha}\`\n>\n> ${resolution}`,
      })
      commentIdsToResolve.push(commentId)
      repliedCount++
    } catch (e) {
      log(`Failed to reply to resolved comment ${commentId}: ${e.message}`)
    }
  }

  if (repliedCount > 0) {
    log(`Replied to ${repliedCount} resolved inline comment(s)`)
  }

  // Auto-resolve the threads via GraphQL
  if (commentIdsToResolve.length > 0) {
    await resolveCommentThreads({ github, owner, repo, prNumber, commentIdsToResolve, log })
  }
}

/**
 * Resolve review comment threads using the GraphQL resolveReviewThread mutation.
 * Finds threads by matching comment IDs, then resolves them.
 */
async function resolveCommentThreads({ github, owner, repo, prNumber, commentIdsToResolve, log }) {
  try {
    // Query all review threads to find the ones containing our comments
    const { repository } = await github.graphql(
      `
      query($owner: String!, $repo: String!, $pr: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pr) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                comments(first: 1) {
                  nodes {
                    databaseId
                  }
                }
              }
            }
          }
        }
      }
    `,
      { owner, repo, pr: prNumber },
    )

    const threads = repository.pullRequest.reviewThreads.nodes
    const commentIdSet = new Set(commentIdsToResolve)
    let resolvedCount = 0

    for (const thread of threads) {
      if (thread.isResolved) continue

      const firstCommentId = thread.comments.nodes[0]?.databaseId
      if (!firstCommentId || !commentIdSet.has(firstCommentId)) continue

      try {
        await github.graphql(
          `
          mutation($threadId: ID!) {
            resolveReviewThread(input: { threadId: $threadId }) {
              thread { isResolved }
            }
          }
        `,
          { threadId: thread.id },
        )
        resolvedCount++
      } catch (e) {
        log(`Failed to resolve thread ${thread.id}: ${e.message} ${JSON.stringify(e.errors || [])}`)
      }
    }

    if (resolvedCount > 0) {
      log(`Auto-resolved ${resolvedCount} review thread(s)`)
    }
  } catch (e) {
    log(`Failed to query/resolve threads (non-fatal): ${e.message}`)
  }
}

/**
 * Dismiss a previous inline review (best-effort).
 */
async function dismissInlineReview({ github, owner, repo, prNumber, reviewId, message }) {
  try {
    await github.rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      message,
    })
    return true
  } catch {
    // Best-effort — COMMENT reviews may not be dismissible
    return false
  }
}

/**
 * Format an inline comment body with title, explanation, and optional suggestion.
 */
function formatInlineBody(comment, severity) {
  const severityBadge = formatSeverityBadge(severity)
  const title = severityBadge ? `${severityBadge} ${comment.title}` : comment.title

  let body = `**${title}**\n\n`
  if (comment.body) body += `${comment.body}\n\n`
  if (comment.category) body += `*Category: ${comment.category}*\n\n`
  if (comment.suggestion) {
    body += '```suggestion\n' + comment.suggestion + '\n```\n'
  }
  return body
}

// ─── Check Run ────────────────────────────────────────────────────────────────

async function updateCheckRun({ github, owner, repo, checkId, conclusion, title, summary }) {
  await github.rest.checks.update({
    owner,
    repo,
    check_run_id: checkId,
    status: 'completed',
    conclusion,
    completed_at: new Date().toISOString(),
    output: { title, summary: summary.slice(0, 65535) },
  })
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Build the review prompt by interpolating variables into the template.
 * Template uses ${VAR_NAME} placeholders.
 */
function buildPrompt(vars) {
  const templatePath = path.join(__dirname, 'prompt.md')
  let template = fs.readFileSync(templatePath, 'utf8')

  for (const [key, value] of Object.entries(vars)) {
    // Use split+join for global replace (safe with special regex chars in values)
    template = template.split(`\${${key}}`).join(String(value ?? ''))
  }

  return template
}

/**
 * Load repository review guidelines (AGENTS.md, REVIEW_GUIDELINES.md).
 * Returns concatenated content or a placeholder message.
 */
function loadGuidelines(repoRoot) {
  const files = ['AGENTS.md', 'REVIEW_GUIDELINES.md']
  const sections = []

  for (const file of files) {
    const filePath = path.join(repoRoot, file)
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        if (content.trim()) {
          sections.push(`### ${file}\n\n${content.trim()}`)
        }
      }
    } catch {
      /* skip missing files */
    }
  }

  return sections.length > 0
    ? sections.join('\n\n---\n\n')
    : '_No repo guidelines found. Add AGENTS.md or REVIEW_GUIDELINES.md to your repo root for project-specific review rules._'
}

// ─── Output Parsing ───────────────────────────────────────────────────────────

/**
 * Parse the structured JSON output from Codex.
 *
 * Codex writes a JSON file via `--output-schema` + `-o` containing:
 *   { review_markdown: string, inline_comments: array, state: object }
 */
function parseOutput(outputDir) {
  const outputPath = path.join(outputDir, 'codex-review-output.json')

  if (!fs.existsSync(outputPath)) {
    console.log(`[codex-review] Output file not found: ${outputPath}`)
    return { reviewBody: null, reviewState: null, inlineComments: [] }
  }

  try {
    const raw = fs.readFileSync(outputPath, 'utf8')
    const output = JSON.parse(raw)

    const reviewBody = output.review_markdown?.trim() || null
    const reviewState = output.state || null
    const inlineComments = Array.isArray(output.inline_comments)
      ? output.inline_comments.filter((c) => c.file && typeof c.line === 'number' && c.body)
      : []

    console.log(
      `[codex-review] Parsed output: body=${!!reviewBody} (${reviewBody?.length || 0} chars), state=${!!reviewState}, issues=${reviewState?.open_issues?.length || 0}, inline=${inlineComments.length}`,
    )

    return { reviewBody, reviewState, inlineComments }
  } catch (e) {
    console.log(`[codex-review] Failed to parse output JSON: ${e.message}`)
    return { reviewBody: null, reviewState: null, inlineComments: [] }
  }
}

function extractVerdict(body) {
  if (!body) return 'ERROR'
  const match = body.match(/Verdict:\s*(BLOCK|ATTENTION|OK)/i)
  return match ? match[1].toUpperCase() : 'UNKNOWN'
}

// ─── Command Parser ───────────────────────────────────────────────────────────

/**
 * Parse /codex-review command options from a comment body.
 * Supports: full, reset, --since <sha>, --since=<sha>
 */
function parseCommand(commentBody) {
  const result = { forceFullReview: false, resetState: false, sinceSha: '' }
  if (!commentBody) return result

  const tokens = commentBody.trim().split(/\s+/).slice(1) // Skip "/codex-review"
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (['full', '--full', 'all', '--all'].includes(token)) {
      result.forceFullReview = true
    } else if (['reset', '--reset'].includes(token)) {
      result.resetState = true
    } else if (token === '--since' && /^[0-9a-f]{7,40}$/i.test(tokens[i + 1] || '')) {
      result.sinceSha = tokens[++i]
    } else {
      const match = token.match(/^--since=([0-9a-f]{7,40})$/i)
      if (match) result.sinceSha = match[1]
    }
  }

  return result
}

// ─── Post-Processing Orchestrator ─────────────────────────────────────────────

/**
 * Orchestrate all post-review actions with error isolation.
 * Each step is independent — failures don't cascade.
 *
 * Order: post comment → persist state → mark stale → update check
 * This prioritizes user-visible output over internal bookkeeping.
 */
async function postResults({
  github,
  owner,
  repo,
  prNumber,
  headSha,
  checkId,
  previousState,
  outputDir,
}) {
  const log = (msg) => console.log(`[codex-review] ${msg}`)
  const { reviewBody, reviewState, inlineComments } = parseOutput(outputDir)
  const reviewNumber = (previousState?.reviewCount || 0) + 1

  if (!reviewBody) {
    log('No review output generated')
    if (checkId) {
      await updateCheckRun({
        github,
        owner,
        repo,
        checkId,
        conclusion: 'failure',
        title: 'Review Failed',
        summary: 'Codex did not generate a review. Check the workflow logs for details.',
      })
    }
    return { verdict: 'ERROR', commentId: null }
  }

  const verdict = extractVerdict(reviewBody)
  let activeInlineReviewIds = normalizeActiveInlineReviewIds(previousState)

  // Step 1: Post new summary comment (most important — do first)
  let newCommentId = null
  try {
    newCommentId = await postReviewComment({
      github,
      owner,
      repo,
      prNumber,
      body: reviewBody,
    })
    log(`Posted ${formatReviewLabel(reviewNumber)} (comment ${newCommentId})`)
  } catch (e) {
    log(`Failed to post comment: ${e.message}`)
  }

  // Step 2: Reconcile inline review lifecycle (best-effort, after summary)
  if (activeInlineReviewIds.length > 0) {
    const remainingInlineReviewIds = []
    try {
      for (const reviewId of activeInlineReviewIds) {
        const dismissed = await dismissInlineReview({
          github,
          owner,
          repo,
          prNumber,
          reviewId,
          message: `Superseded by ${formatReviewLabel(reviewNumber)}`,
        })

        if (dismissed) {
          log(`Dismissed previous inline review ${reviewId}`)
        } else {
          remainingInlineReviewIds.push(reviewId)
          log(`Could not dismiss previous inline review ${reviewId}; keeping it active`)
        }
      }
    } catch (e) {
      log(`Inline review dismissal failed (non-fatal): ${e.message}`)
    }
    activeInlineReviewIds = remainingInlineReviewIds
  }

  // Step 2b: Reply "Resolved" to inline comments for resolved issues
  const prevCommentMap = previousState?.state?.inlineCommentMap || {}
  const resolvedIssues = reviewState?.recently_resolved_issues || []
  log(
    `Resolve check: map=${JSON.stringify(prevCommentMap)}, resolved=${JSON.stringify(resolvedIssues.map((r) => r.id))}`,
  )
  if (resolvedIssues.length > 0 && Object.keys(prevCommentMap).length > 0) {
    try {
      await replyToResolvedComments({
        github,
        owner,
        repo,
        prNumber,
        resolvedIssues,
        inlineCommentMap: prevCommentMap,
        headSha,
      })
    } catch (e) {
      log(`Reply to resolved comments failed (non-fatal): ${e.message}`)
    }
  }

  // Step 2c: Post new inline comments
  let newInlineCommentMap = {}
  if (inlineComments.length > 0) {
    if (!headSha) {
      log('Skipping inline review post: missing head SHA')
    } else {
      try {
        const issueSeverityById = buildIssueSeverityMap(reviewState)
        const result = await postInlineReview({
          github,
          owner,
          repo,
          prNumber,
          headSha,
          body: `See ${formatReviewLabel(reviewNumber)} above for the full summary.`,
          comments: inlineComments,
          issueSeverityById,
        })

        if (result) {
          activeInlineReviewIds = [...activeInlineReviewIds, result.reviewId]
          log(`Posted ${inlineComments.length} inline comment(s) (review ${result.reviewId})`)

          // Fetch individual comment IDs for future reply-on-resolve
          newInlineCommentMap = await fetchInlineCommentMap({
            github,
            owner,
            repo,
            prNumber,
            reviewId: result.reviewId,
            inlineComments,
          })
          log(`Mapped ${Object.keys(newInlineCommentMap).length} inline comment(s) to issue IDs`)
        }
      } catch (e) {
        log(`Inline review failed (non-fatal): ${e.message}`)
      }
    }
  }

  // Step 3: Persist state (important for continuity)
  if (reviewState) {
    reviewState.review_count = reviewNumber

    try {
      await persistState({
        github,
        owner,
        repo,
        prNumber,
        state: {
          ...reviewState,
          ...buildInlineReviewTrackingState(activeInlineReviewIds),
          inlineCommentMap:
            Object.keys(newInlineCommentMap).length > 0
              ? { ...prevCommentMap, ...newInlineCommentMap }
              : prevCommentMap,
        },
        stateCommentId: previousState?.stateCommentId,
      })
      log('State persisted')
    } catch (e) {
      log(`Failed to persist state: ${e.message}`)
    }
  }

  // Step 4: Mark previous review as stale (cosmetic)
  if (previousState?.reviewCommentId && newCommentId) {
    try {
      await markCommentStale({
        github,
        owner,
        repo,
        commentId: previousState.reviewCommentId,
        newReviewNumber: reviewNumber,
      })
      log('Previous review marked stale')
    } catch (e) {
      log(`Failed to mark stale: ${e.message}`)
    }
  }

  // Step 5: Update check run (least critical)
  if (checkId) {
    try {
      await updateCheckRun({
        github,
        owner,
        repo,
        checkId,
        conclusion: verdict === 'BLOCK' ? 'failure' : 'success',
        title: `${formatReviewLabel(reviewNumber)}: ${verdict}`,
        summary: `Verdict: **${verdict}**`,
      })
      log(`Check updated: ${verdict}`)
    } catch (e) {
      log(`Failed to update check: ${e.message}`)
    }
  }

  return { verdict, commentId: newCommentId }
}

module.exports = {
  loadPreviousState,
  persistState,
  markCommentStale,
  postReviewComment,
  updateCheckRun,
  buildPrompt,
  loadGuidelines,
  parseOutput,
  extractVerdict,
  parseCommand,
  postResults,
  summarizePreviousState,
  normalizeActiveInlineReviewIds,
  buildInlineReviewTrackingState,
  formatReviewLabel,
  formatSeverityBadge,
  formatInlineBody,
  buildIssueSeverityMap,
  MARKERS,
}
