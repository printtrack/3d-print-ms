# Installation Guide (Docker)

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose plugin (v2)

## Setup

### 1. Configure environment

```bash
cp .env.docker.example .env
```

Edit `.env` and set a secure `AUTH_SECRET` (random 32+ character string):

```
AUTH_SECRET=change-me-to-a-random-32-char-string
```

### 2. Build and start

```bash
docker compose up --build
```

Migrations run automatically on startup. Wait until you see the Next.js ready message.

### 3. Seed the admin user (first run only)

```bash
docker compose exec app node prisma/seed.js
```

### 4. Open the app

Visit [http://localhost:3000](http://localhost:3000).

Admin login: `admin@3dprinting.local` / `admin123`

---

## Raspberry Pi Setup

### Install Docker on Raspberry Pi OS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for the group change to take effect
```

### Set AUTH_URL to your Pi's IP

Auth.js requires `AUTH_URL` to match the URL users access the app from. Find your Pi's local IP:

```bash
hostname -I
```

Then set it in `.env`:

```
AUTH_URL=http://192.168.1.42:3000
```

Replace `192.168.1.42` with your Pi's actual IP address.

### Build the image on the Pi (recommended)

Building directly on the Pi produces a native ARM64 image without cross-compilation overhead:

```bash
docker compose up --build
```

### Cross-compile from a Mac (alternative)

If you prefer to build on your Mac and push to the Pi, use `--platform`:

```bash
docker buildx build --platform linux/arm64 -t 3dprinting-cms:latest .
```

Then transfer the image to the Pi (`docker save` / `docker load`) or push to a registry.

---

## Useful commands

```bash
# Start in background
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v

# Check migration status
docker compose exec app npx prisma migrate status
```

## Notes

- Uploaded files are stored in the `uploads` Docker volume (`/app/public/uploads` inside the container).
- The MariaDB database is stored in the `dbdata` volume and is not exposed to the host.
- The admin user seed is not run automatically — only run it once after the first start.
