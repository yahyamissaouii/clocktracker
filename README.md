This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Copy `.env.local.example` to `.env.local` and fill in the Supabase and PostgreSQL values.
2. Apply the schema before starting the app:

```bash
npm run db:push
```

3. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

`ADMIN_EMAILS` defaults to `spampropropro@gmail.com`; set it to a comma-separated list for production. `SUPABASE_SERVICE_ROLE_KEY` is required for the admin employee-invite action because invitations must create real Supabase Auth users. Never expose that key to the browser.

Employees must enter a task title and notes/details when clocking in. They can finish tasks from the dashboard; recorded task minutes appear in weekly and monthly timesheets. Editing a task while it is being tracked creates an admin approval request. Admins can inspect session notes and task details per employee entry, review all approval types from `/admin/approvals`, and see live team hours and open tasks in `/admin/team`.

## Free deployment

The project is configured for Cloudflare Workers through OpenNext. The GitHub workflow in `.github/workflows/deploy-cloudflare.yml` deploys every push to `main` on Cloudflare's free Workers plan.

Add these GitHub Actions secrets before the first deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `DIRECT_URL`

The Cloudflare API token needs Workers deployment permission. GitHub Pages is not used because this app requires server-side authentication, admin actions, and database access.
