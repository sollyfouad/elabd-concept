---
description: Run the 4-agent pipeline (planner -> coder -> tester -> reviewer) on a feature request
argument-hint: <feature request>
---
Feature request: $ARGUMENTS

Run this pipeline in order. Each step is a subagent; wait for each to finish before starting the next. Only the files in `.pipeline/` carry context between them, so don't paste your own summaries into their prompts beyond what's listed.

0. Setup: make sure you're on a feature branch (create `feature/<short-slug>` from main if on main). Create `.pipeline/` if missing and clear any old files in it. Make sure `.pipeline/` is in `.gitignore`.
1. Use the **planner** subagent. Give it the feature request above. Confirm `.pipeline/specs.md` exists.
2. Use the **coder** subagent. Tell it to implement `.pipeline/specs.md`. Confirm `.pipeline/changes.md` exists.
3. Use the **tester** subagent. Confirm `.pipeline/test-results.md` exists.
4. Run `git diff main...HEAD > .pipeline/diff.patch` (commit the work on the feature branch first so the diff is complete, and include uncommitted changes if any).
5. Use the **reviewer** subagent. Save its full response verbatim to `.pipeline/verdict.md`.
6. If REJECTED: loop back to step 2 (the coder reads verdict.md), then 3, 4, 5. Max 2 retry loops. If still rejected, stop and show me the issues.
7. Never merge to main yourself. When APPROVED, show me: the verdict, test pass count, and the list of changed files, and tell me it's ready for me to merge.
