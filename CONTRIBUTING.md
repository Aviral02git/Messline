# Contributing

Comment `claim` on an open issue that has no assignee. That assigns it to you. You can hold up to 5 open issues at once. Comment `unclaim` to give one back. Open the PR within 72 hours and start its description with `Closes #<issue number>`, for example `Closes #7`. GitHub then closes the issue when the PR is merged. Writing only `#7` or `Issue: #7` links the issue but leaves it open. If no PR of yours mentions the issue by then, the bot unassigns you.

If there is no issue with your name on it, don't start. Small fixes for a typo or a broken seed are fine as a PR without an issue.

Issues labelled `good first issue` are a good place to start if you are new here. Comment `claim` on the issue before you begin. If the issue already has an assignee, leave it and pick another one.

Please star the repo.

## Setup

You need Node 20, npm, and Docker. Then follow [Run](README.md#run) in the README.

## Branch

`feat/short-name`, `fix/short-name`, or `chore/short-name`.

Branch off `main`. One issue per PR.

## Before you open the PR

```bash
npm run lint
npm run typecheck
npm run build
```

If the database changed, run `npm run db:migrate` and commit the new folder under `prisma/migrations`. Don't edit a migration that is already on `main`.

Say how you tested it in the PR. If you touched a screen, add a screenshot.

## Leave these alone unless the issue says so

- `prisma/schema.prisma`
- `docs/rules.md`
- the docker port (`5434`) and the app port (`3001`)

Don't add a library for something the stack already covers. zod is already here for request bodies. Prisma is the database. If you think you need something else, ask in the issue first.

Don't commit `.env`. Copy `.env.example`.

Don't reformat files you didn't change.

## AI

You can use AI tools on this project.

## Winter of Code Social

Messline is a Winter of Code Social 2026 project. Register at https://woc.codesocial.tech, or your merged PRs won't earn points.

When you open a PR that closes an issue, the bot copies that issue's labels, including `wocs` and its level, onto the PR. I or a mentor can change the level before merging. The level is our call, and it is final once the PR is merged.

- `level 1`: small, beginner-friendly change. 2 points.
- `level 2`: more implementation or understanding. 5 points.
- `level 3`: complex or substantial change. 11 points.

Ask questions in the Messline forum under `#find-a-project` on the [Code Social Discord](https://discord.gg/MSTNyRSPYW), or on the issue. Not in DMs.
