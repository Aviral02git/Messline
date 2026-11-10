# Messline

Students book mess food. A booking takes plates off the count. Cancel before the cutoff and the plates come back. Cancel after the cutoff and they stay taken, because the kitchen already cooked it.

I maintain this repo and open the issues. The behaviour that is already locked is in [docs/rules.md](docs/rules.md). Read that before writing a feature.

There is no real mess behind the data. The seed is the mess.

Live: https://messline.vercel.app. It runs `main` against the seed data.

## Why

A mess cooks before it knows who is coming. Plates run out for whoever is at the back of the line, and the rest gets thrown away when people skip. Messline makes students say in advance, so the kitchen cooks for a real count and the cutoff tells it when that count is final.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL 16 in Docker, zod.

## Project structure

- `app/` Next.js App Router pages, layouts, and routes
- `lib/` shared utilities, database client, and business logic
- `prisma/` schema, migrations and seed
- `docs/` rules and project documentation
- `.github/` CI workflows and issue/PR templates

## Where to start

Read [CONTRIBUTING.md](CONTRIBUTING.md), then [docs/rules.md](docs/rules.md). Pick an open issue with no assignee from [the issue list](https://github.com/sanjana2505006/Messline/issues).

Messline is a [Winter of Code Social 2026](https://woc.codesocial.tech) project.

## Run

You need Node 20 and Docker.

```bash
cp .env.example .env
npm install
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

App: http://localhost:3001

Postgres is on port **5434**.

The home page lists whatever the seed put in. It is not the product. When the menu issue starts, that page gets replaced.

## Logins

Passwords are hashed. Sign-in is not built, so these do nothing until that issue lands. Use these accounts when you build it. Don't add your own users to the seed.

| who | email | password |
| --- | --- | --- |
| student | meera@messline.dev | student123 |
| student | kabir@messline.dev | student123 |
| kitchen | kitchen@messline.dev | kitchen123 |
| secretary | secretary@messline.dev | secretary123 |

Today's breakfast has poha (30 plates, included in the plan) and boiled eggs (10 plates, ₹20). Today's lunch has veg thali (40 plates, included) and chicken biryani (2 plates, ₹90). Cutoff is two hours after you ran the seed. Yesterday's lunch is sambar, cutoff already passed, quantity 0. That row is there so a complaint has a dish to point at. Meera and Kabir have reviewed veg thali, biryani and sambar.

`npm run db:reset` wipes the database and seeds again. `npm run db:studio` opens Prisma Studio if you want to move a cutoff by hand.

`npm run race:booking` fires two bookings at the last biryani plates at the same time. Run `npm run db:reset` first, and it should print `PASS`.

`npm run cancel:booking` checks the cancel rules against the seed data, so run `npm run db:reset` first and every line should say `PASS`.

## CI

Pull requests run lint, `prisma validate`, and a production build. That check has to pass.
