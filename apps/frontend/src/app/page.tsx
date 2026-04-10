import Link from "next/link";

const agents = [
  {
    icon: "⚖️",
    color: "#7B2FBE",
    glow: "rgba(123,47,190,0.25)",
    label: "Legal Agent",
    sublabel: "Legal review",
    desc: "UG vs. GmbH recommendation, Handelsregister checklist, and a real Gesellschaftsvertrag draft — generated in seconds.",
  },
  {
    icon: "💶",
    color: "#00C9A7",
    glow: "rgba(0,201,167,0.25)",
    label: "Finance Agent",
    sublabel: "Financial planning",
    desc: "18-month EUR runway model, German salary benchmarks with +20% employer costs, EXIST and KfW eligibility check.",
  },
  {
    icon: "👥",
    color: "#10B981",
    glow: "rgba(16,185,129,0.25)",
    label: "Hiring Agent",
    sublabel: "Team design",
    desc: "Org structure, Werkstudent model, first-hire recommendations, and Scheinselbstständigkeit risk assessment.",
  },
  {
    icon: "⚙️",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.25)",
    label: "Ops Agent",
    sublabel: "Operations & tools",
    desc: "DSGVO compliance checklist, German-first tool stack (DATEV, Qonto, Lexoffice), and E-Rechnungs readiness.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen text-white" style={{ background: "#03060d" }}>

      {/* ── HERO — full-screen video section ─────────────────── */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Video background */}
        <video
          src="/hero-background.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          preload="auto"
          style={{ objectPosition: "center 60%" }}
        />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.62) 45%, rgba(0,0,0,0.85) 100%)",
          }}
        />

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-6 py-6 md:px-10">
          <div className="flex items-center gap-3">
            {/* Animated logo particle */}
            <img
              src="/logo-particle.png"
              alt="Startup OS"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                objectFit: "cover",
                animation: "logo-float 5s ease-in-out infinite",
              }}
            />
            <span className="text-xl font-semibold tracking-tight">
              Startup <span className="font-serif-italic font-normal">OS</span>
            </span>
          </div>

          <Link
            href="/start"
            className="rounded-full px-5 py-2 text-sm font-semibold transition hover:scale-[1.02]"
            style={{
              background: "rgba(255,255,255,0.95)",
              color: "rgba(10,10,10,0.95)",
            }}
          >
            Get started
          </Link>
        </nav>

        {/* Hero content */}
        <div className="relative z-20 mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl flex-col items-center justify-center px-6 pb-20 text-center">
          {/* Tag pill */}
          <div
            className="mb-8 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              className="rounded-md px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.95)", color: "rgba(12,12,12,0.95)" }}
            >
              New
            </span>
            <span className="text-sm" style={{ color: "rgba(238,242,255,0.72)" }}>
              Introducing Agent Engine v1.0
            </span>
          </div>

          {/* H1 */}
          <h1
            className="leading-[1.06]"
            style={{
              fontSize: "clamp(2.8rem, 7vw, 5.8rem)",
              letterSpacing: "-0.02em",
              color: "rgba(248,251,255,0.97)",
              textShadow: "0 10px 30px rgba(0,0,0,0.5)",
              fontWeight: 650,
            }}
          >
            Your company,
            <br />
            founded in{" "}
            <span className="font-serif-italic" style={{ fontWeight: 400 }}>
              30 seconds.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mt-5 max-w-2xl text-base font-medium md:text-[1.35rem]"
            style={{ color: "rgba(226,236,255,0.86)", lineHeight: 1.45 }}
          >
            Four AI agents handle legal, finance, hiring, and ops.
            <br />
            Built for startup formation in Germany, from incorporation to operating setup.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/start"
              className="rounded-full px-9 py-3.5 text-base font-semibold transition hover:scale-[1.03]"
              style={{
                border: "1px solid rgba(235,245,255,0.35)",
                background: "rgba(255,255,255,0.95)",
                boxShadow: "0 8px 30px rgba(10,18,40,0.45)",
                color: "rgba(8,8,8,0.94)",
              }}
            >
              Start free
            </Link>
            <Link
              href="/start?persona=sarah-thomas&autostart=1"
              className="rounded-full px-7 py-3.5 text-sm font-medium transition hover:scale-[1.02]"
              style={{
                color: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(168,157,255,0.35)",
                background: "rgba(108,99,255,0.16)",
              }}
            >
              Run investor demo
            </Link>
            <a
              href="#agents"
              className="rounded-full px-7 py-3.5 text-sm font-medium transition"
              style={{
                color: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              See the demo →
            </a>
          </div>
        </div>
      </section>

      {/* ── AGENTS section ───────────────────────────────────── */}
      <section
        id="agents"
        className="aurora-page mx-auto max-w-6xl px-6 py-24"
        style={{ position: "relative" }}
      >
        <div className="aurora-orb" />

        <p className="section-title mb-3 text-center">The four agents</p>
        <h2
          className="mb-4 text-center font-semibold"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.02em", color: "rgba(248,251,255,0.97)" }}
        >
          All of them work in parallel{" "}
          <span className="font-serif-italic" style={{ fontWeight: 400 }}>
            for you.
          </span>
        </h2>
        <p className="mb-12 text-center text-base" style={{ color: "rgba(220,229,243,0.65)" }}>
          No law firm. No tax advisor. Just results.
        </p>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {agents.map((a) => (
            <div
              key={a.label}
              className="liquid-glass glass-border-soft rounded-[24px] p-5"
              style={{ boxShadow: `0 0 40px ${a.glow}` }}
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{ background: `${a.color}22`, border: `1px solid ${a.color}44` }}
              >
                {a.icon}
              </div>
              <p className="font-semibold" style={{ color: "rgba(248,251,255,0.95)" }}>
                {a.label}
              </p>
              <p className="mt-0.5 text-xs tracking-wide" style={{ color: a.color }}>
                {a.sublabel}
              </p>
              <p className="mt-3 text-sm leading-6" style={{ color: "rgba(220,229,243,0.65)" }}>
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <p className="section-title mb-3 text-center">How it works</p>
        <h2
          className="mb-12 text-center font-semibold"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.02em", color: "rgba(248,251,255,0.97)" }}
        >
          Three steps. Thirty seconds.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { n: "01", label: "Answer 3 questions", desc: "Company name, capital, and goal — in 60 seconds." },
            { n: "02", label: "4 agents run in parallel", desc: "Legal, finance, hiring, and ops — simultaneously, in real time." },
            { n: "03", label: "Get the result instantly", desc: "Entity recommendation, financial plan, hiring plan, DSGVO checklist, and Gesellschaftsvertrag." },
          ].map((s) => (
            <div
              key={s.n}
              className="liquid-glass glass-border-soft rounded-[24px] p-6"
              style={{ background: "rgba(8,11,19,0.52)" }}
            >
              <p
                className="numeric text-4xl font-bold"
                style={{ color: "rgba(108,99,255,0.45)" }}
              >
                {s.n}
              </p>
              <p className="mt-3 font-semibold" style={{ color: "rgba(248,251,255,0.95)" }}>
                {s.label}
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: "rgba(220,229,243,0.65)" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GERMANY CONTEXT ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div
          className="liquid-glass rounded-[30px] p-8 md:p-10"
          style={{ background: "rgba(8,11,19,0.52)", border: "1px solid rgba(0,201,167,0.2)" }}
        >
          <p className="section-title mb-3">🇩🇪 Germany-first</p>
          <h2
            className="font-semibold"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", letterSpacing: "-0.02em", color: "rgba(248,251,255,0.97)" }}
          >
            Built for the German market.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7" style={{ color: "rgba(220,229,243,0.65)" }}>
            UG vs. GmbH under §5a GmbHG. Gewerbesteuer by Bundesland. Werkstudent contracts.
            EXIST grants. KfW StartGeld. DSGVO compliance. Impressum. Datenschutzerklärung. All included.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              { label: "Entity types", value: "UG · GmbH" },
              { label: "Federal states", value: "All 16" },
              { label: "Funding", value: "EXIST · KfW · EIC" },
              { label: "Document", value: "Gesellschaftsvertrag" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="section-title mb-1">{item.label}</p>
                <p className="text-sm font-semibold" style={{ color: "rgba(248,251,255,0.9)" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-4 text-center">
        <h2
          className="font-semibold"
          style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", letterSpacing: "-0.02em", color: "rgba(248,251,255,0.97)" }}
        >
          Start your company{" "}
          <span className="font-serif-italic" style={{ fontWeight: 400, color: "#a89dff" }}>
            in 30 seconds.
          </span>
        </h2>
        <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          No account. No credit card. Just your idea.
        </p>
        <Link
          href="/start"
          className="mt-8 inline-flex rounded-full px-9 py-4 text-sm font-semibold transition hover:scale-[1.03]"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "rgba(8,8,8,0.94)",
            boxShadow: "0 8px 30px rgba(10,18,40,0.45)",
          }}
        >
          Start free →
        </Link>
      </section>

      {/* Footer */}
      <footer
        className="border-t px-6 py-6 text-center text-xs"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
      >
        Startup OS · Hackathon Edition · Germany 🇩🇪 · Template — not legally binding without a notary
      </footer>

      {/* Logo float animation */}
      <style>{`
        @keyframes logo-float {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          33% { transform: translateY(-2px) rotate(1.5deg) scale(1.02); }
          66% { transform: translateY(1px) rotate(-1.5deg) scale(0.99); }
        }
      `}</style>
    </div>
  );
}
