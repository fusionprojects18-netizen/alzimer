// One-off local script to seed sample doctor accounts.
// Run with: node scripts/seedDoctors.js
// This is intentionally NOT an HTTP route — seeding production data over an
// unauthenticated public endpoint is a security risk, so it's a CLI script instead.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

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

const DOCTORS = [
  { fullName: "Dr. Sarah Mitchell", email: "sarah.mitchell@alzcare.com", specialization: "Neurology", hospital: "City Neuro Center" },
  { fullName: "Dr. James Patel", email: "james.patel@alzcare.com", specialization: "Geriatrics", hospital: "Senior Health Institute" },
  { fullName: "Dr. Emily Chen", email: "emily.chen@alzcare.com", specialization: "Psychiatry", hospital: "Mind & Memory Clinic" },
  { fullName: "Dr. Robert Kumar", email: "robert.kumar@alzcare.com", specialization: "Neurology", hospital: "BrainCare Hospital" },
];

async function run() {
  const createdCredentials = [];

  for (const d of DOCTORS) {
    const exists = await db.collection("doctors").where("email", "==", d.email).get();
    if (!exists.empty) {
      console.log(`Skipped (already exists): ${d.email}`);
      continue;
    }

    const password = process.env.SEED_DOCTOR_PASSWORD || crypto.randomBytes(9).toString("base64url");
    const hashed = await bcrypt.hash(password, 10);
    await db.collection("doctors").add({ ...d, password: hashed });
    createdCredentials.push({ email: d.email, password });
  }

  if (createdCredentials.length === 0) {
    console.log("No new doctors created — all sample accounts already exist.");
  } else {
    console.log("\nCreated doctor accounts (save these now — passwords are not stored anywhere):");
    for (const c of createdCredentials) console.log(`  ${c.email}  /  ${c.password}`);
    console.log("\nAsk each doctor to change their password after first login.");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
