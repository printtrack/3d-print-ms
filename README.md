# 3D Print MS

An open-source management system for 3D printing teams. Customers submit print orders through a public form or a self-service portal. The team manages everything through an admin dashboard with Kanban boards, project management, print job scheduling, and a knowledge base.

---

## Features

### Customer-facing
- **Order form** — submit a print job with description, material preferences, and file uploads (images + STL/3MF/OBJ)
- **Order tracking** — follow the status of your order via a private tracking link (`/track/[token]`)
- **Satisfaction survey** — after completion, customers can rate the experience
- **Customer portal** (`/portal`) — registered customers can log in, submit orders, view order history, and track credits

### Admin dashboard (`/admin`)
- **Kanban board** — drag & drop orders between phases, with filtering and search
- **Order detail page** — edit all fields inline, manage phase, assignee, comments, parts, and file uploads
- **3D model viewer** — preview STL/3MF/OBJ files directly in the browser (Three.js)
- **Gantt chart** — visualize order timelines with drag-to-reschedule
- **Audit log** — every action on an order is recorded (phase changes, comments, uploads, etc.)
- **Verification workflow** — send a "Freigabe" email to customers for approval

### Project management (`/admin/projects`)
- **Project Kanban board** — organize projects across phases with drag & drop
- **Project detail** — link orders to projects, manage milestones and tasks
- **Project Gantt chart** — visualize project timelines
- **Project phases** — separate phase workflow for projects

### Print job scheduling (`/admin/jobs`)
- **Timeline view** — visual Gantt-style schedule for print jobs across machines
- **Queue board** — Kanban-style job queue per machine
- **Auto-transitions** — jobs automatically move to "in progress" and "done" based on time
- **G-code parsing** — automatically extract print time from uploaded G-code/3MF files
- **Part tracking** — link parts from orders to print jobs with STL/OrcaSlicer file downloads

### Planning (`/admin/planning`)
- **Calendar view** — monthly/weekly planning overview
- **Resource view** — see machine utilization and availability

### Machine management (`/admin/machines`) — admins only
- Create, edit, and delete 3D printer machines
- Track machine availability and job assignments

### Inventory (`/admin/inventory`) — admins only
- Track filament and material stock
- Log filament usage per print job

### Customer management (`/admin/customers`) — admins only
- Customer database with contact details
- Credit system — assign and track customer credits

### Part & phase management
- **Order phases** (`/admin/phases`) — create, rename, reorder, and delete workflow phases
- **Part phases** — separate phase workflow for individual parts within orders
- **Project phases** — dedicated phases for project management

### Team management (`/admin/team`) — admins only
- Invite team members with name, email, password, and role (ADMIN / USER)
- Edit and remove members

### Knowledge base (`/admin/knowledge`)
- Create problem/solution entries with tags and file attachments
- Link entries to each other using `[[Entry Title]]` wiki-style syntax
- Tag-based filtering and full-text search

### Settings (`/admin/settings`) — admins only
- Company name and contact email
- Customizable email templates for all outgoing emails
- Branding (accent color, hero background via CSS variables)

### Authentication
- Credentials-based login (Auth.js v5) for admin and customer portal
- Password reset via email token
- Role-based access control (ADMIN / USER)

### Legal pages

This project does **not** include Impressum or Datenschutz (privacy policy) pages. If you deploy this application, you are responsible for providing your own legal pages as required by your jurisdiction (e.g. DSGVO/GDPR in Germany).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Database | MariaDB + Prisma ORM v5 |
| Auth | Auth.js v5 (Credentials + JWT) |
| Styling | TailwindCSS v4 + shadcn/ui |
| Drag & Drop | @dnd-kit |
| 3D Viewer | Three.js + React Three Fiber |
| Email | Nodemailer |
| File Storage | Local filesystem or Docker volume |
| Tests | Playwright (E2E) |

---

## Quick Start (Docker)

The easiest way to run the app is with Docker Compose. See **[INSTALL.md](INSTALL.md)** for the full setup guide including Raspberry Pi instructions.

```bash
git clone https://github.com/printtrack/3d-print-ms.git
cd 3d-print-ms
cp .env.docker.example .env
# Edit .env and set AUTH_SECRET to a random 32+ character string
docker compose up --build
# First run only — seed the admin user:
docker compose exec app node prisma/seed.js
```

