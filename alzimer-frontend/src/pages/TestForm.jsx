import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, ChevronRight, ChevronLeft, Loader2, Check, Database, ScanLine, ImageIcon, X } from "lucide-react";
import { fetchDoctors, predictAlzheimer, saveSubmission, fetchPatientRecord, predictMRI, saveMriResult } from "../api/api";

const STEPS = ["Demographics", "Lifestyle", "Medical", "Cognitive", "Doctor"];

const initialForm = {
  Age: 65, Gender: 0, Ethnicity: 0, EducationLevel: 1,
  BMI: 25.0, Smoking: 0, AlcoholConsumption: 5.0, PhysicalActivity: 5.0, DietQuality: 5.0, SleepQuality: 7.0,
  FamilyHistoryAlzheimers: 0, CardiovascularDisease: 0, Diabetes: 0,
  Depression: 0, HeadInjury: 0, Hypertension: 0,
  SystolicBP: 120, DiastolicBP: 80,
  CholesterolTotal: 200.0, CholesterolLDL: 130.0, CholesterolHDL: 50.0, CholesterolTriglycerides: 150.0,
  MMSE: 26.0, FunctionalAssessment: 8.0, ADL: 8.0,
  MemoryComplaints: 0, BehavioralProblems: 0, Confusion: 0,
  Disorientation: 0, PersonalityChanges: 0, DifficultyCompletingTasks: 0, Forgetfulness: 0,
};

