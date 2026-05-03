"use client";
import { FormEvent, useRef, useState } from "react";
import {
  findNearestPrediction,
  validateScore,
  type PredictionResult,
} from "../lib/predictor";

/* ─── helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);

const WEBHOOK = import.meta.env.VITE_SHEETS_URL as string | undefined;

/** Fire-and-forget POST to Google Apps Script (no-cors — data arrives, response is opaque) */
async function postToSheet(payload: Record<string, unknown>) {
  if (!WEBHOOK) return;
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      mode: "no-cors",            // required for Apps Script; response will be opaque
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* fail silently — prediction / counselling still shows */
  }
}

/* ─── STATES & UNION TERRITORIES ─── */
const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi (NCT)","Jammu & Kashmir","Ladakh",
];

const CATEGORIES = ["General","OBC","SC","ST","EWS","OBC-NCL"];
const COURSES    = ["MBBS","BDS","BAMS (Ayurveda)","BHMS (Homeopathy)","BUMS (Unani)","BPT (Physiotherapy)","B.Sc Nursing","Other"];

/* ─── form types ─── */
type LeadForm = { name: string; phone: string; email: string; city: string };
const blankLead: LeadForm = { name: "", phone: "", email: "", city: "" };

type CounselForm = {
  name: string; phone: string; email: string;
  city: string; state: string; category: string;
  course: string; neetScore: string; message: string;
};
const blankCounsel: CounselForm = {
  name: "", phone: "", email: "",
  city: "", state: "", category: "",
  course: "", neetScore: "", message: "",
};

/* ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  /* predictor state */
  const [score, setScore]         = useState("");
  const [leadForm, setLeadForm]   = useState<LeadForm>(blankLead);
  const [showLead, setShowLead]   = useState(false);
  const [result, setResult]       = useState<PredictionResult | null>(null);
  const [predName, setPredName]   = useState("");
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);

  /* counselling state */
  const [showCounsel, setShowCounsel]     = useState(false);
  const [counselForm, setCounselForm]     = useState<CounselForm>(blankCounsel);
  const [counselError, setCounselError]   = useState<string | null>(null);
  const [counselLoading, setCounselLoading] = useState(false);
  const [counselDone, setCounselDone]     = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  const scoreNum   = score.trim() === "" ? null : Number(score);
  const validScore = scoreNum !== null && Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= 720;
  const pct        = validScore ? Math.round((scoreNum! / 720) * 100) : 0;

  /* ── open rank-prediction lead modal ── */
  function openLead() {
    setScoreError(null);
    try { validateScore(score); setShowLead(true); }
    catch (e) { setScoreError(e instanceof Error ? e.message : "Invalid score."); }
  }

  /* ── submit rank prediction ── */
  async function handleLeadSubmit(e: FormEvent) {
    e.preventDefault();
    setLeadLoading(true);
    setLeadError(null);
    try {
      const scoreVal  = validateScore(score);
      const prediction = findNearestPrediction(scoreVal);

      await postToSheet({
        type: "lead",
        ...leadForm,
        score: scoreVal,
        predictedRank: prediction.predictedRank,
        predictedFrom: prediction.predictedFrom,
        predictedTo:   prediction.predictedTo,
        submittedAt:   new Date().toISOString(),
      });

      // fire Meta Pixel Lead event
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }

      setResult(prediction);
      setPredName(leadForm.name.trim());
      setShowLead(false);
      setLeadForm(blankLead);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setLeadError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLeadLoading(false);
    }
  }

  /* ── submit counselling request ── */
  async function handleCounselSubmit(e: FormEvent) {
    e.preventDefault();
    setCounselLoading(true);
    setCounselError(null);
    try {
      if (!counselForm.name.trim() || !counselForm.phone.trim() || !counselForm.email.trim()) {
        throw new Error("Please fill in all required fields.");
      }
      await postToSheet({
        type:      "counselling",
        name:      counselForm.name.trim(),
        phone:     counselForm.phone.trim(),
        email:     counselForm.email.trim(),
        city:      counselForm.city.trim(),
        state:     counselForm.state,
        category:  counselForm.category,
        course:    counselForm.course,
        neetScore: counselForm.neetScore,
        message:   counselForm.message.trim(),
        submittedAt: new Date().toISOString(),
      });
      // fire Meta Pixel Contact event
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Contact");
      }

      setCounselDone(true);
      setCounselForm(blankCounsel);
    } catch (e) {
      setCounselError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCounselLoading(false);
    }
  }

  function closeCounsel() {
    setShowCounsel(false);
    setCounselDone(false);
    setCounselError(null);
  }

  /* ────────────────────────────────────────────────────────── */
  return (
    <div className="brand-shell flex flex-col min-h-screen">

      {/* ══ HEADER ══ */}
      <header className="glass-panel brand-ring sticky top-3 z-30 mx-3 sm:mx-6 mt-3 flex items-center justify-between rounded-full px-4 py-2.5 shadow-lg shadow-slate-900/5 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/brand/logo.png" alt="TAB India" className="h-10 w-auto object-contain flex-shrink-0" />
          <p className="text-sm font-black uppercase tracking-[.3em] text-[#f26430]">NEET 2026</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="tel:+919311483555" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[#123d63] hover:text-[#f26430] transition-colors">
            <span>📞</span> +91 93114 83555
          </a>
          <a
            href="#predictor"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#123d63]/20 bg-white px-4 py-2 text-sm font-bold text-[#123d63] shadow-sm hover:border-[#f26430]/40 hover:text-[#f26430] transition-colors"
          >
            🎯 Predict My Rank
          </a>
          <button onClick={() => setShowCounsel(true)} className="btn-orange px-4 py-2 text-sm rounded-full">
            Free Counselling
          </button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-8 sm:px-6 lg:px-8">

        {/* ── HERO ── */}
        <section className="mb-14">

          {/* MOBILE-ONLY headline — above predictor on small screens */}
          <div className="lg:hidden mb-6 space-y-3">
            <h1 className="headline text-3xl font-black leading-tight text-[#0a2844] sm:text-4xl">
              Know your NEET 2026
              <br />
              <span className="text-[#f26430]">rank in seconds.</span>
            </h1>
            <p className="text-base leading-7 text-slate-600">
              Enter your estimated score and get an instant rank prediction.
            </p>
          </div>

          {/* TWO-COLUMN: logo+headline+pills (left) | predictor (right) */}
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">

            {/* LEFT — logo + desktop headline + pills + counselling */}
            <div className="order-last lg:order-first space-y-6">

              {/* desktop-only headline + subtitle */}
              <div className="hidden lg:block space-y-4">
                <h1 className="headline text-4xl font-black leading-tight text-[#0a2844] xl:text-5xl">
                  Know your NEET 2026
                  <br />
                  <span className="text-[#f26430]">rank in seconds.</span>
                </h1>
                <p className="text-lg leading-8 text-slate-600">
                  Enter your estimated score and get an instant rank prediction. Then book a free
                  counselling session with TAB India experts to plan your next steps.
                </p>
              </div>

              <div className="fade-up-2 grid grid-cols-3 gap-3">
                {[
                  { icon: "🎓", text: "Expert counselling" },
                  { icon: "🏥", text: "Medical college guidance" },
                  { icon: "✅", text: "Completely free" },
                ].map((p) => (
                  <div key={p.text} className="flex flex-col items-center gap-2 rounded-2xl border border-[#123d63]/10 bg-white px-3 py-4 text-center text-xs font-semibold text-[#123d63] shadow-sm">
                    <span className="text-2xl">{p.icon}</span>
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>

              <div className="fade-up-3 floating brand-gradient brand-shadow rounded-[1.75rem] p-5 text-white">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl">🎓</div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.35em] text-white/60">Free Counselling</p>
                    <p className="mt-1.5 text-lg font-bold leading-6">
                      Book a free career counselling session with TAB India experts.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowCounsel(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold hover:bg-white/30 transition-colors"
                      >
                        🗓 Book Free Session
                      </button>
                      <a href="tel:+919311483555" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-colors">
                        📞 Call Us
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — predictor card (first in grid on mobile) */}
            <div className="relative order-first lg:order-last" id="predictor">
              <div className="pointer-events-none absolute -left-6 top-8 h-40 w-40 rounded-full bg-[#f26430]/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-8 -right-4 h-44 w-44 rounded-full bg-[#123d63]/15 blur-3xl" />

              <div className="slide-right brand-shadow glass-panel relative overflow-hidden rounded-[2rem] border border-white/75 p-6 sm:p-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.35em] text-[#f26430]">Live Predictor</p>
                    <h2 className="headline mt-2 text-3xl font-black text-[#0a2844]">Predict My Rank</h2>
                  </div>
                  <div className="rounded-2xl border border-[#123d63]/10 bg-white px-4 py-2.5 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[.25em] text-slate-400">Score Range</p>
                    <p className="headline mt-1 text-xl font-black text-[#123d63]">0 – 720</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[.25em] text-[#123d63]">Estimated NEET Score</span>
                    <div className="rounded-[1.5rem] border border-[#123d63]/12 bg-white p-1.5 shadow-sm focus-within:border-[#f26430] focus-within:shadow-[0_0_0_3px_rgba(242,100,48,.1)] transition-all">
                      <input
                        value={score}
                        onChange={(e) => { setScore(e.target.value); setScoreError(null); }}
                        type="number" min={0} max={720} step={1} placeholder="e.g. 587"
                        className="w-full rounded-[1.1rem] border-0 bg-transparent px-4 py-3.5 text-3xl font-black text-[#0a2844] outline-none placeholder:text-slate-200"
                      />
                    </div>
                  </label>

                  {validScore && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>0</span>
                        <span className="text-[#f26430]">{scoreNum} / 720</span>
                        <span>720</span>
                      </div>
                      <div className="score-bar-track">
                        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <button onClick={openLead} className="btn-orange w-full py-4 text-lg">
                    Get My Rank Prediction →
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                    {["Instant predictions", "Free to use", "Expert counselling"].map((t) => (
                      <div key={t} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#f26430]" />
                        {t}
                      </div>
                    ))}
                  </div>

                  {scoreError && (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {scoreError}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ══ RESULTS ══ */}
        {result && (
          <section ref={resultRef} className="mb-14 fade-up">
            <div className="brand-shadow overflow-hidden rounded-[2rem] border border-[#123d63]/8 bg-white">
              <div className="brand-gradient p-6 text-white sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.35em] text-white/60">Your Prediction</p>
                    <h3 className="headline mt-2 text-3xl font-black sm:text-4xl">
                      Congratulations, {predName}! 🎉
                    </h3>
                    <p className="mt-3 max-w-xl text-base leading-7 text-white/80">
                      Based on the NEET 2026 dataset, here is your estimated rank outlook.
                    </p>
                  </div>
                  <div className="flex-shrink-0 rounded-2xl bg-white/12 px-5 py-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[.25em] text-white/60">Your Score</p>
                    <p className="headline mt-1 text-4xl font-black">{result.inputScore}</p>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#123d63]/6 px-6 py-6 sm:px-8">
                <p className="text-xs font-bold uppercase tracking-[.3em] text-[#f26430]">Estimated Rank Band</p>
                <p className="headline mt-2 text-5xl font-black text-[#0a2844] sm:text-6xl">
                  {fmt(result.predictedFrom)}
                  <span className="mx-3 text-slate-300">–</span>
                  {fmt(result.predictedTo)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {result.exactMatch
                    ? "Your score matched directly in the dataset."
                    : `Your score (${result.inputScore}) wasn't in the dataset — we used the nearest available score of ${result.matchedScore}.`}
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
                {[
                  { label: "Predicted Rank",  value: fmt(result.predictedRank) },
                  { label: "Rank Range",       value: `${fmt(result.predictedFrom)} – ${fmt(result.predictedTo)}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-[#123d63]/8 bg-[#fffdf8] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[.25em] text-slate-400">{item.label}</p>
                    <p className="headline mt-3 text-3xl font-black text-[#0a2844]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="brand-orange-soft-bg border-t border-[#f26430]/12 px-6 py-5 sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-[#0a2844]">Want to know which colleges you can target?</p>
                    <p className="mt-1 text-sm text-slate-600">
                      TAB India counsellors guide you through the entire NEET counselling process — for free.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCounsel(true)}
                    className="btn-orange flex-shrink-0 rounded-2xl px-6 py-3 text-sm text-center"
                  >
                    Book Free Counselling →
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══ WHY TAB INDIA ══ */}
        <section className="mb-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[.35em] text-[#f26430]">Why TAB India</p>
            <h2 className="headline mt-2 text-3xl font-black text-[#0a2844] sm:text-4xl">
              More than just a rank predictor
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🎯", title: "Accurate Predictions",  body: "Powered by real NEET 2026 score–rank data. Smart nearest-score matching ensures every student gets a result." },
              { icon: "🏫", title: "College Guidance",       body: "Our counsellors help you identify the best medical colleges based on your rank, category, and state." },
              { icon: "📞", title: "1-on-1 Counselling",    body: "Book a free session with a TAB India expert. We guide you through every step of NEET counselling." },
            ].map((item) => (
              <article key={item.title} className="story-card rounded-[1.75rem] bg-white p-6 transition-transform hover:-translate-y-1">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e7] text-2xl">{item.icon}</div>
                <p className="headline text-xl font-black text-[#0a2844]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="brand-gradient mt-auto">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4">
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/30 bg-white shadow-sm">
                <img src="/brand/logo.png" alt="TAB India" className="h-full w-full object-contain p-1" />
              </div>
              <p className="max-w-xs text-sm leading-6 text-white/65">
                Expert NEET counselling, rank prediction, and career guidance — helping students
                secure their dream medical college.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[.3em] text-white/45">Contact Us</p>
              <a href="tel:+919311483555" className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
                📞 +91 93114 83555
              </a>
              <p className="text-sm text-white/60">Free counselling & query support.</p>
              <div className="space-y-1 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[.25em] text-white/40">Address</p>
                <p className="text-sm text-white/60">C-190, Vivek Vihar, Delhi</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[.3em] text-white/45">Quick Links</p>
              <a href="#predictor" className="block text-sm text-white/75 hover:text-white transition-colors">→ Rank Predictor</a>
              <button onClick={() => setShowCounsel(true)} className="block text-sm text-white/75 hover:text-white transition-colors text-left">
                → Book Free Counselling
              </button>
            </div>
          </div>
          <div className="my-8 h-px bg-white/12" />
          <div className="flex flex-col gap-2 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} TAB India. All rights reserved.</p>
            <p>NEET 2026 Rank Predictor — Predictions are estimates only.</p>
          </div>
        </div>
      </footer>

      {/* ══ LEAD MODAL ══ */}
      {showLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowLead(false)}>
          <div className="modal-pop brand-shadow w-full max-w-sm overflow-hidden rounded-2xl border border-white/60 bg-white">
            <div className="brand-gradient px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] text-white/55">One Last Step</p>
                  <h3 className="headline mt-1 text-xl font-black">Unlock Your Rank</h3>
                </div>
                <button onClick={() => setShowLead(false)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white text-lg leading-none hover:bg-white/25" aria-label="Close">×</button>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                📊 Score: {score}
              </div>
            </div>
            <form onSubmit={handleLeadSubmit} className="space-y-3 p-4">
              {([
                ["name",  "Full Name *",     "text",  "Your full name",       true],
                ["phone", "Phone Number *",  "tel",   "+91 XXXXX XXXXX",      true],
                ["email", "Email Address",   "email", "you@example.com",      false],
                ["city",  "City",            "text",  "e.g. Delhi, Mumbai",   false],
              ] as const).map(([key, label, type, ph, req]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[#123d63]">{label}</span>
                  <input type={type} required={req} placeholder={ph} value={leadForm[key]}
                    onChange={(e) => setLeadForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="input-field py-2 text-sm" />
                </label>
              ))}
              {leadError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{leadError}</p>}
              <button type="submit" disabled={leadLoading} className="btn-orange w-full py-3 text-sm">
                {leadLoading ? "Calculating…" : "Show My Rank Prediction →"}
              </button>
              <p className="text-center text-[10px] text-slate-400">Used only for counselling purposes.</p>
            </form>
          </div>
        </div>
      )}

      {/* ══ COUNSELLING MODAL ══ */}
      {showCounsel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeCounsel()}>
          <div className="modal-pop brand-shadow w-full max-w-md flex flex-col rounded-2xl border border-white/60 bg-white"
            style={{ maxHeight: "92vh" }}>

            {/* fixed header */}
            <div className="brand-gradient flex-shrink-0 px-5 py-3 text-white rounded-t-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] text-white/55">TAB India</p>
                  <h3 className="headline mt-0.5 text-xl font-black">Book Free Counselling</h3>
                </div>
                <button onClick={closeCounsel} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white text-lg leading-none hover:bg-white/25" aria-label="Close">×</button>
              </div>
            </div>

            {/* scrollable body */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {counselDone ? (
                <div className="p-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
                  <h4 className="headline text-xl font-black text-[#0a2844]">Request Submitted!</h4>
                  <p className="text-sm text-slate-600 leading-6">A TAB India counsellor will contact you within <strong>24 hours</strong>.</p>
                  <p className="text-xs text-slate-500">Urgent? Call <a href="tel:+919311483555" className="font-bold text-[#f26430]">+91 93114 83555</a></p>
                  <button onClick={closeCounsel} className="btn-orange rounded-xl px-8 py-2.5 text-sm">Done</button>
                </div>
              ) : (
                <form onSubmit={handleCounselSubmit} className="p-4 space-y-3">
                  {/* name + phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="field-label">Name <span className="text-[#f26430]">*</span></span>
                      <input type="text" required placeholder="Full name" value={counselForm.name}
                        onChange={(e) => setCounselForm((f) => ({ ...f, name: e.target.value }))}
                        className="input-field py-2 text-sm" />
                    </label>
                    <label className="block space-y-1">
                      <span className="field-label">Phone <span className="text-[#f26430]">*</span></span>
                      <input type="tel" required placeholder="+91 XXXXX" value={counselForm.phone}
                        onChange={(e) => setCounselForm((f) => ({ ...f, phone: e.target.value }))}
                        className="input-field py-2 text-sm" />
                    </label>
                  </div>
                  {/* email */}
                  <label className="block space-y-1">
                    <span className="field-label">Email <span className="text-[#f26430]">*</span></span>
                    <input type="email" required placeholder="you@example.com" value={counselForm.email}
                      onChange={(e) => setCounselForm((f) => ({ ...f, email: e.target.value }))}
                      className="input-field py-2 text-sm" />
                  </label>
                  {/* city + state */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="field-label">City <span className="text-[#f26430]">*</span></span>
                      <input type="text" required placeholder="e.g. Delhi" value={counselForm.city}
                        onChange={(e) => setCounselForm((f) => ({ ...f, city: e.target.value }))}
                        className="input-field py-2 text-sm" />
                    </label>
                    <label className="block space-y-1">
                      <span className="field-label">State <span className="text-[#f26430]">*</span></span>
                      <select required value={counselForm.state}
                        onChange={(e) => setCounselForm((f) => ({ ...f, state: e.target.value }))}
                        className="input-field py-2 text-sm">
                        <option value="">Select</option>
                        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                  {/* category + course */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="field-label">Category <span className="text-[#f26430]">*</span></span>
                      <select required value={counselForm.category}
                        onChange={(e) => setCounselForm((f) => ({ ...f, category: e.target.value }))}
                        className="input-field py-2 text-sm">
                        <option value="">Select</option>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="field-label">Course <span className="text-[#f26430]">*</span></span>
                      <select required value={counselForm.course}
                        onChange={(e) => setCounselForm((f) => ({ ...f, course: e.target.value }))}
                        className="input-field py-2 text-sm">
                        <option value="">Select</option>
                        {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </div>
                  {/* NEET score + message side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="field-label">NEET Score</span>
                      <input type="number" min={0} max={720} placeholder="e.g. 580" value={counselForm.neetScore}
                        onChange={(e) => setCounselForm((f) => ({ ...f, neetScore: e.target.value }))}
                        className="input-field py-2 text-sm" />
                    </label>
                    <label className="block space-y-1">
                      <span className="field-label">Query</span>
                      <input type="text" placeholder="Any question…" value={counselForm.message}
                        onChange={(e) => setCounselForm((f) => ({ ...f, message: e.target.value }))}
                        className="input-field py-2 text-sm" />
                    </label>
                  </div>
                  {counselError && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{counselError}</p>
                  )}
                  <button type="submit" disabled={counselLoading} className="btn-orange w-full py-3 text-sm">
                    {counselLoading ? "Submitting…" : "Submit & Book My Free Session →"}
                  </button>
                  <p className="text-center text-[10px] text-slate-400">Our counsellor will contact you within 24 hours.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
