# Atlas Infinite Experience Lab

An interactive, guided demo that compares **MongoDB Atlas Core Gen1** (three-node replica set) with **MongoDB Atlas Infinite** (disaggregated compute/storage). It runs in **Simulation Mode** (no credentials needed) or **Live Atlas Mode** (real clusters through the Atlas Admin API).

Built with Next.js 16, TypeScript, the MongoDB Node.js driver and the LeafyGreen palette.

[Continue working on v0 →](https://v0.app/chat/projects/prj_U35R9ndcWI85gYH2Vl7angdPCOPo)

---

## Run it on your MacBook

### Quick start (one command)

```bash
git clone https://github.com/bobbertonno/atlas-infinite.git
cd atlas-infinite
./scripts/launch-mac.sh
```

The script checks your tools, sets up the environment, builds the app, starts it, and opens **http://localhost:3000** in your browser. Press `Ctrl+C` to stop it.

### Launcher options

| Command | What it does |
| --- | --- |
| `./scripts/launch-mac.sh` | Builds an optimized production bundle and runs it locally |
| `./scripts/launch-mac.sh --dev` | Runs the development server with hot reload (for editing code) |
| `./scripts/launch-mac.sh --vercel` | Builds locally, then deploys to Vercel production |
| `PORT=4000 ./scripts/launch-mac.sh` | Uses another port (default `3000`) |

You can also use `pnpm launch`, `pnpm launch:dev`, and `pnpm launch:vercel`.

---

## Step-by-step guide

Use these steps if you prefer to set things up yourself, or if the script stops with an error.

### 1. Install the prerequisites

1. **Xcode Command Line Tools** (they include `git`):
   ```bash
   xcode-select --install
   ```
2. **Homebrew** (macOS package manager) from [brew.sh](https://brew.sh):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. **Node.js 20 or newer**:
   ```bash
   brew install node
   node -v   # should print v20.x or higher
   ```
4. **pnpm** (the project's package manager):
   ```bash
   corepack enable    # or: npm install -g pnpm
   pnpm -v
   ```

### 2. Get the code

```bash
git clone https://github.com/bobbertonno/atlas-infinite.git
cd atlas-infinite
```

### 3. Create your local environment file

The app encrypts Atlas credentials (AES-256-GCM) in a session cookie with `ATLAS_LAB_SECRET`. Generate one:

```bash
echo "ATLAS_LAB_SECRET=$(openssl rand -base64 32)" > .env.local
chmod 600 .env.local
```

`.env.local` is git-ignored, so it is never committed. Without this variable the app still runs, but saved Atlas credentials are lost every time the server restarts.

### 4. Install dependencies

```bash
pnpm install
```

### 5. Build and start

```bash
pnpm build
pnpm start          # production server on http://localhost:3000
```

For development with hot reload, run `pnpm dev` instead.

### 6. Use the app

1. Open http://localhost:3000.
2. Click **New demo** to open the Configuration Wizard.
3. Choose **Simulation Mode** to try everything with no credentials, or **Live Atlas Mode** to work with real clusters (see the next section).
4. Go through the wizard steps (clusters, dataset, loading, workload, guided stages), review, and launch the guided demo.

Your demo configurations are saved in the browser's local storage. You can export and import them from the home page library.

---

## Live Atlas Mode setup

1. In [MongoDB Atlas](https://cloud.mongodb.com), open your project, then go to **Project Settings, Access Manager, Applications, Service Accounts** (or API Keys) and create credentials with the **Project Owner** role. Project Owner is needed to create and scale clusters.
2. Copy the **Client ID**, **Client Secret** and **Project ID**.
3. **Network access:** in Atlas, open **Network Access** and add your Mac's public IP to the IP Access List. To find your IP, run `curl -s https://checkip.amazonaws.com`. Add the same IP to the Atlas Admin API access list if your organization requires one.
4. In the wizard's **Atlas Connection** step, enter the credentials and run **Test Atlas API Connection**.

Credentials are sent only to your local server. They never reach client-side JavaScript, logs, or exported profiles.

> Live mode creates real clusters that cost money. Delete the demo clusters in Atlas when you finish.

---

## Deploy to Vercel from your Mac

```bash
./scripts/launch-mac.sh --vercel
```

The script installs the Vercel CLI if needed, logs you in, links the project the first time, copies `ATLAS_LAB_SECRET` to the Vercel production environment, and runs `vercel deploy --prod`.

When you run Live Atlas Mode on Vercel, Atlas has to accept connections from Vercel's dynamic IPs. Options include a broader Atlas IP access list, Vercel Static IPs, or Secure Compute together with Atlas private networking.

Pushes to `main` also deploy automatically through the linked v0/Vercel project.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `permission denied: ./scripts/launch-mac.sh` | `chmod +x scripts/launch-mac.sh` |
| `Port 3000 is already in use` | `PORT=4000 ./scripts/launch-mac.sh`, or find the other process with `lsof -i :3000` |
| `Node.js ... is too old` | `brew upgrade node` |
| pnpm version error from Corepack | `npm install -g pnpm` and run the script again |
| Credentials ask again after a restart | Make sure `.env.local` contains `ATLAS_LAB_SECRET` |
| Atlas connection times out | Add your current public IP to the Atlas Network Access list |
| Build fails after `git pull` | `rm -rf node_modules .next && pnpm install && pnpm build` |
