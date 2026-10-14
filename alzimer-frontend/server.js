import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

dotenv.config();

// ─── Firebase Init ────────────────────────────────────────────────────────────
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

// ─── Express Setup ────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, health checks, server-to-server) with no Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error("Not allowed by CORS");
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

// ─── Middleware: Verify JWT ───────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role)
    return res.status(403).json({ error: "Access denied" });
  next();
};

const isValidEmail = (email) => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/patient/register
app.post("/api/auth/patient/register", authLimiter, async (req, res) => {
  try {
    const { fullName, email, password, dateOfBirth, phone } = req.body;

    if (!fullName || !email || !password)
      return res.status(400).json({ error: "fullName, email, and password are required" });
    if (!isValidEmail(email))
      return res.status(400).json({ error: "Please provide a valid email address" });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    // Check duplicate
    const existing = await db.collection("patients").where("email", "==", email).get();
    if (!existing.empty)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const docRef = await db.collection("patients").add({
      fullName,
      email,
      password: hashed,
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const token = jwt.sign({ id: docRef.id, email, role: "patient", fullName }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user: { id: docRef.id, fullName, email, role: "patient" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/patient/login
app.post("/api/auth/patient/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const snap = await db.collection("patients").where("email", "==", email).get();
    if (snap.empty) return res.status(401).json({ error: "Invalid credentials" });

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: docSnap.id, email, role: "patient", fullName: data.fullName },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: docSnap.id, fullName: data.fullName, email, role: "patient" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/doctor/register
app.post("/api/auth/doctor/register", authLimiter, async (req, res) => {
  try {
    const { fullName, email, password, specialization, hospital, licenseNumber } = req.body;

    if (!fullName || !email || !password || !specialization || !hospital)
      return res.status(400).json({ error: "fullName, email, password, specialization, and hospital are required" });
    if (!isValidEmail(email))
      return res.status(400).json({ error: "Please provide a valid email address" });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await db.collection("doctors").where("email", "==", email).get();
    if (!existing.empty)
      return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const docRef = await db.collection("doctors").add({
      fullName,
      email,
      password: hashed,
      specialization,
      hospital,
      licenseNumber: licenseNumber || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    const token = jwt.sign(
      { id: docRef.id, email, role: "doctor", fullName },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: { id: docRef.id, fullName, email, role: "doctor", specialization, hospital },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/doctor/login
app.post("/api/auth/doctor/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const snap = await db.collection("doctors").where("email", "==", email).get();
    if (snap.empty) return res.status(401).json({ error: "Invalid credentials" });

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    const valid = await bcrypt.compare(password, data.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: docSnap.id, email, role: "doctor", fullName: data.fullName },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: docSnap.id,
        fullName: data.fullName,
        email,
        role: "doctor",
        specialization: data.specialization,
        hospital: data.hospital,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR LISTING (public — patients need this to pick a doctor)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/doctors
app.get("/api/doctors", authenticate, async (req, res) => {
  try {
    const snap = await db.collection("doctors").get();
    const doctors = snap.docs.map((d) => ({
      id: d.id,
      fullName: d.data().fullName,
      specialization: d.data().specialization,
      hospital: d.data().hospital,
    }));
    res.json(doctors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSIONS — Patient saves test results + prediction
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/submissions  — called by frontend AFTER getting prediction from FastAPI
app.post("/api/submissions", authenticate, requireRole("patient"), async (req, res) => {
  try {
    const { doctorId, formData, prediction } = req.body;
    // prediction: { prediction, probability, risk_level } from FastAPI

    if (!doctorId || !formData || !prediction)
      return res.status(400).json({ error: "doctorId, formData, and prediction are required" });

    const docRef = await db.collection("submissions").add({
      patientId: req.user.id,
      patientName: req.user.fullName,
      patientEmail: req.user.email,
      doctorId,
      formData,
      prediction: prediction.prediction,
      probability: prediction.probability,
      riskLevel: prediction.risk_level,
      doctorVerdict: null,
      doctorNotes: null,
      reviewedAt: null,
      mriPrediction: null,
      mriUploadedAt: null,
      submittedAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: docRef.id, message: "Submission saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save submission" });
  }
});

// GET /api/submissions/my  — patient views their own submissions
app.get("/api/submissions/my", authenticate, requireRole("patient"), async (req, res) => {
  try {
    const snap = await db
      .collection("submissions")
      .where("patientId", "==", req.user.id)
      .orderBy("submittedAt", "desc")
      .get();

    const submissions = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        // Fetch doctor name
        let doctorName = "Unknown";
        try {
          const drDoc = await db.collection("doctors").doc(data.doctorId).get();
          if (drDoc.exists) doctorName = drDoc.data().fullName;
        } catch {
          // Doctor lookup is best-effort — fall back to "Unknown" if it fails.
        }
        return { id: d.id, ...data, doctorName };
      })
    );

    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/doctor/submissions  — all submissions assigned to this doctor
app.get("/api/doctor/submissions", authenticate, requireRole("doctor"), async (req, res) => {
  try {
    const snap = await db
      .collection("submissions")
      .where("doctorId", "==", req.user.id)
      .orderBy("submittedAt", "desc")
      .get();

    const submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// GET /api/doctor/submissions/:id  — detail view
app.get("/api/doctor/submissions/:id", authenticate, requireRole("doctor"), async (req, res) => {
  try {
    const doc = await db.collection("submissions").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Submission not found" });

    const data = doc.data();
    if (data.doctorId !== req.user.id)
      return res.status(403).json({ error: "Not your patient" });

    res.json({ id: doc.id, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch submission" });
  }
});

// PUT /api/doctor/submissions/:id/review  — doctor adds verdict
app.put(
  "/api/doctor/submissions/:id/review",
  authenticate,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const { verdict, notes } = req.body;
      // verdict: "Positive" | "Negative" | "Inconclusive"
      if (!verdict) return res.status(400).json({ error: "verdict is required" });

      const ref = db.collection("submissions").doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Submission not found" });
      if (doc.data().doctorId !== req.user.id)
        return res.status(403).json({ error: "Not your patient" });

      await ref.update({
        doctorVerdict: verdict,
        doctorNotes: notes || null,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      res.json({ message: "Review saved" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save review" });
    }
  }
);

// PUT /api/submissions/:id/mri  — patient uploads/saves their MRI scan analysis (optional, always allowed)
app.put("/api/submissions/:id/mri", authenticate, requireRole("patient"), async (req, res) => {
  try {
    const { mriPrediction } = req.body;
    if (!mriPrediction) return res.status(400).json({ error: "mriPrediction is required" });

    const ref = db.collection("submissions").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Submission not found" });

    const data = doc.data();
    if (data.patientId !== req.user.id)
      return res.status(403).json({ error: "Not your submission" });

    await ref.update({
      mriPrediction,
      mriUploadedAt: FieldValue.serverTimestamp(),
    });

    res.json({ message: "MRI result saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save MRI result" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ─── 404 + centralized error handler ──────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Express requires exactly 4 params for error middleware, even if _next is unused.
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Express server running on http://localhost:${PORT}`);
});
