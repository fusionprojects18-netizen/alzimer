# MindBridge — Alzheimer's Detection Platform
### Project Documentation

---

## 1. Project Overview

MindBridge is a web-based clinical screening platform designed to assist in the early detection of Alzheimer's disease. The platform collects patient clinical data through a structured form, processes it using a trained XGBoost machine learning model, and generates a risk prediction. The prediction is then reviewed by an assigned physician who provides the final clinical verdict. The system bridges the gap between AI-assisted screening and professional medical judgement.

---

## 2. Objectives

1. **Early Detection** — Provide patients and physicians with an AI-powered tool that analyses 37 clinical markers to identify early signs of Alzheimer's disease before symptoms become severe.

2. **Doctor-in-the-Loop** — Ensure that every AI prediction is reviewed and confirmed by a licensed physician before any final verdict is communicated, maintaining clinical accountability.

3. **Accessible Screening** — Build a simple, user-friendly web platform that allows patients to register, submit clinical test results, and select their preferred doctor without requiring technical knowledge.

4. **Secure Data Management** — Store all patient records, submissions, and doctor reviews securely using Firebase Firestore with JWT-based authentication to protect sensitive medical information.

---

## 3. Software Requirements

### 3.1 Functional Requirements

- Patients can register, log in, and manage their accounts.
- Doctors can register, log in, and access a dedicated review dashboard.
- Patients can fill in a multi-step clinical screening form covering demographics, lifestyle, medical history, cognitive assessments, and behavioural symptoms.
- Patients can select an assigned doctor from the registered doctors list.
- The system sends submitted form data to the ML model and returns a risk prediction (Low / Moderate / High) with a probability score.
- Submission data and predictions are saved to Firebase Firestore.
- Doctors can view all patient submissions assigned to them, filter by review status, and open a detailed patient panel.
- Doctors can submit a clinical verdict (Positive / Negative / Inconclusive) and add clinical notes.
- Patients can view their screening history and doctor verdicts from their dashboard.
- The platform supports light and dark theme toggling with preference saved locally.

### 3.2 Non-Functional Requirements

- **Security** — Passwords are hashed using bcrypt. All API routes are protected with JSON Web Tokens (JWT).
- **Performance** — The ML prediction endpoint returns results in under 2 seconds for standard inputs.
- **Usability** — The interface is responsive, works across modern browsers, and requires no technical expertise from users.
- **Scalability** — Firebase Firestore scales automatically as the number of patients and submissions grows.
- **Reliability** — The Express server (auth) and FastAPI server (prediction) run independently, so a failure in one does not affect the other.

### 3.3 System Requirements

| Component | Requirement |
|---|---|
| Browser | Chrome, Firefox, Edge, Safari (latest versions) |
| Node.js | v18 or above |
| Python | 3.10 or above |
| Internet | Required for Firebase connectivity |
| RAM | Minimum 4 GB recommended for running all servers locally |

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + Vite | UI framework and build tool |
| **Styling** | Tailwind CSS v3 | Utility-first styling with dark/light theme support |
| **Routing** | React Router DOM v7 | Client-side page navigation |
| **Charts** | Recharts | Radial probability chart on results page |
| **Icons** | Lucide React | Icon library |
| **Auth & Storage Backend** | Node.js + Express.js | REST API for registration, login, submission saving |
| **Database** | Firebase Firestore | NoSQL cloud database for users, doctors, submissions |
| **Authentication** | JWT + bcryptjs | Token-based auth and password hashing |
| **ML Prediction Backend** | Python + FastAPI | REST API that loads the trained model and returns predictions |
| **ML Model** | XGBoost | Gradient boosted tree classifier for Alzheimer's risk |
| **HTTP Client** | Axios | Frontend-to-backend API communication |

---

## 5. Project Information

### How the Platform Works

- **Patient Flow**
  - Patient registers with name, email, password, and optional date of birth and phone number.
  - After login, the patient fills a 5-step screening form covering demographics, lifestyle, medical history, cognitive scores, and behavioural symptoms.
  - In the final step, the patient selects an assigned doctor from the available list.
  - On submission, the form data is sent to the FastAPI ML server, which returns a risk prediction and probability score.
  - The prediction and form data are saved to Firebase Firestore under the patient's record.
  - The patient is taken to a results page showing the AI prediction and waits for doctor review.

- **Doctor Flow**
  - Doctors register with their name, email, specialization, hospital, and optional license number.
  - After login, the doctor sees a dashboard listing all patient submissions assigned to them.
  - Submissions can be filtered by status: All, Pending, or Reviewed.
  - Clicking a submission opens a detail panel showing the AI prediction, probability chart, and a full breakdown of all patient values.
  - The doctor submits a verdict (Positive / Negative / Inconclusive) and optional clinical notes.
  - The verdict is saved to Firebase and becomes visible to the patient on their dashboard.

### Machine Learning Model

- **Algorithm** — XGBoost (Extreme Gradient Boosting)
- **Training Data** — 2,222 patient records from the Alzheimer's Disease dataset
- **Features Used** — 37 clinical features spanning demographics, lifestyle, medical history, cognitive assessments, and behavioural symptoms
- **Performance**
  - F1 Score: 90.6%
  - AUC-ROC: 94.1%
  - Optimal Threshold: 0.40
- **Risk Categories**
  - Low Risk: Probability below 30%
  - Moderate Risk: Probability between 30% and 60%
  - High Risk: Probability above 60%
