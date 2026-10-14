import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Brain, Eye, EyeOff, Loader2 } from "lucide-react";
import { registerPatient } from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function PatientRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", dateOfBirth: "", phone: "" });
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
    if (form.phone && form.phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }
    setLoading(true);
    try {
      const { data } = await registerPatient(form);
      login(data.user, data.token);
      navigate("/patient/dashboard");
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
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <span className="font-semibold text-zinc-900">MindBridge</span>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-1">Create account</h2>
            <p className="text-sm text-zinc-500 mb-5">Register as a patient to begin screening.</p>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="input-label">Full name</label>
                <input name="fullName" value={form.fullName} onChange={handle} className="input" placeholder="Jane Doe" required />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input name="email" type="email" value={form.email} onChange={handle} className="input" placeholder="you@example.com" required />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Date of birth</label>
                  <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handle} className="input" />
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input name="phone" value={form.phone} onChange={handle} className="input" placeholder="10-digit number" inputMode="numeric" maxLength={10} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Create account"}
              </button>
            </form>

            <p className="text-center text-sm text-zinc-500 mt-5">
              Already registered?{" "}
              <Link to="/patient/login" className="text-indigo-600 hover:text-indigo-500 transition-colors">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-xs text-zinc-400 mt-4">
            Doctor?{" "}
            <Link to="/doctor/login" className="text-zinc-500 hover:text-zinc-700 transition-colors">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
