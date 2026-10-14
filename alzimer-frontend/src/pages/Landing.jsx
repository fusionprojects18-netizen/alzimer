import { useNavigate } from "react-router-dom";
import { Brain, ChevronRight } from "lucide-react";

const STATS = [
  { label: "F1 Score",      value: "90.6%" },
  { label: "AUC-ROC",       value: "94.1%" },
  { label: "Features",      value: "37" },
  { label: "Training size", value: "2,222" },
];

const STEPS = [
  { n: "01", title: "Register",      desc: "Create a patient account and pick your physician." },
  { n: "02", title: "Enter results", desc: "Fill in your clinical values across 5 short steps." },
  { n: "03", title: "Get screened",  desc: "AI predicts risk. Doctor reviews and gives final verdict." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-zinc-900">

      {/* Nav */}
      <nav className="border-b border-zinc-200 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <span className="font-semibold">MindBridge</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/doctor/login")}  className="btn-secondary text-xs px-3 py-1.5">Doctor</button>
            <button onClick={() => navigate("/patient/login")} className="btn-primary  text-xs px-3 py-1.5">Patient Login</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 pt-24 pb-20">
        <p className="text-xs text-indigo-600 font-medium mb-4 tracking-wide">ALZHEIMER'S SCREENING PLATFORM</p>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-5 max-w-2xl">
          Early detection,<br />reviewed by your doctor.
        </h1>
        <p className="text-zinc-500 text-base max-w-xl leading-relaxed mb-8">
          MindBridge uses an XGBoost model trained on 37 clinical markers to assess
          Alzheimer's risk. Every result is reviewed by an assigned physician before
          any verdict is given.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => navigate("/patient/register")} className="btn-primary px-5 py-2.5 text-sm">
            Create patient account <ChevronRight size={15} />
          </button>
          <button onClick={() => navigate("/patient/login")} className="btn-secondary px-5 py-2.5 text-sm">
            Sign in
          </button>
        </div>
      </section>

      {/* Stats row */}
      <section className="border-t border-b border-zinc-200 py-8">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <p className="text-xs text-zinc-400 font-medium mb-8 tracking-wide">HOW IT WORKS</p>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="text-xs font-mono text-zinc-400 mb-3 block">{s.n}</span>
              <h3 className="font-medium mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-5 text-center text-xs text-zinc-400">
        MindBridge · For clinical screening only · Always consult a licensed physician
      </footer>
    </div>
  );
}
