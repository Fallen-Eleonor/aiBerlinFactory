"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { analyzeStartup, fetchDemoPersonas } from "@/lib/api";
import { AnalyzeRequest, Bundesland, DemoPersona } from "@/lib/types";

const bundeslaender = [
  "Berlin",
  "Bayern",
  "Hamburg",
  "Nordrhein-Westfalen",
  "Hessen",
  "Baden-Wuerttemberg",
  "Niedersachsen",
];

const samplePayload: AnalyzeRequest = {
  company_name: "TechVision",
  industry: "B2B SaaS",
  bundesland: "Berlin",
  founder_count: 2,
  available_capital_eur: 8000,
  goals: "Seed round in 6 months",
  founder_background: {
    university_affiliation: true,
    research_spinout: false,
    foreign_founder: false,
    employment_status: "full_time",
  },
};

export function OnboardingForm() {
  const router = useRouter();
  const [form, setForm] = useState<AnalyzeRequest>(samplePayload);
  const [demoPersonas, setDemoPersonas] = useState<DemoPersona[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof AnalyzeRequest>(key: K, value: AnalyzeRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    let mounted = true;
    void fetchDemoPersonas()
      .then((payload) => {
        if (mounted) {
          setDemoPersonas(payload);
        }
      })
      .catch(() => {
        // Ignore persona loading failures.
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const queued = await analyzeStartup(form);
      startTransition(() => {
        router.push(`/dashboard/${queued.job_id}`);
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel grid gap-6 rounded-[2rem] p-8 md:grid-cols-2" onSubmit={handleSubmit}>
      <div className="md:col-span-2 flex items-center justify-between gap-4">
        <div>
          <p className="section-title">Onboarding</p>
          <h2 className="mt-2 text-3xl font-semibold">Company creation brief</h2>
        </div>
        <button
          type="button"
          onClick={() => setForm(demoPersonas[0]?.request ?? samplePayload)}
          className="glass-pill rounded-full px-4 py-2 text-sm transition hover:bg-white/10"
        >
          Load backend persona
        </button>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Company name</span>
        <input
          value={form.company_name}
          onChange={(event) => updateField("company_name", event.target.value)}
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Industry</span>
        <input
          value={form.industry}
          onChange={(event) => updateField("industry", event.target.value)}
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Bundesland</span>
        <select
          value={form.bundesland}
          onChange={(event) => updateField("bundesland", event.target.value as Bundesland)}
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
        >
          {bundeslaender.map((bundesland) => (
            <option key={bundesland} value={bundesland}>
              {bundesland}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Founders</span>
        <input
          type="number"
          min={1}
          max={10}
          value={form.founder_count}
          onChange={(event) => updateField("founder_count", Number(event.target.value))}
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Available capital (EUR)</span>
        <input
          type="number"
          min={0}
          value={form.available_capital_eur}
          onChange={(event) => updateField("available_capital_eur", Number(event.target.value))}
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Founder employment status</span>
        <select
          value={form.founder_background.employment_status}
          onChange={(event) =>
            updateField("founder_background", {
              ...form.founder_background,
              employment_status: event.target.value as AnalyzeRequest["founder_background"]["employment_status"],
            })
          }
          className="glass-pill rounded-2xl px-4 py-3 outline-none"
        >
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="student">Student</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="md:col-span-2 grid gap-2">
        <span className="text-sm font-medium">Goals</span>
        <textarea
          value={form.goals}
          onChange={(event) => updateField("goals", event.target.value)}
          className="glass-pill min-h-28 rounded-2xl px-4 py-3 outline-none"
        />
      </label>

      <div className="glass-soft md:col-span-2 flex flex-wrap gap-6 rounded-[1.75rem] p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.founder_background.university_affiliation}
            onChange={(event) =>
              updateField("founder_background", {
                ...form.founder_background,
                university_affiliation: event.target.checked,
              })
            }
          />
          <span className="text-sm">University affiliation</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.founder_background.research_spinout}
            onChange={(event) =>
              updateField("founder_background", {
                ...form.founder_background,
                research_spinout: event.target.checked,
              })
            }
          />
          <span className="text-sm">Research spinout</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.founder_background.foreign_founder}
            onChange={(event) =>
              updateField("founder_background", {
                ...form.founder_background,
                foreign_founder: event.target.checked,
              })
            }
          />
          <span className="text-sm">Foreign founder</span>
        </label>
      </div>

      <div className="md:col-span-2 flex items-center justify-between gap-4">
        {error ? <p className="text-sm text-red-300">{error}</p> : <p className="glass-muted text-sm">The API response streams directly into the live war room.</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-white/12 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Launching agents..." : "Analyze startup"}
        </button>
      </div>
    </form>
  );
}
