import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Plus, LogOut, AlertTriangle, CheckCircle, Clock, ChevronRight, Activity, ScanLine } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchMySubmissions } from "../api/api";

const RiskBadge = ({ risk }) => {
  if (!risk) return <span className="badge-pending">—</span>;
  if (risk.includes("Low"))      return <span className="badge-low">Low Risk</span>;
  if (risk.includes("Moderate")) return <span className="badge-moderate">Moderate Risk</span>;
  return <span className="badge-high">High Risk</span>;
};

const VerdictBadge = ({ verdict }) => {
  if (!verdict) return <span className="badge-pending"><Clock size={10} />Awaiting Review</span>;
  if (verdict === "Negative")  return <span className="badge-low"><CheckCircle size={10} />No Alzheimer's</span>;
  if (verdict === "Positive")  return <span className="badge-high"><AlertTriangle size={10} />Detected</span>;
  return <span className="badge-moderate">Inconclusive</span>;
};

const formatDate = (ts) =>
  ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMySubmissions()
      .then(({ data }) => setSubmissions(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const latest = submissions[0];

  return (
    <div className="min-h-screen bg-white text-zinc-900">

      <nav className="border-b border-zinc-200 px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <span className="font-semibold">MindBridge</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 hidden sm:block">{user?.fullName}</span>
            <button onClick={() => { logout(); navigate("/"); }} className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">My screenings</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Hi, {user?.fullName?.split(" ")[0]}</p>
          </div>
          <button onClick={() => navigate("/patient/test")} className="btn-primary gap-1.5">
            <Plus size={15} /> New Screening
          </button>
        </div>

        {latest && (
          <div className="grid sm:grid-cols-3 gap-3 mb-8">
            <div className="card p-4">
              <p className="text-xs text-zinc-500 mb-2">Latest AI result</p>
              <RiskBadge risk={latest.riskLevel} />
              <p className="text-2xl font-semibold mt-2">{(latest.probability * 100).toFixed(1)}%</p>
              <p className="text-xs text-zinc-500">probability</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-zinc-500 mb-2">Doctor verdict</p>
              <VerdictBadge verdict={latest.doctorVerdict} />
              {latest.doctorName && <p className="text-xs text-zinc-500 mt-2">{latest.doctorName}</p>}
            </div>
            <div className="card p-4">
              <p className="text-xs text-zinc-500 mb-2">Total screenings</p>
              <p className="text-2xl font-semibold">{submissions.length}</p>
              <p className="text-xs text-zinc-500">all time</p>
            </div>
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-4">
              <Activity size={20} className="text-zinc-400" />
            </div>
            <h3 className="font-medium mb-1">No screenings yet</h3>
            <p className="text-sm text-zinc-500 mb-5 max-w-xs mx-auto">
              Start your first Alzheimer's screening to get an AI-powered risk assessment.
            </p>
            <button onClick={() => navigate("/patient/test")} className="btn-primary">
              <Plus size={15} /> Start screening
            </button>
          </div>
        )}

        {submissions.length > 0 && (
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-3 tracking-wide">HISTORY</p>
            <div className="card divide-y divide-zinc-100">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RiskBadge risk={s.riskLevel} />
                      <VerdictBadge verdict={s.doctorVerdict} />
                      {s.mriPrediction && (
                        <span className="badge-moderate"><ScanLine size={10} />MRI uploaded</span>
                      )}
                    </div>
                    <p className="text-sm mt-1.5">{(s.probability * 100).toFixed(1)}% probability</p>
                    {s.doctorName && <p className="text-xs text-zinc-400 mt-0.5">{s.doctorName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400">{formatDate(s.submittedAt)}</p>
                    {(s.doctorNotes || !s.mriPrediction) && (
                      <button onClick={() => navigate("/patient/results", { state: { submission: s } })}
                        className="text-xs text-indigo-600 hover:text-indigo-500 flex items-center gap-0.5 mt-1.5 ml-auto transition-colors">
                        {!s.mriPrediction ? "Upload MRI scan" : "View notes"} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
}
