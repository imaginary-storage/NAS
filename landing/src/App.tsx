import {
  HardDrive,
  Users2,
  Share2,
  CloudSnow,
  Trash2,
  KeyRound,
  Cpu,
  Zap,
  Lock,
  Layers,
  type LucideIcon,
} from 'lucide-react'

/* Lucide v1 dropped brand icons; inlining the GitHub mark to keep the
 * marketing site's brand-link consistent. */
function Github({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.21c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.55 2.34 1.1 2.91.84.09-.66.35-1.1.63-1.36-2.22-.26-4.55-1.13-4.55-5.04 0-1.11.39-2.02 1.03-2.74-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.04.8-.23 1.65-.34 2.5-.34s1.7.11 2.5.34c1.91-1.31 2.75-1.04 2.75-1.04.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.74 0 3.92-2.34 4.78-4.57 5.03.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.21 10.21 0 0 0 22 12.21C22 6.58 17.52 2 12 2z"
      />
    </svg>
  )
}

const REPO_URL = 'https://github.com/imaginary-storage/imaginary-storage-nas'

interface Feature {
  icon: LucideIcon
  title: string
  body: string
}

const features: Feature[] = [
  {
    icon: HardDrive,
    title: 'Browse like a desktop',
    body: 'Grid + list views, full keyboard nav, type-to-search, breadcrumb path bar, drag-and-drop upload, copy / cut / paste, trash with restore — the whole file-manager vocabulary, in the browser.',
  },
  {
    icon: Users2,
    title: 'Real OS users, real PAM',
    body: 'Logins go through PAM. Each request runs in a fork that setuids to the authenticated user, so the kernel — not the app — enforces who can read what.',
  },
  {
    icon: Share2,
    title: 'POSIX-ACL file sharing',
    body: 'Share a file or folder with another user, read-only or read/write, with an expiry. Recipients get the same dashboard, scoped to the shared tree. Revocable, sweeper-driven expiry, kernel-enforced.',
  },
  {
    icon: CloudSnow,
    title: 'Glacier-class cold backup',
    body: 'Per-user S3 sync with DEEP_ARCHIVE storage class. Configure a folder, hit save, and a background scheduler fires off `aws s3 sync` on an interval. Cents-per-TB-month durability with no extra app to run.',
  },
  {
    icon: Layers,
    title: 'Multi-session login',
    body: 'Sign in as several users at once and switch between them in a click. Useful for an admin who also needs a regular account, or a household with separate trees.',
  },
  {
    icon: Trash2,
    title: 'Trash + resumable uploads',
    body: 'Deletes go to a per-user trash you can restore from. Big uploads run as resumable chunked transfers — kill the tab, come back, the upload picks up where it stopped.',
  },
]

interface UseCase {
  title: string
  body: string
}

const useCases: UseCase[] = [
  {
    title: 'A NAS for the household',
    body: 'Plug a couple of disks into a Linux box, create accounts, mount and format from the dashboard, and you have shared storage with per-user permissions, dark mode, and a real file browser.',
  },
  {
    title: 'A team file server you understand',
    body: 'No mystery layers — auth is PAM, permissions are POSIX, the C server is a few thousand lines you can audit. Drop it on a small VPS and grant your team access.',
  },
  {
    title: 'Cold archive for the photo-and-video pile',
    body: 'Everything you "might want one day" lives on cheap disks; the AWS-sync feature ships it to Glacier on a schedule. The active dashboard stays fast.',
  },
  {
    title: 'A sharing primitive without the SaaS',
    body: 'Need to hand a contractor read-only access to a folder for a week? Right-click, share, set 7 days, done. The kernel enforces the boundary, not a third-party app.',
  },
]