const Slider = ({ label, name, min, max, step = 1, value, onChange, hint }) => (
  <div>
    <div className="flex justify-between items-baseline mb-1.5">
      <label className="input-label">{label}</label>
      <span className="text-sm font-medium text-indigo-600">{value}</span>
    </div>
    <input type="range" name={name} min={min} max={max} step={step} value={value} onChange={onChange}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-200 accent-indigo-600" />
    {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
  </div>
);

const Toggle = ({ label, name, value, onChange, hint }) => (
  <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
    <div>
      <p className="text-sm text-zinc-800">{label}</p>
      {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
    </div>
    <button type="button"
      onClick={() => onChange({ target: { name, value: value === 1 ? 0 : 1 } })}
      className={`relative flex-shrink-0 ml-4 rounded-full transition-colors duration-150
        ${value ? "bg-indigo-600" : "bg-zinc-300"}`}
      style={{ height: "22px", width: "40px" }}>
      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150
        ${value ? "translate-x-[18px]" : "translate-x-0"}`} />
    </button>
  </div>
);

const Select = ({ label, name, value, onChange, options }) => (
  <div>
    <label className="input-label">{label}</label>
    <select name={name} value={value} onChange={onChange} className="input">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const NumInput = ({ label, name, value, onChange, min, max, step, unit }) => (
  <div>
    <label className="input-label">{label}{unit && <span className="text-zinc-400 ml-1">({unit})</span>}</label>
    <input type="number" name={name} value={value} onChange={onChange}
      min={min} max={max} step={step} className="input" />
  </div>
);

function StepDemographics({ form, onChange }) {
  return (
    <div className="space-y-5">
      <Slider label="Age" name="Age" min={60} max={90} value={form.Age} onChange={onChange} hint="60–90 years" />
      <Select label="Gender" name="Gender" value={form.Gender} onChange={onChange}
        options={[{ value: 0, label: "Male" }, { value: 1, label: "Female" }]} />
      <Select label="Ethnicity" name="Ethnicity" value={form.Ethnicity} onChange={onChange}
        options={[{ value: 0, label: "Caucasian" }, { value: 1, label: "African American" }, { value: 2, label: "Asian" }, { value: 3, label: "Other" }]} />
      <Select label="Education level" name="EducationLevel" value={form.EducationLevel} onChange={onChange}
        options={[{ value: 0, label: "None" }, { value: 1, label: "High School" }, { value: 2, label: "Bachelor's" }, { value: 3, label: "Higher" }]} />
    </div>
  );
}

function StepLifestyle({ form, onChange }) {
  return (
    <div className="space-y-5">
      <Slider label="BMI" name="BMI" min={15} max={40} step={0.1} value={form.BMI} onChange={onChange} hint="Body Mass Index" />
      <Slider label="Alcohol consumption" name="AlcoholConsumption" min={0} max={20} step={0.5} value={form.AlcoholConsumption} onChange={onChange} hint="Units per week (0–20)" />
      <Slider label="Physical activity" name="PhysicalActivity" min={0} max={10} step={0.5} value={form.PhysicalActivity} onChange={onChange} hint="Hours per week (0–10)" />
      <Slider label="Diet quality" name="DietQuality" min={0} max={10} step={0.5} value={form.DietQuality} onChange={onChange} hint="0 = poor, 10 = excellent" />
      <Slider label="Sleep quality" name="SleepQuality" min={4} max={10} step={0.5} value={form.SleepQuality} onChange={onChange} hint="4 = poor, 10 = excellent" />
      <div className="card p-4">
        <Toggle label="Smoking" name="Smoking" value={form.Smoking} onChange={onChange} hint="Current or past smoker" />
      </div>
    </div>
  );
}

function StepMedical({ form, onChange }) {
  return (
    <div className="space-y-5">
      <div className="card p-4">
        <p className="text-xs text-zinc-400 mb-1 pb-2 border-b border-zinc-100">Medical conditions</p>
        <Toggle label="Family history of Alzheimer's" name="FamilyHistoryAlzheimers" value={form.FamilyHistoryAlzheimers} onChange={onChange} />
        <Toggle label="Cardiovascular disease" name="CardiovascularDisease" value={form.CardiovascularDisease} onChange={onChange} />
        <Toggle label="Diabetes" name="Diabetes" value={form.Diabetes} onChange={onChange} />
        <Toggle label="Depression" name="Depression" value={form.Depression} onChange={onChange} />
        <Toggle label="Head injury" name="HeadInjury" value={form.HeadInjury} onChange={onChange} hint="History of TBI" />
        <Toggle label="Hypertension" name="Hypertension" value={form.Hypertension} onChange={onChange} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumInput label="Systolic BP" name="SystolicBP" value={form.SystolicBP} onChange={onChange} min={90} max={200} unit="mmHg" />
        <NumInput label="Diastolic BP" name="DiastolicBP" value={form.DiastolicBP} onChange={onChange} min={60} max={130} unit="mmHg" />
        <NumInput label="Total cholesterol" name="CholesterolTotal" value={form.CholesterolTotal} onChange={onChange} step="0.1" unit="mg/dL" />
        <NumInput label="LDL cholesterol" name="CholesterolLDL" value={form.CholesterolLDL} onChange={onChange} step="0.1" unit="mg/dL" />
        <NumInput label="HDL cholesterol" name="CholesterolHDL" value={form.CholesterolHDL} onChange={onChange} step="0.1" unit="mg/dL" />
        <NumInput label="Triglycerides" name="CholesterolTriglycerides" value={form.CholesterolTriglycerides} onChange={onChange} step="0.1" unit="mg/dL" />
      </div>
    </div>
  );
}

function StepCognitive({ form, onChange }) {
  return (
    <div className="space-y-5">
      <Slider label="MMSE score" name="MMSE" min={0} max={30} step={0.5} value={form.MMSE} onChange={onChange} hint="Mini-Mental State Exam (0–30). ≤24 may indicate impairment." />
      <Slider label="Functional assessment" name="FunctionalAssessment" min={0} max={10} step={0.5} value={form.FunctionalAssessment} onChange={onChange} hint="Ability to perform daily tasks (0–10)" />
      <Slider label="ADL score" name="ADL" min={0} max={10} step={0.5} value={form.ADL} onChange={onChange} hint="Activities of Daily Living (0–10)" />
      <div className="card p-4">
        <p className="text-xs text-zinc-400 mb-1 pb-2 border-b border-zinc-100">Behavioral symptoms</p>
        <Toggle label="Memory complaints" name="MemoryComplaints" value={form.MemoryComplaints} onChange={onChange} />
        <Toggle label="Behavioral problems" name="BehavioralProblems" value={form.BehavioralProblems} onChange={onChange} />
        <Toggle label="Confusion" name="Confusion" value={form.Confusion} onChange={onChange} />
        <Toggle label="Disorientation" name="Disorientation" value={form.Disorientation} onChange={onChange} />
        <Toggle label="Personality changes" name="PersonalityChanges" value={form.PersonalityChanges} onChange={onChange} />
        <Toggle label="Difficulty completing tasks" name="DifficultyCompletingTasks" value={form.DifficultyCompletingTasks} onChange={onChange} />
        <Toggle label="Forgetfulness" name="Forgetfulness" value={form.Forgetfulness} onChange={onChange} />
      </div>
    </div>
  );
}

function StepDoctor({ doctors, doctorId, setDoctorId, loadingDoctors }) {
  if (loadingDoctors) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500 mb-4">Select the physician who will review your results.</p>
      {doctors.map((d) => (
        <button key={d.id} type="button" onClick={() => setDoctorId(d.id)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left
            ${doctorId === d.id
              ? "border-indigo-600 bg-indigo-50"
              : "border-zinc-200 hover:border-zinc-300"}`}>
          <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
            <span className="text-sm font-medium text-indigo-600">{d.fullName.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900">{d.fullName}</p>
            <p className="text-xs text-zinc-500">{d.specialization}{d.hospital ? ` · ${d.hospital}` : ""}</p>
          </div>
          {doctorId === d.id && <Check size={16} className="text-indigo-600 shrink-0" />}
        </button>
      ))}
    </div>
  );
}

