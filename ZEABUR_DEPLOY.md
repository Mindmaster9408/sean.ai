# Deploying Sean AI to Zeabur

This guide will help you deploy the Sean AI Knowledge Layer to [Zeabur](https://zeabur.com), a modern cloud platform with automatic Next.js detection and zero-config deployment.

## Prerequisites

- GitHub account with the `sean-webapp` repository
- Zeabur account (free tier available at [zeabur.com](https://zeabur.com))

## Quick Start (5 Minutes)

### 1. Push to GitHub

Ensure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Zeabur deployment"
git push origin main
```

### 2. Connect Zeabur to GitHub

1. Go to [zeabur.com](https://zeabur.com)
2. Sign up or log in
3. Click **"Authorize GitHub"** to grant Zeabur access to your repositories

### 3. Create a New Project

1. Click **"Create Project"** in the Zeabur dashboard
2. Choose a deployment region (select the closest to your users)
3. Click **"Deploy Service"**
4. Select **"Deploy from GitHub"**
5. Find and select your `sean-webapp` repository
6. Zeabur will automatically detect it's a Next.js app and start building

### 4. Configure Environment Variables

While the app is building, add these environment variables:

#### Required Variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `SESSION_SECRET` | (32+ random chars) | Encryption key for sessions. Generate with: `openssl rand -base64 32` |

#### Database Options:

**Option A: Use SQLite (Quick Test)**
```
DATABASE_URL=file:./prisma/dev.db
```

**Option B: Add PostgreSQL (Production Recommended)**
1. In Zeabur dashboard, click **"Add Service"** → **"PostgreSQL"**
2. Zeabur will automatically create and inject `DATABASE_URL`
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"  // Changed from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
4. Commit and push the change to trigger a rebuild

#### Optional Variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://your-app.zeabur.app` | Public URL of your app |

### 5. Wait for Deployment

Zeabur will:
- Install dependencies
- Run Prisma migrations
- Build the Next.js app
- Start the production server

This typically takes 2-5 minutes.

### 6. Access Your App

Once deployed, Zeabur provides:
- A default domain: `https://your-app.zeabur.app`
- Automatic HTTPS/SSL
- Option to add custom domains

## Advanced Configuration

### Custom Build & Start Commands

The `zbpack.json` file in the root directory contains custom commands:

```json
{
  "build_command": "npx prisma generate && npm run build",
  "start_command": "npx prisma migrate deploy && npm start"
}
```

These commands ensure:
- Prisma client is generated before build
- Database migrations run on each deployment
- Production server starts correctly

### Adding a Custom Domain

1. In Zeabur dashboard, go to your service
2. Click **"Domains"** tab
3. Click **"Add Domain"**
4. Enter your domain and follow DNS instructions
5. Zeabur automatically provisions SSL certificates

### Database Backups (PostgreSQL)

If using Zeabur's PostgreSQL:
1. Go to PostgreSQL service in Zeabur
2. Click **"Backups"** tab
3. Enable automatic backups or create manual backups

### Environment Variables Best Practices

- Use Zeabur's UI to manage environment variables (not `.env` files)
- Regenerate `SESSION_SECRET` for production (don't use development values)
- Set `NODE_ENV=production` (Zeabur does this automatically)

### Rollback to Previous Version

If a deployment breaks:
1. Go to your service in Zeabur dashboard
2. Click **"Deployments"** tab
3. Find a working deployment
4. Click **"Rollback"** to restore it

## Monitoring & Logs

### View Application Logs

1. Go to your service in Zeabur
2. Click **"Logs"** tab
3. Real-time logs show build output, runtime errors, and requests

### Check Build Status

- Green checkmark = successful deployment
- Red X = build failed (click to see error logs)

## Troubleshooting

### Build Fails with Prisma Error

**Problem:** `Prisma Client not generated`

**Solution:** The `zbpack.json` already includes `npx prisma generate` in the build command. If this persists:
1. Check that `@prisma/client` is in `dependencies` (not `devDependencies`)
2. Ensure `DATABASE_URL` is set correctly

### Database Connection Error

**Problem:** `Can't reach database server`

**Solution:**
- If using SQLite: Ensure `DATABASE_URL=file:./prisma/dev.db`
- If using PostgreSQL: Verify Zeabur's PostgreSQL service is running and `DATABASE_URL` is auto-injected

### Session Validation Fails

**Problem:** Users can't stay logged in

**Solution:**
- Ensure `SESSION_SECRET` is set in Zeabur environment variables
- Verify the secret is at least 32 characters
- Check that `SESSION_SECRET` hasn't changed between deployments

### Port Already in Use

**Problem:** `Port 3000 already in use`

**Solution:** Zeabur automatically assigns ports. If you customized the port in `next.config.ts`, remove it or set `PORT` environment variable.

## Updating Your App

Zeabur auto-deploys when you push to GitHub:

```bash
# Make your changes locally
git add .
git commit -m "Update feature X"
git push origin main

# Zeabur automatically detects the push and redeploys
```

You can also trigger manual deploys from the Zeabur dashboard.

## Cost & Scaling

- **Free Tier:** Suitable for development and low-traffic apps
- **Paid Plans:** Auto-scaling, more resources, team features
- Check [zeabur.com/pricing](https://zeabur.com/pricing) for current plans

## Comparison with Other Platforms

| Feature | Zeabur | Vercel | Self-Hosted VPS |
|---------|--------|--------|-----------------|
| Setup Time | 5 min | 5 min | 30-60 min |
| Auto-deploy | ✅ | ✅ | Requires setup |
| Built-in DB | ✅ PostgreSQL | ❌ Need external | ✅ Any DB |
| Free Tier | ✅ | ✅ | ❌ VPS costs |
| Scaling | Auto | Auto | Manual |
| Custom Domains | ✅ Free SSL | ✅ Free SSL | Manual SSL |

## Next Steps

- **Add PostgreSQL:** Click "Add Service" in Zeabur for production database
- **Custom Domain:** Configure your own domain in Zeabur settings
- **Team Access:** Invite collaborators in project settings
- **Monitoring:** Set up alerts for errors or downtime

## Support

- **Zeabur Docs:** [zeabur.com/docs](https://zeabur.com/docs)
- **GitHub Issues:** Report issues in the `sean-webapp` repository
- **Zeabur Discord:** Join the community for help

---

**Deployed successfully?** Your Sean AI instance should now be live and accessible to the three allowlisted emails!