- The model is serialised as `alzheimer_xgboost_model.pkl` and loaded at FastAPI server startup.

### Key Features

- Multi-step screening form with sliders, toggles, dropdowns, and number inputs for all 37 clinical markers.
- Real-time AI risk prediction with a probability percentage and risk category.
- Doctor slide-in panel with full patient data breakdown and verdict submission.
- Light and dark theme toggle available on all pages, preference saved in browser storage.
- Screening history on the patient dashboard showing all past submissions and doctor verdicts.
- JWT-protected API routes ensuring only authenticated users can access patient or doctor endpoints.
- Two independent backend servers (Node.js for auth/data, Python for ML) for clean separation of concerns.

---

## 6. Dataset Information

### Overview

- **Dataset Name** — Alzheimer's Disease Dataset
- **File** — `alzheimers_disease_data.csv`
- **Total Records** — 2,149 patient samples
- **Original Features** — 35 columns (including PatientID and DoctorInCharge which are dropped before training)
- **Target Variable** — `Diagnosis` (0 = No Alzheimer's, 1 = Alzheimer's Detected)
- **Task Type** — Binary Classification

### Class Distribution

| Class | Label | Count | Percentage |
|---|---|---|---|
| 0 | No Alzheimer's | 1,389 | 64.6% |
| 1 | Alzheimer's Detected | 760 | 35.4% |

- The dataset is **moderately imbalanced** with a class ratio of approximately **1.83:1**.
- To handle this imbalance during training, a combination of **SMOTE** (Synthetic Minority Oversampling Technique), **scale_pos_weight**, and **class weighting** was applied.
- After SMOTE oversampling, the training set was expanded to **2,222 samples**.

### Train / Test Split

| Set | Samples |
|---|---|
| Training set (after SMOTE) | 2,222 |
| Test set | 430 |

- Split strategy: **Stratified split** (80% train, 20% test) to preserve class proportions.

### Feature Categories

The dataset contains 32 input features grouped into 5 categories:

| Category | Features |
|---|---|
| **Demographics** | Age, Gender, Ethnicity, EducationLevel |
| **Lifestyle** | BMI, Smoking, AlcoholConsumption, PhysicalActivity, DietQuality, SleepQuality |
| **Medical History** | FamilyHistoryAlzheimers, CardiovascularDisease, Diabetes, Depression, HeadInjury, Hypertension, SystolicBP, DiastolicBP, CholesterolTotal, CholesterolLDL, CholesterolHDL, CholesterolTriglycerides |
| **Cognitive & Functional** | MMSE, FunctionalAssessment, ADL |
| **Behavioural Symptoms** | MemoryComplaints, BehavioralProblems, Confusion, Disorientation, PersonalityChanges, DifficultyCompletingTasks, Forgetfulness |

### Feature Engineering

5 additional composite features were engineered from the raw data to improve model performance, bringing the total feature count to **37**:

| Engineered Feature | Description | Formula |
|---|---|---|
| **CognitiveScore** | Average of the three cognitive measures | (MMSE + FunctionalAssessment + ADL) / 3 |
| **BehavioralSymptomCount** | Total number of behavioural symptoms present | Sum of all 7 binary behavioural flags |
| **CardioRiskScore** | Combined cardiovascular risk indicator | CardiovascularDisease + Diabetes + Hypertension + Smoking |
| **CholesterolRatio** | LDL to HDL ratio (cardiovascular risk marker) | CholesterolLDL / (CholesterolHDL + ε) |
| **AgeGroup** | Binned age category | Age grouped into 5 bins: 60–65, 65–70, 70–75, 75–80, 80–90 |

### Key Observations

- **Age range** spans from 60 to 90 years, targeting the elderly population most at risk.
- **MMSE scores** (Mini-Mental State Examination) range from 0 to 30 — lower scores indicate greater cognitive impairment.
- **Continuous features** such as BMI, cholesterol levels, blood pressure, and lifestyle scores are recorded as floating point values allowing fine-grained assessment.
- **Binary features** such as Smoking, Depression, Diabetes, and all behavioural symptoms are recorded as 0 or 1.
- The dataset contains **no missing values**, making preprocessing straightforward.
- All continuous features were standardised using **StandardScaler** before model training.

### Data Preprocessing Pipeline

1. Drop non-informative columns (`PatientID`, `DoctorInCharge`).
2. Encode categorical variables where required.
3. Apply feature engineering to create 5 composite features.
4. Standardise continuous features using StandardScaler.
5. Apply stratified train/test split (80/20).
6. Apply SMOTE oversampling on the training set only to balance the minority class.
7. Train XGBoost with additional `scale_pos_weight` and class weighting for robustness.

---

## 7. Project Structure



```
Alzimer_project/
│
├── alzimer-frontend/          React + Vite frontend
│   ├── src/
│   │   ├── pages/             Landing, Login, Register, Dashboard, TestForm, Results
│   │   ├── components/        ThemeToggle (reusable)
│   │   ├── context/           AuthContext, ThemeContext
│   │   └── api/               Axios API functions
│   └── server.js              Node.js + Express auth and data server
│
├── alzimer_backend/           Python FastAPI ML server
│   ├── main.py                Prediction endpoint
│   └── requirements.txt       Python dependencies
│
├── alzheimer_xgboost_model.pkl    Trained XGBoost model
└── model_metadata.json            Model performance metadata
```

---

*MindBridge — For clinical screening only. Always consult a licensed physician for diagnosis.*
