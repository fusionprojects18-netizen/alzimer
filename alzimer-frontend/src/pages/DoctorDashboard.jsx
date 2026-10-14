import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, LogOut, AlertTriangle, CheckCircle, Clock, X, Loader2, ScanLine } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { useAuth } from "../context/AuthContext";
import { fetchDoctorSubmissions, fetchSubmissionDetail, saveReview } from "../api/api";

const MRI_SEVERITY_COLOR = {
  None:       "#10b981",
  "Very Mild":"#f59e0b",
  Mild:       "#f97316",
  Moderate:   "#ef4444",
};

const getRisk = (r) => {
  if (!r) return { color: "#71717a", label: "—" };
  if (r.includes("Low"))      return { color: "#10b981", label: "Low" };
  if (r.includes("Moderate")) return { color: "#f59e0b", label: "Moderate" };
  return                             { color: "#ef4444", label: "High" };
};

const RiskBadge = ({ risk }) => {
  if (!risk) return <span className="badge-pending">—</span>;
  if (risk.includes("Low"))      return <span className="badge-low">Low</span>;
  if (risk.includes("Moderate")) return <span className="badge-moderate">Moderate</span>;
  return <span className="badge-high">High</span>;
};

const VerdictBadge = ({ verdict }) => {
  if (!verdict) return <span className="badge-pending"><Clock size={10} />Pending</span>;
  if (verdict === "Negative") return <span className="badge-low"><CheckCircle size={10} />{verdict}</span>;
  if (verdict === "Positive") return <span className="badge-high"><AlertTriangle size={10} />{verdict}</span>;
  return <span className="badge-moderate">{verdict}</span>;
};