const stats: [string, string][] = [
  ['~5k LOC', 'pure C backend, vendored cJSON + sha256'],
  ['Zero warnings', 'enforced on every commit'],
  ['React 19', 'TypeScript + Tailwind v4'],
  ['POSIX ACLs', 'kernel-enforced access control'],
]

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="glow-bg pointer-events-none absolute inset-0 -z-10" />

      <Header />

      <main>
        <Hero />
        <StatsRow />
        <FeaturesSection />
        <ArchitectureSection />
        <UseCasesSection />
        <QuickstartSection />
        <CtaFooter />
      </main>

      <Footer />
    </div>
  )
}

function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-[0_4px_18px_-4px_rgba(99,102,241,0.7)] ${className}`}
      aria-hidden
    >
      <HardDrive className="h-[55%] w-[55%] text-white" />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/60 border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">
            Imaginary <span className="text-white/60">Storage</span>
          </span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a className="hover:text-white transition-colors" href="#features">Features</a>
          <a className="hover:text-white transition-colors" href="#architecture">Architecture</a>
          <a className="hover:text-white transition-colors" href="#use-cases">Use cases</a>
          <a className="hover:text-white transition-colors" href="#quickstart">Quickstart</a>
        </nav>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:border-white/20 hover:bg-white/10 transition-all"
        >
          <Github className="h-4 w-4" /> GitHub
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          self-hosted · open source · MIT-ish
        </span>

        <h1 className="mt-6 text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight">
          Your filesystem,{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
            in the browser.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-[17px] leading-relaxed text-white/70">
          A small, self-hosted NAS dashboard built on a hand-rolled C HTTP server
          and a modern React UI. PAM logins, kernel-enforced permissions,
          POSIX-ACL sharing, and a Glacier sync for the cold tail of your data.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_rgba(99,102,241,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(168,85,247,0.7)]"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
          <a
            href="#quickstart"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 hover:border-white/30 hover:bg-white/10 transition-all"
          >
            Quickstart →
          </a>
        </div>
      </div>

      <BrowserMockup />
    </section>
  )
}

function BrowserMockup() {
  return (
    <div className="relative mx-auto mt-20 max-w-5xl">
      <div className="absolute -inset-x-12 -inset-y-8 -z-10 animated-border opacity-30 blur-3xl rounded-[3rem]" />
      <div className="card-edge rounded-2xl border border-white/10 bg-slate-900/70 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          <div className="ml-3 hidden flex-1 sm:block">
            <div className="mx-auto max-w-md rounded-md border border-white/5 bg-white/5 px-3 py-1 text-center text-[11px] text-white/40">
              nas.local · /home / docs / projects
            </div>
          </div>
        </div>
        <div className="grid grid-cols-12 min-h-[360px]">
          {/* Sidebar */}
          <aside className="col-span-4 sm:col-span-3 border-r border-white/5 p-3 text-xs">
            <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Places</div>
            <SidebarRow icon="🏠" label="Home" />
            <SidebarRow icon="🗂️" label="Documents" />
            <SidebarRow icon="🖼️" label="Pictures" active />
            <SidebarRow icon="🗑️" label="Trash" />
            <SidebarRow icon="🤝" label="Shared with me" />
            <div className="mt-4 mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Sessions</div>
            <SidebarRow icon="🟢" label="alice" />
            <SidebarRow icon="🔴" label="root" />
          </aside>
          {/* Main grid */}
          <section className="col-span-8 sm:col-span-9 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span>Pictures</span>
                <span>›</span>
                <span className="text-white">trip-2026</span>
              </div>
              <div className="hidden items-center gap-2 text-[11px] text-white/50 sm:flex">
                <span className="rounded border border-white/10 px-1.5 py-0.5">Grid</span>
                <span>List</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <FileTile color="from-indigo-400 to-purple-500"  name="2026-spring/" type="dir" />
              <FileTile color="from-emerald-400 to-cyan-500"   name="raw/"          type="dir" />
              <FileTile color="from-rose-400 to-pink-500"      name="IMG_9213.jpg" />
              <FileTile color="from-amber-400 to-orange-500"   name="IMG_9214.jpg" />
              <FileTile color="from-sky-400 to-blue-500"       name="IMG_9215.jpg" />
              <FileTile color="from-fuchsia-400 to-purple-500" name="IMG_9216.jpg" />
              <FileTile color="from-lime-400 to-emerald-500"   name="IMG_9217.jpg" />
              <FileTile color="from-indigo-400 to-violet-500"  name="trip-notes.md" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SidebarRow({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
        active ? 'bg-indigo-500/15 text-indigo-200' : 'text-white/70 hover:bg-white/5'
      }`}
    >
      <span className="text-[13px]">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function FileTile({ color, name, type = 'file' }: { color: string; name: string; type?: 'file' | 'dir' }) {
  return (
    <div className="group flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-2 hover:border-white/15 hover:bg-white/[0.05] transition-colors">
      <div
        className={`grid h-12 w-12 place-items-center rounded-md bg-gradient-to-br ${color} text-white shadow-md`}
      >
        {type === 'dir' ? '📁' : '📄'}
      </div>
      <span className="truncate w-full text-center text-[10px] text-white/70">{name}</span>
    </div>
  )
}

