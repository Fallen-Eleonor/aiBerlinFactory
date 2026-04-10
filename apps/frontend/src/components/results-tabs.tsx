"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { toDownloadUrl } from "@/lib/api";
import { AnalysisResult, EvidenceReference, LegalChecklistItem } from "@/lib/types";

const tabs = [
  { key: "legal", label: "Entity" },
  { key: "finance", label: "Finance" },
  { key: "equity", label: "Equity" },
  { key: "hiring", label: "Team" },
  { key: "ops", label: "Operations" },
] as const;

const AGENT_TAB_COLORS: Record<(typeof tabs)[number]["key"], string> = {
  legal: "#7B2FBE",
  finance: "#00C9A7",
  equity: "#6C63FF",
  hiring: "#10B981",
  ops: "#F59E0B",
};

const DOWNLOAD_LABELS: Record<string, string> = {
  gesellschaftsvertrag: "Gesellschaftsvertrag (.docx)",
  "founder-resolution-summary": "Founder Resolution Summary (.txt)",
  "handelsregister-checklist": "Handelsregister Checklist (.txt)",
};

function formatEur(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function tooltipValue(value: string | number | readonly (string | number)[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] : value;
  return formatEur(typeof resolved === "number" ? resolved : Number(resolved ?? 0));
}

function checklistKey(prefix: string, title: string) {
  return `${prefix}:${title}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function EvidenceList({ evidence }: { evidence: EvidenceReference[] }) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="glass-pill rounded-[1.5rem] p-5">
      <p className="section-title">Evidence</p>
      <div className="mt-3 grid gap-3">
        {evidence.map((item) => (
          <div
            key={`${item.issuer}-${item.title}`}
            className="rounded-2xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline-offset-4 hover:underline">
                {item.title}
              </a>
            ) : (
              <p className="text-sm font-semibold">{item.title}</p>
            )}
            <p className="mt-1 text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
              {item.issuer}
            </p>
            <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
              {item.rationale}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({
  item,
  checked,
  accent,
  onToggle,
}: {
  item: LegalChecklistItem;
  checked: boolean;
  accent: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-2xl px-4 py-4 text-left transition hover:bg-white/5"
      style={{
        background: checked ? `${accent}15` : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked ? `${accent}55` : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold"
            style={{
              background: checked ? accent : "rgba(255,255,255,0.05)",
              border: checked ? "none" : "1px solid rgba(255,255,255,0.12)",
              color: checked ? "#fff" : "rgba(255,255,255,0.2)",
            }}
          >
            {checked ? "✓" : ""}
          </span>
          <div>
            <p className="text-sm font-semibold" style={{ textDecoration: checked ? "line-through" : "none" }}>
              {item.title}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
              {item.description}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.32)", fontFamily: "'JetBrains Mono', monospace" }}>
            {item.eta}
          </p>
          {item.estimated_cost_eur !== null ? (
            <p className="mt-1 text-xs" style={{ color: accent }}>{formatEur(item.estimated_cost_eur)}</p>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
        Owner: {item.owner}
      </p>
    </button>
  );
}

export function ResultsTabs({
  result,
  tasks,
  onTaskToggle,
}: {
  result: AnalysisResult;
  tasks: Record<string, boolean>;
  onTaskToggle: (key: string, checked: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("legal");

  return (
    <section className="liquid-glass glass-border-soft rounded-[2rem] p-6">
      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => {
          const color = AGENT_TAB_COLORS[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="rounded-full px-4 py-2 text-sm transition"
              style={
                activeTab === tab.key
                  ? { background: color, color: "#fff", boxShadow: `0 0 20px ${color}55` }
                  : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "legal" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-4">
            <div className="glass-pill rounded-[1.5rem] p-5" style={{ borderColor: "rgba(123,47,190,0.3)", boxShadow: "0 0 30px rgba(123,47,190,0.1)" }}>
              <p className="section-title">Recommended entity</p>
              <h3 className="mt-2 text-2xl font-semibold" style={{ color: "#c084fc" }}>{result.legal.recommended_entity}</h3>
              <p className="glass-muted mt-3 text-sm leading-7">{result.legal.reasoning}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="section-title">Incorporation cost</p>
                  <p className="numeric mt-1 font-semibold">{formatEur(result.legal.estimated_cost_eur)}</p>
                </div>
                <div>
                  <p className="section-title">Timeline</p>
                  <p className="numeric mt-1 font-semibold">{result.legal.estimated_weeks} weeks</p>
                </div>
                <div>
                  <p className="section-title">Note</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>{result.legal.conversion_note}</p>
                </div>
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Why this entity</p>
              <div className="mt-3 grid gap-2">
                {result.legal.entity_rationale.map((reason) => (
                  <div key={reason} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ color: "#c084fc" }}>•</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <div className="flex items-center justify-between">
                <p className="section-title">Incorporation Checklist</p>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {
                    result.legal.incorporation_steps.filter((item) => tasks[checklistKey("legal:incorporation", item.title)]).length
                  }
                  /{result.legal.incorporation_steps.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {result.legal.incorporation_steps.map((item) => {
                  const key = checklistKey("legal:incorporation", item.title);
                  return (
                    <ChecklistCard
                      key={key}
                      item={item}
                      checked={Boolean(tasks[key])}
                      accent="#7B2FBE"
                      onToggle={() => onTaskToggle(key, !tasks[key])}
                    />
                  );
                })}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <div className="flex items-center justify-between">
                <p className="section-title">After incorporation</p>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {
                    result.legal.post_incorporation_checklist.filter((item) => tasks[checklistKey("legal:post", item.title)]).length
                  }
                  /{result.legal.post_incorporation_checklist.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {result.legal.post_incorporation_checklist.map((item) => {
                  const key = checklistKey("legal:post", item.title);
                  return (
                    <ChecklistCard
                      key={key}
                      item={item}
                      checked={Boolean(tasks[key])}
                      accent="#a855f7"
                      onToggle={() => onTaskToggle(key, !tasks[key])}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Downloads</p>
              <div className="mt-4 grid gap-3">
                {result.downloads.map((download) => (
                  <a
                    key={download.kind}
                    href={toDownloadUrl(download.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition hover:scale-[1.01]"
                    style={{
                      background: "rgba(123,47,190,0.12)",
                      border: "1px solid rgba(123,47,190,0.28)",
                      color: "#d8b4fe",
                    }}
                  >
                    <span>{DOWNLOAD_LABELS[download.kind] ?? download.kind}</span>
                    <span>↗</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Documents</p>
              <div className="mt-3 grid gap-2">
                {result.legal.documents.map((doc) => (
                  <div
                    key={doc}
                    className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.6)" }}
                  >
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Analysis</p>
              <p className="mt-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.65)" }}>
                {result.legal.narrative}
              </p>
            </div>

            <EvidenceList evidence={result.legal.evidence} />
          </div>
        </div>
      ) : null}

      {activeTab === "finance" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Burn / month", value: formatEur(result.finance.monthly_burn_eur), color: "#00C9A7" },
                { label: "Runway (base)", value: `${result.finance.runway_months.base} mo.`, color: "#6C63FF" },
                { label: "Raise target", value: formatEur(result.finance.recommended_raise_eur), color: "#F59E0B" },
                { label: "Raise start", value: `Month ${result.finance.recommended_raise_timing_month}`, color: "#10B981" },
              ].map((card) => (
                <div key={card.label} className="glass-pill rounded-2xl p-4">
                  <p className="section-title">{card.label}</p>
                  <p className="numeric mt-1 text-xl font-bold" style={{ color: card.color }}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">18-month runway</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.finance.chart_data}>
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff" }}
                      formatter={(value) => [tooltipValue(value), ""]}
                      labelFormatter={(label) => `Month ${label}`}
                    />
                    <Line type="monotone" dataKey="cash_base" stroke="#00C9A7" strokeWidth={2.5} dot={false} name="Base" />
                    <Line type="monotone" dataKey="cash_conservative" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Conservative" />
                    <Line type="monotone" dataKey="cash_optimistic" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Optimistic" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Funding Programme</p>
              <div className="mt-4 grid gap-3">
                {result.finance.funding_programs.map((program) => (
                  <div
                    key={program.name}
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: program.eligible ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)",
                      border: program.eligible ? "1px solid rgba(16,185,129,0.28)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{program.name}</p>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: program.eligible ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                          color: program.eligible ? "#10B981" : "rgba(255,255,255,0.35)",
                        }}
                      >
                        {program.eligible ? "Eligible" : "Not now"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {program.summary}
                    </p>
                    {program.max_amount_eur !== null ? (
                      <p className="mt-2 text-xs" style={{ color: "#00C9A7" }}>
                        Up to {formatEur(program.max_amount_eur)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Salary Benchmarks</p>
              <div className="mt-4 grid gap-3">
                {result.finance.salary_benchmarks.map((benchmark) => (
                  <div
                    key={benchmark.role}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{benchmark.role}</p>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{benchmark.contract_type}</span>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: "#00C9A7" }}>
                      {formatEur(benchmark.annual_gross_low_eur)} - {formatEur(benchmark.annual_gross_high_eur)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Tax notes</p>
              <div className="mt-3 grid gap-2">
                {result.finance.tax_notes.map((note) => (
                  <p key={note} className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    · {note}
                  </p>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Assumptions</p>
              <div className="mt-3 grid gap-2">
                {result.finance.assumptions.map((assumption) => (
                  <p key={assumption} className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    · {assumption}
                  </p>
                ))}
              </div>
            </div>

            <EvidenceList evidence={result.finance.evidence} />
          </div>
        </div>
      ) : null}

      {activeTab === "equity" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            <div className="glass-pill rounded-[1.5rem] p-5" style={{ borderColor: "rgba(108,99,255,0.3)", boxShadow: "0 0 30px rgba(108,99,255,0.08)" }}>
              <p className="section-title">Cap table strategy</p>
              <h3 className="mt-1 text-xl font-semibold" style={{ color: "#a89dff" }}>
                Founder control with hiring room built in
              </h3>
              <div
                className="mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: "rgba(108,99,255,0.14)",
                  border: "1px solid rgba(168,157,255,0.28)",
                  color: "#c7c1ff",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Planning preview only, not legal equity documentation
              </div>
              <p className="mt-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.65)" }}>
                {result.cap_table.summary}
              </p>
              <p className="mt-3 text-xs leading-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                {result.cap_table.entity_fit}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Founder pool", value: formatPercent(result.cap_table.founder_pool_percent) },
                { label: "ESOP reserve", value: formatPercent(result.cap_table.option_pool_percent) },
                { label: "Advisor pool", value: formatPercent(result.cap_table.advisor_pool_percent) },
              ].map((card) => (
                <div key={card.label} className="glass-pill rounded-2xl p-4">
                  <p className="section-title">{card.label}</p>
                  <p className="numeric mt-1 text-xl font-bold" style={{ color: "#a89dff" }}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Current founder allocations</p>
              <div className="mt-4 grid gap-3">
                {result.cap_table.allocations.map((allocation) => (
                  <div
                    key={allocation.holder}
                    className="rounded-2xl px-4 py-4"
                    style={{ background: "rgba(108,99,255,0.06)", border: "1px solid rgba(108,99,255,0.15)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{allocation.holder}</p>
                        <p className="mt-1 text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {allocation.role}
                        </p>
                      </div>
                      <p className="numeric text-sm font-semibold" style={{ color: "#a89dff" }}>
                        {formatPercent(allocation.ownership_percent)}
                      </p>
                    </div>
                    <p className="mt-3 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {allocation.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Dilution preview</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-sm font-semibold">{result.cap_table.dilution_preview.round_name}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.35)" }}>Pre-money</p>
                      <p className="mt-1" style={{ color: "#a89dff" }}>{formatEur(result.cap_table.dilution_preview.pre_money_eur)}</p>
                    </div>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.35)" }}>New money</p>
                      <p className="mt-1" style={{ color: "#a89dff" }}>{formatEur(result.cap_table.dilution_preview.new_money_eur)}</p>
                    </div>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.35)" }}>Round dilution</p>
                      <p className="mt-1" style={{ color: "#a89dff" }}>{formatPercent(result.cap_table.dilution_preview.dilution_percent)}</p>
                    </div>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.35)" }}>Founder pool after round</p>
                      <p className="mt-1" style={{ color: "#a89dff" }}>{formatPercent(result.cap_table.dilution_preview.founder_pool_post_raise_percent)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {result.cap_table.dilution_preview.notes}
                  </p>
                </div>
              </div>
            </div>

            <EvidenceList evidence={result.cap_table.evidence} />
          </div>
        </div>
      ) : null}

      {activeTab === "hiring" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className="glass-pill rounded-[1.5rem] p-5" style={{ borderColor: "rgba(16,185,129,0.3)", boxShadow: "0 0 30px rgba(16,185,129,0.08)" }}>
              <p className="section-title">Hiring strategy</p>
              <h3 className="mt-1 text-xl font-semibold" style={{ color: "#10B981" }}>
                {result.hiring.stage.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase())}
              </h3>
              <p className="mt-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.65)" }}>
                {result.hiring.recommendation}
              </p>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">First roles</p>
              <div className="mt-4 grid gap-3">
                {result.hiring.first_roles.map((role) => (
                  <div
                    key={role.title}
                    className="rounded-2xl px-4 py-4"
                    style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{role.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {role.priority} · {role.contract_type}
                        </p>
                      </div>
                      <p className="text-xs" style={{ color: "#10B981" }}>
                        {formatEur(role.annual_cost_low_eur)} - {formatEur(role.annual_cost_high_eur)}
                      </p>
                    </div>
                    <p className="mt-3 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {role.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Org Structure</p>
              <div className="mt-4 grid gap-3">
                {result.hiring.org_structure.map((node) => (
                  <div
                    key={`${node.title}-${node.reports_to}`}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{node.title}</p>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>reports to {node.reports_to}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {node.focus}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Recommended contract types</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.hiring.suggested_contract_types.map((contractType) => (
                  <span
                    key={contractType}
                    className="rounded-full px-3 py-1.5 text-xs"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                  >
                    {contractType}
                  </span>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Milestones</p>
              <div className="mt-3 grid gap-2">
                {result.hiring.milestones.map((milestone) => (
                  <p key={milestone} className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    · {milestone}
                  </p>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Employment-law notes</p>
              <div className="mt-4 grid gap-3">
                {result.hiring.employment_law_flags.map((flag) => {
                  const severityColor =
                    flag.severity === "critical" ? "#ef4444"
                    : flag.severity === "warning" ? "#F59E0B"
                    : "#10B981";
                  return (
                    <div
                      key={flag.title}
                      className="rounded-2xl px-4 py-3"
                      style={{ background: `${severityColor}12`, border: `1px solid ${severityColor}30` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{flag.title}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase"
                          style={{ background: `${severityColor}20`, color: severityColor, fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {flag.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                        {flag.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <EvidenceList evidence={result.hiring.evidence} />
          </div>
        </div>
      ) : null}

      {activeTab === "ops" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            <div className="glass-pill rounded-[1.5rem] p-5" style={{ borderColor: "rgba(245,158,11,0.3)", boxShadow: "0 0 30px rgba(245,158,11,0.06)" }}>
              <div className="flex items-center justify-between gap-3">
                <p className="section-title">DSGVO checklist</p>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {
                    result.ops.dsgvo_checklist.filter((item) => tasks[checklistKey("ops:dsgvo", item.title)]).length
                  }
                  /{result.ops.dsgvo_checklist.length}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {result.ops.dsgvo_checklist.map((item) => {
                  const key = checklistKey("ops:dsgvo", item.title);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTaskToggle(key, !tasks[key])}
                      className="rounded-2xl px-4 py-4 text-left transition hover:bg-white/5"
                      style={{
                        background: tasks[key] ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.04)",
                        border: tasks[key] ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(245,158,11,0.12)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                            {item.description}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs uppercase"
                          style={{ background: "rgba(245,158,11,0.16)", color: "#F59E0B", fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Owner: {item.owner}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Compliance Highlights</p>
              <div className="mt-3 grid gap-2">
                {result.ops.compliance_highlights.map((highlight) => (
                  <p key={highlight} className="text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    · {highlight}
                  </p>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Required setup</p>
              <div className="mt-3 grid gap-2">
                {result.ops.required_setups.map((setup) => (
                  <div key={setup} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                    <span style={{ color: "#F59E0B" }}>→</span>
                    {setup}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">Germany-first tech stack</p>
              <div className="mt-4 grid gap-3">
                {result.ops.tool_stack.map((tool) => (
                  <div
                    key={`${tool.category}-${tool.tool}`}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{tool.tool}</p>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {tool.category}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {tool.why}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "#F59E0B" }}>
                      {tool.compliance_note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-pill rounded-[1.5rem] p-5">
              <p className="section-title">E-Rechnung</p>
              <p className="mt-3 text-sm leading-7" style={{ color: "rgba(255,255,255,0.6)" }}>
                {result.ops.e_invoicing_note}
              </p>
            </div>

            <EvidenceList evidence={result.ops.evidence} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
