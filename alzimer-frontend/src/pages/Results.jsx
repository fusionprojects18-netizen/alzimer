import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brain, AlertTriangle, CheckCircle, Clock, ArrowLeft, LayoutDashboard, FileText, ScanLine, ImageIcon, X, Loader2 } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { predictMRI, saveMriResult } from "../api/api";

const SEVERITY_COLOR = {
  None:       "#10b981",
  "Very Mild":"#f59e0b",
  Mild:       "#f97316",
  Moderate:   "#ef4444",
};

const getRiskConfig = (risk) => {
  if (!risk) return { color: "#71717a", label: "Unknown" };
  if (risk.includes("Low"))      return { color: "#10b981", label: "Low Risk" };
  if (risk.includes("Moderate")) return { color: "#f59e0b", label: "Moderate Risk" };
  return                                { color: "#ef4444", label: "High Risk" };
};

function MriUploadCard({ submissionId, onSaved }) {
  const fileRef = useRef(null);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError]       = useState("");

  const handleSelect = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleSelect(f);
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setError("");
  };

  const handleAnalyseAndSave = async () => {
    if (!file) return;
    setAnalysing(true);
    setError("");
    try {
      const { data: mriPrediction } = await predictMRI(file);
      await saveMriResult(submissionId, mriPrediction);
      onSaved(mriPrediction);
    } catch {
      setError("MRI analysis failed. Please check the server and try again.");
    } finally {
      setAnalysing(false);
    }
  };

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ScanLine size={15} className="text-indigo-600" />
        <p className="text-sm font-medium">Upload MRI scan</p>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Optional — if you have a brain MRI scan, upload it here for additional AI-powered dementia classification.
      </p>

      {!preview ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-zinc-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-400 transition-colors group"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
            <ImageIcon size={22} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-700">Click or drag to upload MRI scan</p>
            <p className="text-xs text-zinc-400 mt-1">JPEG or PNG · brain MRI only</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) handleSelect(f); }} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 flex items-center justify-center" style={{ height: 200 }}>
            <img src={preview} alt="MRI scan" className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={handleClear}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors">
              <X size={13} />
            </button>
          </div>
          <button type="button" onClick={handleAnalyseAndSave} disabled={analysing} className="btn-primary w-full gap-2 justify-center">
            {analysing ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
            {analysing ? "Analysing MRI scan..." : "Analyse & submit scan"}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const navigate  = useNavigate();
  const { state } = useLocation();

  const raw        = state?.prediction;
  const submission = state?.submission;
  const [mriResult, setMriResult] = useState(state?.mriResult ?? submission?.mriPrediction ?? null);

  useEffect(() => {
    if (!raw && !submission) navigate("/patient/dashboard");
  }, [raw, submission, navigate]);

  if (!raw && !submission) return null;

  const data = raw
    ? {
        predictionValue: raw.prediction,
        probability:     raw.probability,
        riskLevel:       raw.risk_level,
        diagnosis:       raw.diagnosis,
        thresholdUsed:   raw.threshold_used,
        doctorVerdict:   null,
        doctorNotes:     null,
        isHistorical:    false,
      }
    : {
        predictionValue: submission.prediction,
        probability:     submission.probability,
        riskLevel:       submission.riskLevel,
        diagnosis:       submission.prediction === 1 ? "Alzheimer's Positive" : "No Alzheimer's Detected",
        thresholdUsed:   null,
        doctorVerdict:   submission.doctorVerdict,
        doctorNotes:     submission.doctorNotes,
        isHistorical:    true,
      };

  const prob       = data.probability * 100;
  const config     = getRiskConfig(data.riskLevel);
  const isPositive = data.predictionValue === 1;

  return (
    <div className="min-h-screen bg-white text-zinc-900">

      <nav className="border-b border-zinc-200 px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <span className="font-semibold">MindBridge</span>
            <span className="text-zinc-300 mx-1">/</span>
            <span className="text-sm text-zinc-500">{data.isHistorical ? "Screening detail" : "Result"}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-10">

        {/* Primary result card */}
        <div className="card p-8 mb-4 border-l-4" style={{ borderLeftColor: config.color }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="72%" outerRadius="100%"
                  data={[{ value: prob, fill: config.color }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#e4e4e7" }} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-2">{data.isHistorical ? "Historical result" : "AI prediction"}</p>
              <h1 className="text-2xl font-semibold mb-1">{data.diagnosis}</h1>
              <p className="text-sm font-medium mb-3" style={{ color: config.color }}>{config.label}</p>
              <p className="text-3xl font-bold" style={{ color: config.color }}>{prob.toFixed(1)}%</p>
              <p className="text-xs text-zinc-500">probability score</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="card p-4">
            <p className="text-xs text-zinc-500 mb-1.5">AI verdict</p>
            <div className="flex items-center gap-2">
              {isPositive
                ? <AlertTriangle size={16} className="text-red-500" />
                : <CheckCircle  size={16} className="text-emerald-500" />}
              <span className="font-medium">{isPositive ? "Positive" : "Negative"}</span>
            </div>
            {data.thresholdUsed != null && (
              <p className="text-xs text-zinc-400 mt-1">Threshold: {(data.thresholdUsed * 100).toFixed(0)}%</p>
            )}
          </div>

          <div className="card p-4">
            <p className="text-xs text-zinc-500 mb-1.5">Doctor review</p>
            {data.doctorVerdict ? (
              <div className="flex items-center gap-2">
                {data.doctorVerdict === "Negative"
                  ? <CheckCircle  size={16} className="text-emerald-500" />
                  : data.doctorVerdict === "Positive"
                  ? <AlertTriangle size={16} className="text-red-500" />
                  : <Clock size={16} className="text-amber-500" />}
                <span className="font-medium">{data.doctorVerdict}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500">
                <Clock size={16} />
                <span className="text-sm">Awaiting review</span>
              </div>
            )}
          </div>
        </div>

        {/* Doctor notes */}
        {data.doctorNotes && (
          <div className="card p-5 mb-4 flex gap-3">
            <FileText size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Doctor's notes</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{data.doctorNotes}</p>
            </div>
          </div>
        )}

        {/* MRI upload prompt (optional, shown whenever no scan has been uploaded yet) */}
        {data.isHistorical && !mriResult && (
          <MriUploadCard submissionId={submission.id} onSaved={setMriResult} />
        )}

        {/* MRI scan result */}
        {mriResult && (
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <ScanLine size={15} className="text-indigo-600" />
              <p className="text-sm font-medium">MRI scan analysis</p>
            </div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Classification</p>
                <p className="text-base font-semibold" style={{ color: SEVERITY_COLOR[mriResult.severity] }}>
                  {mriResult.predicted_class}
                </p>
              </div>
              <span
                className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: SEVERITY_COLOR[mriResult.severity] + "22",
                  color: SEVERITY_COLOR[mriResult.severity],
                }}
              >
                {mriResult.severity !== "None" ? `${mriResult.severity} severity` : "No dementia"} &middot; {(mriResult.confidence * 100).toFixed(1)}% confidence
              </span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(mriResult.class_probabilities)
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
                          backgroundColor: cls === mriResult.predicted_class
                            ? SEVERITY_COLOR[mriResult.severity]
                            : "#a1a1aa",
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!data.doctorVerdict && (
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            This is an AI screening result only — not a clinical diagnosis. Your assigned doctor will review the prediction and all submitted values before providing a final verdict.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/patient/test")} className="btn-secondary gap-1.5">
            <ArrowLeft size={14} /> New screening
          </button>
          <button onClick={() => navigate("/patient/dashboard")} className="btn-primary gap-1.5">
            <LayoutDashboard size={14} /> Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