function StatsRow() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:grid-cols-4">
        {stats.map(([num, label]) => (
          <div key={num} className="bg-slate-950/40 px-5 py-7 text-center">
            <div className="text-2xl font-bold tracking-tight">{num}</div>
            <div className="mt-1 text-xs text-white/55">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <SectionHeader
        kicker="Features"
        title={<>A real file manager, <span className="bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">not a folder lister.</span></>}
        sub="Everything you actually use day-to-day, plus the multi-user primitives a household or small team needs."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, body }: Feature) {
  return (
    <article className="card-edge group flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition-all hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-slate-900/60">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 ring-1 ring-inset ring-white/10">
        <Icon className="h-5 w-5 text-indigo-300" />
      </div>
      <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="text-[14px] leading-relaxed text-white/65">{body}</p>
    </article>
  )
}

function ArchitectureSection() {
  return (
    <section id="architecture" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <SectionHeader
        kicker="Architecture"
        title={<>Two halves, both <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">simple to read.</span></>}
        sub="No mystery middleware. The whole stack is two repositories' worth of code you can build and audit on a laptop."
      />

      <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ArchCard
          icon={Cpu}
          color="from-indigo-500 to-purple-500"
          title="A small C HTTP server"
          points={[
            'Hand-rolled `chttp` framework — request/route/response in plain C.',
            'Per-request fork + setuid drops privileges before any handler runs.',
            'PAM authenticates; sessions live as 0700 root-owned files.',
            'Resumable uploads, streaming download, HEAD, JSON, multipart — built-in.',
          ]}
        />
        <ArchCard
          icon={Zap}
          color="from-cyan-500 to-blue-500"
          title="A modern React dashboard"
          points={[
            'React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui.',
            'Redux Toolkit for filesystem, sessions, settings, shares state.',
            'Same browser component drives Home, Trash, and Shared-with-me.',
            'Dark mode default, glassy aesthetic, full keyboard nav.',
          ]}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SmallArchCard
          icon={Lock}
          title="Kernel-enforced permissions"
          body="ACL-based file sharing means the kernel checks reads and writes — not the app. App bugs can't grant access the kernel says no to."
        />
        <SmallArchCard
          icon={KeyRound}
          title="No secrets stored in code"
          body="PAM owns passwords. AWS keys live in per-user config files mode 0600. The server has no shared password file."
        />
        <SmallArchCard
          icon={CloudSnow}
          title="Cold-tail offload"
          body="A scheduler thread fires `aws s3 sync` per-user on an interval. Glacier DEEP_ARCHIVE for the long tail; the dashboard stays warm."
        />
      </div>
    </section>
  )
}

interface ArchCardProps {
  icon: LucideIcon
  color: string
  title: string
  points: string[]
}

function ArchCard({ icon: Icon, color, title, points }: ArchCardProps) {
  return (
    <article className="card-edge rounded-2xl border border-white/10 bg-slate-900/40 p-7">
      <div className={`mb-4 inline-grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${color} text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-white/70">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/40" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function SmallArchCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 text-white/80">
        <Icon className="h-4 w-4 text-indigo-300" />
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/60">{body}</p>
    </div>
  )
}

function UseCasesSection() {
  return (
    <section id="use-cases" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <SectionHeader
        kicker="Use cases"
        title={<>Built for <span className="bg-gradient-to-r from-fuchsia-300 to-amber-300 bg-clip-text text-transparent">people who run their own boxes.</span></>}
        sub="Specific shapes the project was designed around — yours probably looks different, and that's fine."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {useCases.map((u, i) => (
          <article
            key={u.title}
            className="card-edge rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition-all hover:border-white/20"
          >
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-[12px] font-bold text-white/60">
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3 className="text-[17px] font-semibold tracking-tight">{u.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-white/65">{u.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function QuickstartSection() {
  return (
    <section id="quickstart" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <SectionHeader
        kicker="Quickstart"
        title={<>From zero to running, <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">in three commands.</span></>}
        sub="Linux box, gcc, libpam, libacl. Runs as root because PAM and setuid require it."
      />

      <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <CommandCard
          step="01"
          title="Clone"
          command="git clone https://github.com/imaginary-storage/imaginary-storage-nas"
          comment="A few thousand lines of C and a React app."
        />
        <CommandCard
          step="02"
          title="Build"
          command={`make\n(cd frontend && npm i && npm run build)`}
          comment="Zero warnings. Frontend builds straight into www/."
        />
        <CommandCard
          step="03"
          title="Run"
          command="./run server"
          comment="Starts on :8080. Log in with any PAM user."
        />
      </div>

      <p className="mt-8 text-center text-sm text-white/55">
        Behind a TLS proxy in production —{' '}
        <a className="text-indigo-300 underline-offset-2 hover:underline" href={`${REPO_URL}/blob/main/journal/plans/require-https.md`} target="_blank" rel="noreferrer">
          there's a plan for that
        </a>
        .
      </p>
    </section>
  )
}

function CommandCard({ step, title, command, comment }: { step: string; title: string; command: string; comment: string }) {
  return (
    <div className="card-edge rounded-2xl border border-white/10 bg-slate-900/50 p-6">
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-semibold tracking-wider text-white/60">
          {step}
        </span>
        <h4 className="text-[15px] font-semibold tracking-tight">{title}</h4>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-[12.5px] leading-relaxed text-emerald-300">
        <code>{command}</code>
      </pre>
      <p className="mt-3 text-[12.5px] text-white/50">{comment}</p>
    </div>
  )
}

function CtaFooter() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="card-edge relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-cyan-500/10 p-8 sm:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <h3 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Run your own filesystem.
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            Self-hosted, simple to read, and the only auth boundary is the one your kernel already enforces. Star it, fork it, ship it on your box.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white/90 transition-colors"
            >
              <Github className="h-4 w-4" />
              Open on GitHub
            </a>
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              File an issue →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-white/50 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo className="h-5 w-5" />
          <span>Imaginary Storage</span>
        </div>
        <div className="flex items-center gap-5">
          <a className="hover:text-white" href={REPO_URL} target="_blank" rel="noreferrer">Source</a>
          <a className="hover:text-white" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">Issues</a>
          <a className="hover:text-white" href={`${REPO_URL}/blob/main/CLAUDE.md`} target="_blank" rel="noreferrer">Docs</a>
        </div>
        <span className="text-white/35">Built in C and React.</span>
      </div>
    </footer>
  )
}

interface SectionHeaderProps {
  kicker: string
  title: React.ReactNode
  sub: string
}

function SectionHeader({ kicker, title, sub }: SectionHeaderProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
        {kicker}
      </span>
      <h2 className="mt-3 text-[clamp(1.875rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-white/65">{sub}</p>
    </div>
  )
}
