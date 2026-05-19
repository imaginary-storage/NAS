import { useState } from 'react'
import { HardDrive, Check, Copy } from 'lucide-react'

const REPO_URL = 'https://github.com/imaginary-storage/NAS'
const INSTALL_CMD = 'curl -fsSL nas.imaginarystorage.com/install.sh | sudo bash'

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

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="glow-bg pointer-events-none absolute inset-0 -z-10" />

      <Header />

      <main>
        <Hero />
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
    <section id="top" className="relative mx-auto max-w-3xl px-6 pt-24 pb-32 sm:pt-32 text-center">
      <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight">
        Your filesystem,{' '}
        <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
          in the browser.
        </span>
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-balance text-[16px] leading-relaxed text-white/65">
        A self-hosted NAS dashboard. One command to install.
      </p>

      <CopyableCommand command={INSTALL_CMD} />

      <p className="mt-5 text-[13px] text-white/50">
        Linux <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12.5px] text-white/80">x86_64</code>{' '}
        / <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12.5px] text-white/80">aarch64</code>{' '}
        · glibc 2.35+ · needs{' '}
        <code className="rounded bg-white/5 px-1.5 py-0.5 text-[12.5px] text-white/80">sudo</code>.{' '}
        Tarballs on{' '}
        <a
          className="text-indigo-300 underline-offset-2 hover:underline"
          href={`${REPO_URL}/releases/latest`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub Releases
        </a>
        .
      </p>
    </section>
  )
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — text is still selectable manually */
    }
  }

  return (
    <div className="mt-8 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 py-1.5 pl-3 pr-1.5 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      <pre className="overflow-x-auto py-1.5 text-[13px] leading-relaxed text-emerald-300 select-all">
        <code>
          <span className="text-white/40 select-none mr-2">$</span>
          {command}
        </code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
          copied
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
            : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/[0.08]'
        }`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
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
          <a className="hover:text-white" href={`${REPO_URL}/blob/main/INSTALL.md`} target="_blank" rel="noreferrer">Docs</a>
        </div>
        <span className="text-white/35">Built in C and React.</span>
      </div>
    </footer>
  )
}
