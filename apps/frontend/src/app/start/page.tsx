"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { analyzeStartup, fetchDemoPersonas } from "@/lib/api";
import { AnalyzeRequest, Bundesland, DemoPersona } from "@/lib/types";

const BUNDESLAENDER = [
  "Baden-Wuerttemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thueringen",
];

const INDUSTRIES = [
  { label: "B2B SaaS", icon: "💻" },
  { label: "AI / ML", icon: "🤖" },
  { label: "E-Commerce", icon: "🛒" },
  { label: "FinTech", icon: "💳" },
  { label: "HealthTech", icon: "🏥" },
  { label: "Other", icon: "✨" },
];

const GOALS = [
  {
    key: "bootstrap",
    icon: "🚀",
    label: "Bootstrap",
    desc: "Grow without outside capital",
    hint: "UG (haftungsbeschränkt) is usually the best fit",
  },
  {
    key: "fundraise",
    icon: "💰",
    label: "Fundraise",
    desc: "Get ready for investors",
    hint: "GmbH is usually the best fit",
  },
  {
    key: "expand",
    icon: "🌍",
    label: "Expand",
    desc: "Expand into Germany",
    hint: "UG / GmbH depends on your capital setup",
  },
];

type Step = 1 | 2 | 3;

const DEFAULT_FORM: AnalyzeRequest = {
  company_name: "",
  industry: "B2B SaaS",
  bundesland: "Berlin",
  founder_count: 2,
  available_capital_eur: 8000,
  goals: "Seed round in 6 months",
  founder_background: {
    university_affiliation: false,
    research_spinout: false,
    foreign_founder: false,
    employment_status: "full_time",
  },
};

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {([1, 2, 3] as Step[]).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all"
            style={
              step === current
                ? { background: "#6C63FF", color: "#fff", boxShadow: "0 0 16px rgba(108,99,255,0.6)" }
                : step < current
                ? { background: "rgba(108,99,255,0.3)", color: "#a89dff", border: "1px solid rgba(108,99,255,0.5)" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {step < current ? "✓" : step}
          </div>
          {step < 3 && (
            <div
              className="h-px w-8 transition-all"
              style={{ background: step < current ? "rgba(108,99,255,0.5)" : "rgba(255,255,255,0.08)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<AnalyzeRequest>(DEFAULT_FORM);
  const [goalKey, setGoalKey] = useState<string>("bootstrap");
  const [personas, setPersonas] = useState<DemoPersona[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const autoDemoHandled = useRef(false);

  function updateField<K extends keyof AnalyzeRequest>(key: K, value: AnalyzeRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function formatEur(val: number) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
  }

  useEffect(() => {
    let mounted = true;

    void fetchDemoPersonas()
      .then((payload) => {
        if (mounted) {
          setPersonas(payload);
        }
      })
      .catch(() => {
        // Ignore persona loading failures and keep the manual form usable.
      });

    return () => {
      mounted = false;
    };
  }, []);

  function applyPersona(persona: DemoPersona) {
    setForm(persona.request);
    setGoalKey(
      persona.request.goals.toLowerCase().includes("expand")
        ? "expand"
        : persona.request.goals.toLowerCase().includes("seed") || persona.request.goals.toLowerCase().includes("investor")
          ? "fundraise"
          : "bootstrap",
    );
    setStep1Error(null);
    setError(null);
    setStep(3);
  }

  async function submitStartup(payload: AnalyzeRequest) {
    setIsSubmitting(true);
    setError(null);

    try {
      const queued = await analyzeStartup(payload);
      startTransition(() => {
        router.push(`/dashboard/${queued.job_id}`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    const goalsText =
      goalKey === "fundraise"
        ? "Seed round in 6 months, investor-ready"
        : goalKey === "expand"
        ? "Expand into Germany from abroad"
        : "Bootstrap and grow self-funded";

    await submitStartup({ ...form, goals: goalsText });
  }

  useEffect(() => {
    if (autoDemoHandled.current || personas.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const personaId = params.get("persona");
    if (!personaId) {
      return;
    }

    const persona = personas.find((item) => item.id === personaId);
    if (!persona) {
      return;
    }

    autoDemoHandled.current = true;
    applyPersona(persona);

    if (params.get("autostart") === "1") {
      void submitStartup(persona.request);
    }
  }, [personas]);

  const capitalThreshold = 25000;
  const isUg = form.available_capital_eur < capitalThreshold;

  return (
    <div className="aurora-page min-h-screen px-6 py-8 text-white md:px-10">
      <div className="aurora-orb" />

      <div className="mx-auto max-w-6xl">
        {/* Nav */}
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <img
              src="/logo-particle.png"
              alt="Startup OS"
              style={{ width: 30, height: 30, borderRadius: 999, objectFit: "cover" }}
            />
            <span className="text-lg font-semibold tracking-tight">
              Startup <span className="font-serif-italic font-normal">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <StepIndicator current={step} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              Step {step} of 3
            </p>
            <Link
              href="/start?persona=sarah-thomas&autostart=1"
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:scale-[1.02]"
              style={{
                background: "rgba(108,99,255,0.16)",
                border: "1px solid rgba(168,157,255,0.35)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Run best demo
            </Link>
          </div>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          {/* Left panel — explanation */}
          <div
            className="liquid-glass glass-border-soft rounded-[28px] p-8"
            style={{ background: "rgba(9,12,21,0.52)" }}
          >
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-[0.22em]"
              style={{ background: "rgba(108,99,255,0.14)", color: "rgba(215,211,255,0.92)" }}
            >
              ONBOARDING
            </span>
            <h1
              className="mt-6 text-3xl leading-tight md:text-4xl"
              style={{ letterSpacing: "-0.04em", color: "rgba(248,251,255,0.98)", fontWeight: 650 }}
            >
              {step === 1 && "Tell us about your startup."}
              {step === 2 && "How much capital is available?"}
              {step === 3 && "What do you want to achieve?"}
            </h1>
            <p className="mt-4 text-base" style={{ color: "rgba(220,229,243,0.68)", lineHeight: 1.65 }}>
              {step === 1 && "Company name, location, and industry give the agents the context they need for precise recommendations."}
              {step === 2 && "Your capital level shapes whether UG or GmbH is recommended — the main threshold is €25,000."}
              {step === 3 && "Your goal sets the priority stack across all four agents: legal, finance, hiring, and ops."}
            </p>

            <div className="mt-8 space-y-3">
              {[
                { label: "Legal Agent", desc: "UG vs. GmbH · Handelsregister · Gesellschaftsvertrag", color: "#7B2FBE" },
                { label: "Finance Agent", desc: "Burn Rate · Runway · EXIST · KfW", color: "#00C9A7" },
                { label: "Hiring Agent", desc: "Werkstudent · Scheinselbstständigkeit · First roles", color: "#10B981" },
                { label: "Ops Agent", desc: "DSGVO · Tool stack · E-Rechnung", color: "#F59E0B" },
              ].map((a) => (
                <div
                  key={a.label}
                  className="liquid-glass glass-border-soft rounded-2xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                    <p className="text-sm font-semibold" style={{ color: "rgba(248,251,255,0.9)" }}>
                      {a.label}
                    </p>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "rgba(220,229,243,0.55)" }}>
                    {a.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Flow indicator */}
            <div className="mt-8 flex flex-wrap gap-2 text-xs">
              {["Landing", "Onboarding", "War Room", "Dashboard"].map((s, i) => (
                <span
                  key={s}
                  className="rounded-full px-3 py-1.5"
                  style={{
                    background: i === 1 ? "rgba(108,99,255,0.18)" : "rgba(255,255,255,0.04)",
                    color: i === 1 ? "#d8d4ff" : "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Right panel — form */}
          <div
            className="liquid-glass glass-border-indigo rounded-[28px] p-8"
            style={{ background: "rgba(9,12,21,0.58)" }}
          >
          {/* ── Step 1: Core information ── */}
          {step === 1 && (
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Company name</span>
                <input
                  value={form.company_name}
                  onChange={(e) => { updateField("company_name", e.target.value); setStep1Error(null); }}
                  placeholder="e.g. TechFlow"
                  className="glass-pill rounded-2xl px-4 py-3 outline-none transition"
                  style={{
                    fontFamily: "inherit",
                    borderColor: step1Error ? "rgba(239,68,68,0.5)" : undefined,
                    boxShadow: step1Error ? "0 0 0 1px rgba(239,68,68,0.5)" : undefined,
                  }}
                />
                {step1Error && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{step1Error}</p>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Bundesland</span>
                <select
                  value={form.bundesland}
                  onChange={(e) => updateField("bundesland", e.target.value as Bundesland)}
                  className="glass-pill rounded-2xl px-4 py-3 outline-none"
                  style={{ fontFamily: "inherit", appearance: "none" }}
                >
                  {BUNDESLAENDER.map((b) => (
                    <option key={b} value={b} style={{ background: "#111", color: "#fff" }}>
                      {b.replace("Wuerttemberg", "Württemberg").replace("Thueringen", "Thüringen")}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Industry</span>
                <div className="grid grid-cols-3 gap-2">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind.label}
                      type="button"
                      onClick={() => updateField("industry", ind.label)}
                      className="rounded-2xl px-3 py-3 text-sm transition"
                      style={
                        form.industry === ind.label
                          ? {
                              background: "rgba(108,99,255,0.2)",
                              border: "1px solid rgba(108,99,255,0.5)",
                              color: "#fff",
                            }
                          : {
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.65)",
                            }
                      }
                    >
                      <div className="text-lg">{ind.icon}</div>
                      <div className="mt-1 text-xs">{ind.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Number of founders</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.founder_count}
                  onChange={(e) => updateField("founder_count", Number(e.target.value))}
                  className="glass-pill rounded-2xl px-4 py-3 outline-none"
                />
              </label>
            </div>
          )}

          {/* ── Step 2: Capital and founder profile ── */}
          {step === 2 && (
            <div className="grid gap-6">
              {/* Capital slider */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Available capital (€)</span>
                  <span className="numeric text-sm font-semibold" style={{ color: "#a89dff" }}>
                    {formatEur(form.available_capital_eur)}
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={100000}
                  step={500}
                  value={form.available_capital_eur}
                  onChange={(e) => updateField("available_capital_eur", Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#6C63FF" }}
                />
                {/* UG / GmbH threshold indicator */}
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                  style={
                    isUg
                      ? { background: "rgba(123,47,190,0.15)", border: "1px solid rgba(123,47,190,0.3)", color: "#c084fc" }
                      : { background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }
                  }
                >
                  {isUg ? (
                    <>
                      <span>⚖️</span>
                      <span>
                        Below €25,000 → <strong>UG (haftungsbeschränkt)</strong> is usually recommended
                      </span>
                    </>
                  ) : (
                    <>
                      <span>🏢</span>
                      <span>
                        At €25,000 or above → <strong>GmbH</strong> is usually recommended
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* University affiliation */}
              <div className="grid gap-3">
                <span className="text-sm font-medium">Founder background</span>
                <div className="glass-soft rounded-2xl p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.founder_background.university_affiliation}
                      onChange={(e) =>
                        updateField("founder_background", {
                          ...form.founder_background,
                          university_affiliation: e.target.checked,
                        })
                      }
                      style={{ accentColor: "#6C63FF" }}
                    />
                    <div>
                      <p className="text-sm font-medium">University affiliation</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Can make you eligible for the EXIST grant programme (up to €3,000/month)
                      </p>
                    </div>
                  </label>
                </div>
                <div className="glass-soft rounded-2xl p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.founder_background.research_spinout}
                      onChange={(e) =>
                        updateField("founder_background", {
                          ...form.founder_background,
                          research_spinout: e.target.checked,
                        })
                      }
                      style={{ accentColor: "#6C63FF" }}
                    />
                    <div>
                      <p className="text-sm font-medium">Research Spinout</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Can unlock EIC Accelerator and EXIST Forschungstransfer eligibility
                      </p>
                    </div>
                  </label>
                </div>
                <div className="glass-soft rounded-2xl p-4">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.founder_background.foreign_founder}
                      onChange={(e) =>
                        updateField("founder_background", {
                          ...form.founder_background,
                          foreign_founder: e.target.checked,
                        })
                      }
                      style={{ accentColor: "#6C63FF" }}
                    />
                    <div>
                      <p className="text-sm font-medium">Foreign founder</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Adds extra guidance for banking, notary paperwork, and cross-border setup
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Employment status */}
              <label className="grid gap-2">
                <span className="text-sm font-medium">Employment status</span>
                <select
                  value={form.founder_background.employment_status}
                  onChange={(e) =>
                    updateField("founder_background", {
                      ...form.founder_background,
                      employment_status: e.target.value as AnalyzeRequest["founder_background"]["employment_status"],
                    })
                  }
                  className="glass-pill rounded-2xl px-4 py-3 outline-none"
                  style={{ appearance: "none" }}
                >
                  <option value="full_time" style={{ background: "#111", color: "#fff" }}>Full-time employed</option>
                  <option value="part_time" style={{ background: "#111", color: "#fff" }}>Part-time employed</option>
                  <option value="student" style={{ background: "#111", color: "#fff" }}>Student / Werkstudent</option>
                  <option value="other" style={{ background: "#111", color: "#fff" }}>Other</option>
                </select>
              </label>
            </div>
          )}

          {/* ── Step 3: Goals ── */}
          {step === 3 && (
            <div className="grid gap-4">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGoalKey(g.key)}
                  className="flex items-start gap-4 rounded-2xl p-5 text-left transition"
                  style={
                    goalKey === g.key
                      ? {
                          background: "rgba(108,99,255,0.18)",
                          border: "1px solid rgba(108,99,255,0.5)",
                          boxShadow: "0 0 24px rgba(108,99,255,0.2)",
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <p className="font-semibold">{g.label}</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {g.desc}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: goalKey === g.key ? "#a89dff" : "rgba(255,255,255,0.3)" }}
                    >
                      {g.hint}
                    </p>
                  </div>
                  <div
                    className="ml-auto mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={
                      goalKey === g.key
                        ? { background: "#6C63FF" }
                        : { border: "1px solid rgba(255,255,255,0.15)" }
                    }
                  >
                    {goalKey === g.key && (
                      <span className="text-xs text-white">✓</span>
                    )}
                  </div>
                </button>
              ))}

              {error && (
                <p className="rounded-xl px-4 py-3 text-sm text-red-300" style={{ background: "rgba(239,68,68,0.1)" }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-4">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setStep((s) => (s - 1) as Step); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="rounded-full px-5 py-2.5 text-sm transition hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !form.company_name.trim()) {
                    setStep1Error("Please enter a company name.");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                  }
                  setStep1Error(null);
                  setStep((s) => (s + 1) as Step);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-white/90"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Launching agents..." : "Start Startup OS →"}
              </button>
            )}
          </div>

          {/* Demo shortcut */}
          {personas.length > 0 ? (
            <div className="mt-5 grid gap-2">
              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Demo personas from the backend
              </p>
              <div className="grid gap-2">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => applyPersona(persona)}
                    className="w-full rounded-2xl px-4 py-3 text-left transition hover:bg-white/5"
                    style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
                  >
                    <p className="text-sm font-semibold">{persona.title}</p>
                    <p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {persona.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        </div>
        </div>
      </div>
  );
}
