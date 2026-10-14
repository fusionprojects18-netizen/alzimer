import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Stethoscope, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const registerDoctor = (data) => axios.post("/api/auth/doctor/register", data);

const SPECIALIZATIONS = [
  "Neurology", "Geriatrics", "Psychiatry",
  "Internal Medicine", "General Practice", "Neuropsychology", "Other",
];

export default function DoctorRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    fullName: "", email: "", password: "",
    specialization: "", hospital: "", licenseNumber: "", phone: "",
  });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handle = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setForm({ ...form, phone: digitsOnly });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!form.specialization)     { setError("Please select a specialization.");          return; }
    if (form.phone && form.phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }
    setLoading(true);
    try {
      const { data } = await registerDoctor(form);
      login(data.user, data.token);
      navigate("/doctor/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center">
              <Stethoscope size={14} className="text-white" />
            </div>
            <span className="font-semibold text-zinc-900">MindBridge</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">Doctor</span>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-1">Create doctor account</h2>
            <p className="text-sm text-zinc-500 mb-5">Register to start reviewing patient screenings.</p>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="input-label">Full name</label>
                <input name="fullName" value={form.fullName} onChange={handle} className="input" placeholder="Dr. Jane Smith" required />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input name="email" type="email" value={form.email} onChange={handle} className="input" placeholder="doctor@hospital.com" required />
              </div>
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <input name="password" type={showPw ? "text" : "password"} value={form.password}
                    onChange={handle} className="input pr-10" placeholder="Min. 6 characters" required />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Specialization</label>
                <select name="specialization" value={form.specialization} onChange={handle} className="input" required>
                  <option value="" disabled>Select one</option>
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Hospital / Clinic</label>
                <input name="hospital" value={form.hospital} onChange={handle} className="input" placeholder="City General Hospital" required />
              </div>
              <div>
                <label className="input-label">License number <span className="text-zinc-400">(optional)</span></label>
                <input name="licenseNumber" value={form.licenseNumber} onChange={handle} className="input" placeholder="MCI-123456" />
              </div>
              <div>
                <label className="input-label">Phone <span className="text-zinc-400">(optional)</span></label>
                <input name="phone" value={form.phone} onChange={handle} className="input" placeholder="10-digit number" inputMode="numeric" maxLength={10} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium
                           transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed
                           inline-flex items-center justify-center gap-2">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Create account"}
              </button>
            </form>

            <p className="text-center text-sm text-zinc-500 mt-5">
              Already registered?{" "}
              <Link to="/doctor/login" className="text-teal-700 hover:text-teal-600 transition-colors">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-xs text-zinc-400 mt-4">
            Patient?{" "}
            <Link to="/patient/login" className="text-zinc-500 hover:text-zinc-700 transition-colors">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
