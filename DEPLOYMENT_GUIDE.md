# Sean AI Knowledge Layer - GitHub Deployment Guide

Your Next.js application is ready for GitHub deployment! Follow these steps to get your project live.

## 🚀 Quick Start

### Step 1: Initialize Git & Push to GitHub

```bash
# Navigate to your project directory
cd sean-webapp

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Sean AI Knowledge Layer"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/sean-webapp.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

### Step 2: Set Up GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:

| Secret Name | Example Value | Description |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite database path |
| `SESSION_SECRET` | `your-random-32-char-secret` | Session encryption key |
| `NEXT_PUBLIC_API_URL` | `https://sean.example.com` | Your production domain |
| `DEPLOY_KEY` | (SSH private key) | For server deployment |
| `DEPLOY_HOST` | `your-server.com` | Your server hostname |
| `DEPLOY_USER` | `deploy` | SSH username |
| `DEPLOY_PATH` | `/app/sean-webapp` | App directory on server |

### Step 3: Choose Deployment Platform

#### 🎯 **Option A: Zeabur** (Recommended, Easy & Modern)

[Zeabur](https://zeabur.com) is a modern cloud platform that automatically detects and deploys Next.js applications with zero configuration.

**Quick Deployment Steps:**

1. **Push to GitHub** (if not already done):
   ```bash
   git push -u origin main
   ```

2. **Sign up at [zeabur.com](https://zeabur.com)** and authorize GitHub access

3. **Create a new project:**
   - Click "Create Project"
   - Select your preferred deployment region
   - Click "Deploy Service" → "Deploy from GitHub"
   - Select the `sean-webapp` repository

4. **Configure Environment Variables:**
   
   Zeabur will auto-detect Next.js. Add these environment variables in the Zeabur dashboard:
   
   | Variable | Value | Description |
   |----------|-------|-------------|
   | `DATABASE_URL` | `file:./prisma/dev.db` | SQLite for testing, or use Zeabur's PostgreSQL service |
   | `SESSION_SECRET` | (generate random 32+ chars) | Session encryption key |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.zeabur.app` | Your Zeabur domain |

5. **Optional: Add PostgreSQL Database**
   
   For production, use PostgreSQL instead of SQLite:
   - In Zeabur dashboard, click "Add Service" → "PostgreSQL"
   - Zeabur auto-generates `DATABASE_URL` environment variable
   - Update `prisma/schema.prisma` datasource provider to `"postgresql"`
   - Redeploy the app

6. **Deploy:**
   - Zeabur automatically builds and deploys
   - Your app will be live at `https://your-app.zeabur.app`
   - You can add a custom domain in settings

**Zeabur Features:**
- ✅ Automatic HTTPS/SSL
- ✅ Auto-deployment on git push
- ✅ Built-in PostgreSQL, Redis, MySQL services
- ✅ Zero-downtime deployments
- ✅ Easy rollback to previous versions
- ✅ Free tier available
- ✅ Optimized for Next.js (auto-detects config)

**Configuration Files:**
- `zbpack.json` - Custom build/start commands (already included)
- `.env.example` - Environment variable template

**📘 Detailed Zeabur Guide:** See [ZEABUR_DEPLOY.md](./ZEABUR_DEPLOY.md) for complete step-by-step instructions, troubleshooting, and advanced configuration options.

---

#### 🌐 **Option B: Vercel** (Alternative, Free Tier Available)

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Import Project"
4. Select your `sean-webapp` repository
5. Add environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET` 
   - `NEXT_PUBLIC_API_URL`
6. Click "Deploy" — Done!

**Vercel handles scaling and SSL automatically.**

#### 🏠 **Option C: Self-Hosted VPS** (Ubuntu/Debian)

1. **Rent a VPS** from Linode, DigitalOcean, or Hetzner
2. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

3. **Set up the server:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2 (process manager)
   sudo npm install -g pm2
   
   # Create app directory
   sudo mkdir -p /app/sean-webapp
   sudo chown $USER:$USER /app/sean-webapp
   ```

4. **Configure SSH Keys for GitHub:**
   ```bash
   ssh-keygen -t ed25519 -C "deploy@your-server"
   cat ~/.ssh/id_ed25519.pub  # Copy this key
   ```

5. **Add SSH key to GitHub:**
   - Go to GitHub account settings → SSH and GPG keys
   - Add the public key

6. **Clone repository on server:**
   ```bash
   cd /app/sean-webapp
   git clone git@github.com:YOUR_USERNAME/sean-webapp.git .
   ```

7. **Set up environment:**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

8. **Install and build:**
   ```bash
   npm install
   npm run build
   ```

9. **Start with PM2:**
   ```bash
   pm2 start npm --name "sean" -- start
   pm2 startup
   pm2 save
   ```

10. **Configure Nginx reverse proxy** (optional but recommended):
    ```bash
    sudo apt install -y nginx
    sudo nano /etc/nginx/sites-available/sean-webapp
    ```

    Add this configuration:
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

    Enable it:
    ```bash
    sudo ln -s /etc/nginx/sites-available/sean-webapp /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

11. **Set up SSL with Let's Encrypt:**
    ```bash
    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

12. **Auto-deploy on GitHub push:**
    - Create SSH deploy key on your server
    - Add it to GitHub Deploy Keys (Settings → Deploy Keys)
    - GitHub Actions will auto-deploy via the workflow in `.github/workflows/deploy.yml`

#### 🐳 **Option D: Docker Deployment** (Scalable)

1. **Create Dockerfile** (already included in project)
2. **Deploy to:**
   - Docker Hub
   - AWS ECR
   - Google Cloud Run
   - Render.com (easy Docker hosting)

## 📦 Project Structure

```
sean-webapp/
├── .github/workflows/deploy.yml    # GitHub Actions CI/CD
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── dev.db                       # SQLite database
├── app/                             # Next.js app
│   ├── api/                         # API routes
│   ├── chat/                        # Chat interface
│   ├── knowledge/                   # Knowledge management
│   └── login/                       # Authentication
├── lib/
│   ├── auth.ts                      # Session management
│   ├── kb.ts                        # Knowledge base logic
│   └── db.ts                        # Database client
└── package.json                     # Dependencies
```

## 🔧 Commands

```bash
# Development
npm run dev          # Start dev server (http://localhost:3000)

# Production
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint

# Database
npx prisma migrate dev    # Create migration
npx prisma db push        # Sync schema to database
npx prisma studio        # Open database UI
```

## 🔐 Security Checklist

- [ ] `.env` file is in `.gitignore` (not committed)
- [ ] `SESSION_SECRET` is 32+ random characters
- [ ] All environment variables are set on production
- [ ] HTTPS/SSL is enabled on your domain
- [ ] Database backups are configured
- [ ] User allowlist is updated in `lib/auth.ts` or environment
- [ ] GitHub branch protection is enabled (`main` branch)
- [ ] Secrets are not logged or exposed in output

## 🚨 Troubleshooting

**"DATABASE_URL not set"**
- Check GitHub Secrets are properly named
- Ensure `.env.local` exists locally with `DATABASE_URL`

**"Session validation fails"**
- Verify `SESSION_SECRET` matches between local and production
- Check database connection from production server

**"Port already in use"**
- Change port: `next dev -p 3001`
- Or kill existing process: `lsof -i :3000` then `kill -9 <PID>`

**"Build fails on GitHub Actions"**
- Check build logs in Actions tab
- Verify all environment secrets are set
- Try local build: `npm run build`

## 📚 Useful Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma Production Checklist](https://www.prisma.io/docs/guides/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/)

## 💬 Support

Your project is configured with:
- ✅ TypeScript for type safety
- ✅ ESLint for code quality
- ✅ Tailwind CSS for styling
- ✅ Prisma for database management
- ✅ GitHub Actions for CI/CD
- ✅ Session-based authentication
- ✅ SQLite database (ready for PostgreSQL migration)

Start with **Option A (Vercel)** if you want the easiest setup, or **Option B (VPS)** for more control.

Good luck! 🚀
