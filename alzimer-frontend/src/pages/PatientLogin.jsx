import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Brain, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginPatient } from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function PatientLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await loginPatient(form);
      login(data.user, data.token);
      navigate("/patient/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid email or password.");
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
            <h2 className="text-lg font-semibold text-zinc-900 mb-1">Patient sign in</h2>
            <p className="text-sm text-zinc-500 mb-5">Enter your credentials to continue.</p>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="input-label">Email</label>
                <input name="email" type="email" value={form.email} onChange={handle}
                  className="input" placeholder="you@example.com" required />
              </div>
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <input name="password" type={showPw ? "text" : "password"}
                    value={form.password} onChange={handle}
                    className="input pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Sign in"}
              </button>
            </form>

            <p className="text-center text-sm text-zinc-500 mt-5">
              No account?{" "}
              <Link to="/patient/register" className="text-indigo-600 hover:text-indigo-500 transition-colors">Register</Link>
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