Open [http://localhost:3000](http://localhost:3000).

Default admin login: `admin@3dprinting.local` / `admin123`

---

## Local Development

### Requirements
- Node.js 20+
- MariaDB (running on port 3306)

### 1. Clone and install

```bash
git clone https://github.com/printtrack/3d-print-ms.git
cd 3d-print-ms
npm install
```

### 2. Environment variables

Create two files:

**.env** (read by Prisma CLI):
```env
DATABASE_URL="mysql://root@localhost:3306/3dprint_ms"
```

**.env.local** (read by Next.js):
```env
DATABASE_URL="mysql://root@localhost:3306/3dprint_ms"
AUTH_SECRET="your-random-32-char-secret"
AUTH_URL="http://localhost:3000"
UPLOAD_DIR="public/uploads"
```

### 3. Database

```bash
mysql -u root -e "CREATE DATABASE 3dprint_ms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

```bash
npm run dev                              # Start dev server
npm run build                           # Production build
npm run lint                            # Run ESLint

npx prisma migrate dev --name <name>    # Create and apply a migration
npm run db:seed                         # Seed admin user + default phases
npm run db:studio                       # Open Prisma Studio

npm run test:e2e                        # Run all Playwright E2E tests
npm run test:e2e:ui                     # Open Playwright UI runner
```

---

## Project Structure

```
app/
  page.tsx                    # Landing page with order form
  portal/                     # Customer self-service portal
  survey/[token]/             # Post-completion satisfaction survey
  track/[token]/              # Public order tracking
  admin/
    page.tsx                  # Kanban dashboard
    orders/[id]/              # Order detail
    projects/                 # Project management
    jobs/                     # Print job scheduling
    planning/                 # Calendar & resource planning
    machines/                 # Machine management
    inventory/                # Filament & material inventory
    customers/                # Customer management
    phases/                   # Order phase management
    knowledge/                # Knowledge base
    team/                     # Team management
    settings/                 # Settings & branding
  api/                        # API route handlers
  content.ts                  # All German marketing copy (edit here)

components/
  admin/
    KanbanBoard.tsx           # DnD Kanban board
    OrderDetail.tsx           # Order detail with inline editing
    ProjectsView.tsx          # Project Kanban + Gantt views
    JobsView.tsx              # Print job timeline + queue views
    PlanningView.tsx          # Calendar & resource planning
    CustomerManager.tsx       # Customer CRUD
    InventoryManager.tsx      # Inventory management
    KnowledgeManager.tsx      # Knowledge base with wiki-link autocomplete
    PhaseManager.tsx          # Phase CRUD with DnD sorting
    MachineManager.tsx        # Machine CRUD
    TeamManager.tsx           # Team CRUD
    files/                    # File management components (upload, versioning, parts)
    gantt/                    # Gantt chart components
  customer/
    OrderForm.tsx             # Public order submission form
    TrackingView.tsx          # Order tracking page
  portal/                     # Customer portal components
  ModelViewer.tsx             # In-browser STL/3MF/OBJ viewer (Three.js)

lib/
  auth.ts                     # Auth.js v5 configuration (admin)
  customer-auth.ts            # Customer portal authentication
  email.ts                    # Nodemailer email helpers
  settings.ts                 # getSetting() with in-process cache
  gantt-utils.ts              # Gantt chart calculations
  gcode-parser.ts             # G-code print time extraction
  stl-parser.ts               # STL file parsing
  uploads.ts                  # File upload handling

prisma/
  schema.prisma               # Full data model
  seed.ts                     # Admin user + default phases

tests/                        # Playwright E2E tests
proxy.ts                      # Route protection for /admin (Next.js 16)
```

---

## Architecture Notes

- **Auth:** JWT-based sessions. The `role` and `id` fields are attached in the `jwt` callback and available via `session.user`. Route protection lives in `proxy.ts`.
- **Dates:** All `Date` objects from Prisma are serialized to strings (`.toISOString()`) before being passed as props to Client Components.
- **Settings:** Key/value pairs in the `Setting` model, read via `getSetting(key)`. Cache is invalidated on write.
- **File uploads:** Two-step — first create the order, then POST files with the returned `orderId`. Files are stored in the configured `UPLOAD_DIR`.
- **3D Model Viewer:** Always imported with `dynamic(..., { ssr: false })`. Uses imperative Three.js (`scene.add()`) instead of R3F JSX to avoid React 19 compatibility issues.
- **Kanban:** Optimistic updates in `KanbanBoard.tsx`, confirmed by PATCH to `/api/admin/orders/[id]`.
- **Wiki links:** `[[Entry Title]]` syntax in knowledge base entries. Autocomplete dropdown in the editor, rendered as clickable chips in the output.
- **Auto-transitions:** Print jobs automatically transition between states based on scheduled times. Polling every 60 seconds.

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
