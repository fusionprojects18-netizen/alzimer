import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Landing         from "./pages/Landing";
import PatientRegister from "./pages/PatientRegister";
import PatientLogin    from "./pages/PatientLogin";
import DoctorLogin     from "./pages/DoctorLogin";
import DoctorRegister  from "./pages/DoctorRegister";
import PatientDashboard from "./pages/PatientDashboard";
import TestForm        from "./pages/TestForm";
import Results         from "./pages/Results";
import DoctorDashboard from "./pages/DoctorDashboard";

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"                  element={<Landing />} />
      <Route path="/patient/register"  element={<PatientRegister />} />
      <Route path="/patient/login"     element={<PatientLogin />} />
      <Route path="/doctor/login"      element={<DoctorLogin />} />
      <Route path="/doctor/register"   element={<DoctorRegister />} />

      {/* Patient protected */}
      <Route path="/patient/dashboard" element={<ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>} />
      <Route path="/patient/test"      element={<ProtectedRoute role="patient"><TestForm /></ProtectedRoute>} />
      <Route path="/patient/results"   element={<ProtectedRoute role="patient"><Results /></ProtectedRoute>} />

      {/* Doctor protected */}
      <Route path="/doctor/dashboard"  element={<ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
