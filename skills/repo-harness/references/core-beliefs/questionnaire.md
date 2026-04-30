# Core Beliefs Questionnaire

Use these questions when the project's non-negotiable beliefs are still implicit.

Do not ask all of them by default.

Pick the smallest set needed to remove ambiguity.

## Tradeoffs

1. What tradeoff does this project choose on purpose, even if a reasonable team might choose differently?
2. What kind of "working" solution would still be unacceptable here?
3. What is more important in this project: speed, safety, correctness, local simplicity, long-term legibility, cost control, or something else?

## Architecture

4. What must always stay true about the architecture, layering, or module boundaries?
5. Where should complexity live in this codebase, and where should it not live?
6. Are there any patterns that have already caused enough pain that they should be treated as anti-patterns?

## Data and behavior

7. What is worse in this project: missing data, stale data, wrong data, or slow data?
8. Are there any invariants about state transitions, validation, or error handling that must always hold?

## Local development and operations

9. What must be true about local development for this project to be considered healthy?
10. Are there any external dependencies, runtime assumptions, or workflow constraints that should never become mandatory by accident?

## Safety and autonomy

11. What must an agent never be allowed to assume, mutate, or expose?
12. Where should an agent have freedom, and where should it be constrained hard?

## Review and quality

13. If a reviewer rejects a change for being "wrong in spirit", what are they usually protecting?
14. Which recurring review comments should eventually become docs, tests, or lints?
