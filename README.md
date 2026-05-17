# Bus Booking VN

Vietnamese bus-booking platform — Next.js 15 + TypeScript + Tailwind + Prisma + Postgres.

## Local Development Setup

### 1. Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop

### 2. Environment

```bash
cp .env.example .env.local
# Edit .env.local if you need custom DB credentials
```

### 3. Start Postgres (dev + shadow)

```bash
docker compose -f docker-compose.dev.yml up -d
```

Two Postgres 16 instances start:
- Port **5432** — `bbvn_dev` (main development DB)
- Port **5433** — `bbvn_shadow` (Prisma shadow DB for migrations)

### 4. Run Migrations + Seed

```bash
pnpm prisma migrate deploy
pnpm prisma db seed
```

### 5. Start Dev Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