function DatasetLookup({ onFetched }) {
  const [recordNumber, setRecordNumber] = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [loaded, setLoaded]             = useState(null);

  const handleFetch = async () => {
    if (!recordNumber) return;
    setLoading(true); setError(""); setLoaded(null);
    try {
      const { data } = await fetchPatientRecord(recordNumber);
      onFetched(data.data);
      setLoaded({ patientId: data.patientId, diagnosis: data.diagnosis });
    } catch (err) {
      setError(err.response?.data?.detail || "Record not found.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 mb-6 flex items-center gap-3 flex-wrap">
      <Database size={15} className="text-indigo-600 shrink-0" />
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium">Autofill from dataset</p>
        <p className="text-xs text-zinc-500">Enter a PatientID or row number to load its clinical data.</p>
      </div>
      <input type="number" value={recordNumber} onChange={(e) => setRecordNumber(e.target.value)}
        placeholder="e.g. 4751" className="input w-32" />
      <button type="button" onClick={handleFetch} disabled={loading || !recordNumber} className="btn-secondary">
        {loading ? <Loader2 size={15} className="animate-spin" /> : "Fetch"}
      </button>
      {loaded && (
        <p className="w-full text-xs text-emerald-600">
          Loaded record #{loaded.patientId} (Diagnosis: {loaded.diagnosis === 1 ? "Positive" : "Negative"}) — fields below have been filled in.
        </p>
      )}
      {error && <p className="w-full text-xs text-red-500">{error}</p>}
    </div>
  );
}

function MriDialog({ onSkip, onSubmit, submitting }) {
  const fileRef = useRef(null);
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);

  const handleSelect = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); };
  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleSelect(f);
  };
  const handleClear = () => { setFile(null); setPreview(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <ScanLine size={16} className="text-indigo-600" />
          <h3 className="font-semibold">Add MRI scan</h3>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Optional — if you have a brain MRI scan, upload it now for additional AI analysis. You can skip this and add one later.
        </p>

        {!preview ? (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-400 transition-colors group mb-4"
          >
            <ImageIcon size={20} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
            <p className="text-sm text-zinc-600">Click or drag to upload</p>
            <p className="text-xs text-zinc-400">JPEG or PNG</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg" className="hidden"
              onChange={(e) => { const f = e.target.files[0]; if (f) handleSelect(f); }} />
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 flex items-center justify-center mb-4" style={{ height: 160 }}>
            <img src={preview} alt="MRI scan" className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={handleClear}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={onSkip} disabled={submitting} className="btn-secondary flex-1 justify-center">
            Skip
          </button>
          <button type="button" onClick={() => onSubmit(file)} disabled={submitting} className="btn-primary flex-1 gap-1.5 justify-center">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : (file ? "Add scan & submit" : "Submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestForm() {
  const navigate = useNavigate();
  const [step, setStep]               = useState(0);
  const [form, setForm]               = useState(initialForm);
  const [doctors, setDoctors]         = useState([]);
  const [doctorId, setDoctorId]       = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [showMriDialog, setShowMriDialog] = useState(false);

  useEffect(() => {
    fetchDoctors()
      .then(({ data }) => setDoctors(data))
      .catch(console.error)
      .finally(() => setLoadingDoctors(false));
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: isNaN(value) ? value : Number(value) }));
  };

  const finalizeSubmit = async (mriFile) => {
    if (!doctorId) { setError("Please select a doctor."); return; }
    setError(""); setSubmitting(true);
    try {
      const { data: prediction } = await predictAlzheimer(form);
      const { data: saved }      = await saveSubmission({
        doctorId,
        formData: form,
        prediction,
      });

      let mriResult = null;
      if (mriFile) {
        try {
          const { data: mriPrediction } = await predictMRI(mriFile);
          await saveMriResult(saved.id, mriPrediction);
          mriResult = mriPrediction;
        } catch {
          // MRI scan is optional — don't block the main result if analysis fails.
        }
      }

      setShowMriDialog(false);
      navigate("/patient/results", { state: { prediction, submissionId: saved.id, mriResult } });
    } catch (err) {
      setShowMriDialog(false);
      setError(err.response?.data?.detail || err.response?.data?.error || "Submission failed. Check that both servers are running.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepContent = [
    <StepDemographics form={form} onChange={onChange} />,
    <StepLifestyle    form={form} onChange={onChange} />,
    <StepMedical      form={form} onChange={onChange} />,
    <StepCognitive    form={form} onChange={onChange} />,
    <StepDoctor doctors={doctors} doctorId={doctorId} setDoctorId={setDoctorId} loadingDoctors={loadingDoctors} />,
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900">

      <nav className="border-b border-zinc-200 px-8 py-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <span className="font-semibold">MindBridge</span>
            <span className="text-zinc-300 mx-1">/</span>
            <span className="text-sm text-zinc-500">New Screening</span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-10">

        <DatasetLookup onFetched={(data) => setForm((f) => ({ ...f, ...data }))} />

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-medium transition-colors
                  ${i < step ? "step-done" : i === step ? "step-active" : "step-idle"}`}>
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium hidden sm:block
                  ${i === step ? "text-zinc-900" : "text-zinc-400"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? "bg-zinc-200" : "bg-zinc-100"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold">{STEPS[step]}</h2>
          <p className="text-sm text-zinc-500">Step {step + 1} of {STEPS.length}</p>
        </div>

        <div className="card p-6 mb-6">
          {stepContent[step]}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="btn-secondary gap-1.5">
            <ChevronLeft size={15} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary gap-1.5">
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={() => setShowMriDialog(true)} disabled={submitting || !doctorId} className="btn-primary gap-1.5 px-6">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : "Submit & analyse"}
            </button>
          )}
        </div>
      </main>

      {showMriDialog && (
        <MriDialog
          submitting={submitting}
          onSkip={() => finalizeSubmit(null)}
          onSubmit={(file) => finalizeSubmit(file)}
        />
      )}
    </div>
  );
}