const formatDate = (ts) => ts?.seconds
  ? new Date(ts.seconds * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
  : "—";

const Row = ({ l, v }) => (
  <>
    <span className="text-xs text-zinc-500">{l}</span>
    <span className="text-xs text-zinc-800 font-medium text-right">{v}</span>
  </>
);

const DataSection = ({ title, children }) => (
  <div className="card p-4">
    <p className="text-xs text-zinc-500 mb-3 pb-2 border-b border-zinc-100">{title}</p>
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
  </div>
);

function DetailPanel({ submissionId, onClose, onReviewed }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState("");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSubmissionDetail(submissionId)
      .then(({ data }) => {
        setData(data);
        if (data.doctorVerdict) setVerdict(data.doctorVerdict);
        if (data.doctorNotes)   setNotes(data.doctorNotes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleSave = async () => {
    if (!verdict) { setError("Select a verdict."); return; }
    setError(""); setSaving(true);
    try {
      await saveReview(submissionId, { verdict, notes });
      setSuccess(true);
      onReviewed();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const fd   = data?.formData;
  const prob = data ? data.probability * 100 : 0;
  const cfg  = getRisk(data?.riskLevel);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white border-l border-zinc-200 overflow-y-auto flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div>
            <p className="font-medium text-zinc-900">{data?.patientName || "Patient"}</p>
            <p className="text-xs text-zinc-500">{data?.patientEmail}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 px-5 py-5 space-y-5">

            <div className="card p-4">
              <p className="text-xs text-zinc-500 mb-3">AI prediction</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="70%" outerRadius="100%"
                      data={[{ value: prob, fill: cfg.color }]} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={5} background={{ fill: "#e4e4e7" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-2xl font-semibold" style={{ color: cfg.color }}>{prob.toFixed(1)}%</p>
                  <RiskBadge risk={data.riskLevel} />
                  <p className="text-xs text-zinc-500 mt-1">{data.prediction === 1 ? "Positive" : "Negative"} · {formatDate(data.submittedAt)}</p>
                </div>
              </div>
            </div>

            {fd && (
              <>
                <DataSection title="Demographics">
                  <Row l="Age"       v={fd.Age} />
                  <Row l="Gender"    v={fd.Gender === 0 ? "Male" : "Female"} />
                  <Row l="Ethnicity" v={["Caucasian","African American","Asian","Other"][fd.Ethnicity]} />
                  <Row l="Education" v={["None","High School","Bachelor's","Higher"][fd.EducationLevel]} />
                </DataSection>
                <DataSection title="Lifestyle">
                  <Row l="BMI"               v={fd.BMI} />
                  <Row l="Smoking"           v={fd.Smoking ? "Yes" : "No"} />
                  <Row l="Alcohol"           v={`${fd.AlcoholConsumption} u/wk`} />
                  <Row l="Physical activity" v={`${fd.PhysicalActivity} hrs/wk`} />
                  <Row l="Diet quality"      v={`${fd.DietQuality}/10`} />
                  <Row l="Sleep quality"     v={`${fd.SleepQuality}/10`} />
                </DataSection>
                <DataSection title="Medical history">
                  <Row l="Family history"    v={fd.FamilyHistoryAlzheimers ? "Yes" : "No"} />
                  <Row l="Cardiovascular"    v={fd.CardiovascularDisease   ? "Yes" : "No"} />
                  <Row l="Diabetes"          v={fd.Diabetes                ? "Yes" : "No"} />
                  <Row l="Depression"        v={fd.Depression              ? "Yes" : "No"} />
                  <Row l="Head injury"       v={fd.HeadInjury              ? "Yes" : "No"} />
                  <Row l="Hypertension"      v={fd.Hypertension            ? "Yes" : "No"} />
                  <Row l="Systolic BP"       v={`${fd.SystolicBP} mmHg`} />
                  <Row l="Diastolic BP"      v={`${fd.DiastolicBP} mmHg`} />
                  <Row l="Total cholesterol" v={`${fd.CholesterolTotal} mg/dL`} />
                  <Row l="LDL"               v={`${fd.CholesterolLDL} mg/dL`} />
                  <Row l="HDL"               v={`${fd.CholesterolHDL} mg/dL`} />
                  <Row l="Triglycerides"     v={`${fd.CholesterolTriglycerides} mg/dL`} />
                </DataSection>
                <DataSection title="Cognitive & behavioral">
                  <Row l="MMSE"             v={`${fd.MMSE}/30`} />
                  <Row l="Functional"       v={`${fd.FunctionalAssessment}/10`} />
                  <Row l="ADL"              v={`${fd.ADL}/10`} />
                  <Row l="Memory complaints" v={fd.MemoryComplaints          ? "Yes" : "No"} />
                  <Row l="Behavioral probs"  v={fd.BehavioralProblems        ? "Yes" : "No"} />
                  <Row l="Confusion"         v={fd.Confusion                 ? "Yes" : "No"} />
                  <Row l="Disorientation"    v={fd.Disorientation            ? "Yes" : "No"} />
                  <Row l="Personality chgs"  v={fd.PersonalityChanges        ? "Yes" : "No"} />
                  <Row l="Task difficulty"   v={fd.DifficultyCompletingTasks ? "Yes" : "No"} />
                  <Row l="Forgetfulness"     v={fd.Forgetfulness             ? "Yes" : "No"} />
                </DataSection>
              </>
            )}

            <div className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <ScanLine size={15} className="text-indigo-600" />
                  <p className="text-sm font-medium">MRI scan</p>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                {data.mriPrediction
                  ? "Patient has uploaded a scan."
                  : "No MRI scan uploaded for this screening (optional)."}
              </p>

              {data.mriPrediction && (
                <div className="pt-3 border-t border-zinc-100 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Classification</p>
                      <p className="text-sm font-semibold" style={{ color: MRI_SEVERITY_COLOR[data.mriPrediction.severity] }}>
                        {data.mriPrediction.predicted_class}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: MRI_SEVERITY_COLOR[data.mriPrediction.severity] + "22",
                        color: MRI_SEVERITY_COLOR[data.mriPrediction.severity],
                      }}
                    >
                      {(data.mriPrediction.confidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(data.mriPrediction.class_probabilities)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cls, prob]) => (
                        <div key={cls}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-600">{cls}</span>
                            <span className="text-zinc-400">{(prob * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${prob * 100}%`,
                                backgroundColor: cls === data.mriPrediction.predicted_class
                                  ? MRI_SEVERITY_COLOR[data.mriPrediction.severity]
                                  : "#a1a1aa",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {!success ? (
              <div className="card p-4">
                <p className="text-xs text-zinc-500 mb-3">Your verdict</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {["Negative", "Positive", "Inconclusive"].map((v) => (
                    <button key={v} type="button" onClick={() => setVerdict(v)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors
                        ${verdict === v
                          ? v === "Negative" ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : v === "Positive" ? "border-red-500 bg-red-50 text-red-700"
                          :                    "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                      {v}
                    </button>
                  ))}
                </div>

                <label className="input-label">Clinical notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="input resize-none h-24 text-sm"
                  placeholder="Add observations, treatment plan, or recommendations…" />

                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-3">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : "Save review"}
                </button>
              </div>
            ) : (
              <div className="card p-5 text-center border border-emerald-200">
                <CheckCircle size={24} className="text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-sm">Review saved</p>
                <p className="text-xs text-zinc-500 mt-1">Patient has been notified.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [selectedId, setSelectedId]   = useState(null);

  const load = () => {
    fetchDoctorSubmissions()
      .then(({ data }) => setSubmissions(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = submissions.filter((s) => {
    if (filter === "pending")  return !s.doctorVerdict;
    if (filter === "reviewed") return !!s.doctorVerdict;
    return true;
  });

  const pendingCount  = submissions.filter((s) => !s.doctorVerdict).length;
  const reviewedCount = submissions.filter((s) => !!s.doctorVerdict).length;
  const highRiskCount = submissions.filter((s) => s.riskLevel?.includes("High")).length;

  return (
    <div className="min-h-screen bg-white text-zinc-900">

      <nav className="border-b border-zinc-200 px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center">
              <Stethoscope size={14} className="text-white" />
            </div>
            <span className="font-semibold">MindBridge</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200 ml-1">Doctor</span>
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

        <div className="mb-8">
          <h1 className="text-xl font-semibold">Patient submissions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {user?.specialization && `${user.specialization} · `}{user?.hospital}
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <div className="card p-4">
            <p className="text-xs text-zinc-500 mb-1">Pending review</p>
            <p className="text-2xl font-semibold text-amber-600">{pendingCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-zinc-500 mb-1">Reviewed</p>
            <p className="text-2xl font-semibold text-emerald-600">{reviewedCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-zinc-500 mb-1">High risk</p>
            <p className="text-2xl font-semibold text-red-600">{highRiskCount}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 mb-5 border-b border-zinc-200">
          {["all", "pending", "reviewed"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors
                ${filter === f
                  ? "border-indigo-600 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-zinc-500 text-sm">No submissions in this category.</p>
          </div>
        ) : (
          <div className="card divide-y divide-zinc-100">
            {filtered.map((s) => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors text-left">
                <div className="w-1.5 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: getRisk(s.riskLevel).color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{s.patientName || "Patient"}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {(s.probability * 100).toFixed(1)}% · {s.patientEmail}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RiskBadge risk={s.riskLevel} />
                  <VerdictBadge verdict={s.doctorVerdict} />
                  {s.mriPrediction && (
                    <span className="badge-moderate"><ScanLine size={10} />MRI ready</span>
                  )}
                  <span className="text-xs text-zinc-400 hidden sm:block">{formatDate(s.submittedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selectedId && (
        <DetailPanel submissionId={selectedId} onClose={() => setSelectedId(null)} onReviewed={load} />
      )}
    </div>
  );
}
