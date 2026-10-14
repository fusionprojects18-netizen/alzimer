# MRI Dementia Classification — CNN Model Documentation

This document describes the convolutional neural network used to classify brain MRI scans into dementia severity stages, including its architecture, training process, evaluation results, and how it's wired into the MindBridge application.

It is one of two ML models in this project — the other being an XGBoost model over tabular clinical data (`alzheimer_xgboost_model.pkl`), which is out of scope here.

---

## 1. Overview

| | |
|---|---|
| Task | 4-class image classification of brain MRI scans |
| Classes | `NonDemented`, `VeryMildDemented`, `MildDemented`, `ModerateDemented` |
| Architecture | ResNet50 (ImageNet-pretrained), fine-tuned with a custom classification head |
| Framework | PyTorch + torchvision |
| Input | Single 2D MRI slice image (JPEG/PNG), any size — resized to 224×224 |
| Output | Predicted class, confidence, and full per-class probability distribution |
| Artifact | `alzimer_backend/alzheimer_cnn_model.pkl` |
| Metadata | `alzimer_backend/alzheimer_cnn_metadata.json` |
| Training script | `train_alzheimer_model.py` (repo root) |
| Standalone inference helper | `predict_alzheimer.py` (repo root) |

---

## 2. Dataset

**Source:** `AugmentedAlzheimerDataset` (repo root, one subfolder per class — a `torchvision.datasets.ImageFolder` layout).

| Class | Image count |
|---|---|
| MildDemented | 8,960 |
| ModerateDemented | 6,464 |
| NonDemented | 9,600 |
| VeryMildDemented | 8,960 |
| **Total** | **33,984** |

This is an *augmented* version of the well-known Kaggle "Alzheimer MRI" dataset — the class imbalance in the original data has already been partly reduced by generating augmented copies (rotation/flip/crop/etc.) of source scans before this project ever sees it. This matters for interpreting the evaluation numbers — see [§6.4 Caveats](#64-caveats--limitations).

### Deterministic split

`train_alzheimer_model.py` shuffles all 33,984 image indices with a fixed seed (`SEED = 42`) and splits by fraction:

| Split | Fraction | Count |
|---|---|---|
| Train | 75% | 25,489 |
| Validation | 15% | 5,097 |
| Test | 10% | 3,398 |

Because the shuffle is seeded, this split is **reproducible** — re-running the same indexing logic against the same dataset folder always yields the same train/val/test membership (verified independently, see §6.2).

---

## 3. Architecture

### 3.1 Backbone

Starts from `torchvision.models.resnet50` pretrained on ImageNet (`ResNet50_Weights.IMAGENET1K_V2` at training time).

### 3.2 Fine-tuning strategy — partial freeze

Not all layers are fine-tuned. Only the deepest two residual stages are unfrozen, on the theory that early conv layers already encode generic low-level features (edges, textures) that transfer well, while the deeper layers need to adapt to MRI-specific patterns:

```python
for name, param in model.named_parameters():
    if "layer4" in name or "layer3" in name:
        param.requires_grad = True
    else:
        param.requires_grad = False
```

| Component | Frozen? | Params |
|---|---|---|
| `conv1`, `bn1`, `layer1`, `layer2` | Frozen | 1,444,928 |
| `layer3`, `layer4` | Trainable | 22,063,104 |
| Custom head (below) | Trainable | 1,051,140 |
| **Total** | | **24,559,172** |
| **Trainable** | | **23,114,244 (94.1%)** |

### 3.3 Classification head

The original 1000-way ImageNet `fc` layer is replaced with a small MLP head:

```python
in_features = model.fc.in_features   # 2048
model.fc = nn.Sequential(
    nn.Dropout(0.4),
    nn.Linear(in_features, 512),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(512, num_classes),     # num_classes = 4
)
```

`2048 → Dropout(0.4) → Linear(512) → ReLU → Dropout(0.3) → Linear(4)`. The two dropout layers (0.4 and 0.3) are the main regularization against overfitting on a relatively small, augmented dataset.

### 3.4 Preprocessing / transforms

**Training** (with augmentation, to improve generalization):
```python
transforms.Compose([
    transforms.Resize((256, 256)),      # IMG_SIZE + 32
    transforms.RandomCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),  # ImageNet stats
])
```

**Validation / test / production inference** (deterministic, no augmentation):
```python
transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
```

The normalization mean/std are the standard ImageNet statistics, kept consistent with the pretrained backbone. These values are saved into the model pickle (`normalize_mean`, `normalize_std`) so inference code never has to hardcode them separately — see §7.

---

## 4. Training process

| Hyperparameter | Value |
|---|---|
| Batch size | 64 |
| Epochs | 20 |
| Optimizer | AdamW |
| Learning rate | 1e-4 |
| Weight decay | 1e-4 |
| LR schedule | Cosine annealing (`CosineAnnealingLR`, `T_max=20`) |
| Loss | `CrossEntropyLoss` |
| Precision | Mixed precision (AMP) via `torch.cuda.amp.GradScaler` on GPU |
| Class imbalance handling | `WeightedRandomSampler` on the training set (inverse class-frequency weighting) |
| Checkpointing | Best model kept by validation accuracy across all 20 epochs |

### Training loop summary

For each epoch: forward pass under `autocast`, backward pass scaled by `GradScaler` (for AMP stability), optimizer step, cosine LR step. After each epoch, the model is evaluated on the validation set; if validation accuracy improves, the full `state_dict` is cloned to CPU and kept as `best_state`. After all 20 epochs, the **best** validation checkpoint (not necessarily the last epoch) is reloaded and evaluated once on the held-out test set — this is the model that gets saved.

### Reproducing training

```bash
python train_alzheimer_model.py
```
Expects `AugmentedAlzheimerDataset/` in the repo root. Trains for ~20 epochs (GPU strongly recommended — the script targets a 6GB card), then writes `alzheimer_cnn_model.pkl` and `alzheimer_cnn_metadata.json` into `alzimer_backend/`.

---

## 5. Model artifact format

`alzheimer_cnn_model.pkl` is a pickled Python dict (not a raw `nn.Module` — this avoids version-fragility issues with pickling PyTorch modules directly):

```python
{
    "model_state_dict": ...,           # fine-tuned weights
    "model_architecture": "resnet50",
    "num_classes": 4,
    "classes": ["MildDemented", "ModerateDemented", "NonDemented", "VeryMildDemented"],
    "class_to_idx": {...},             # ImageFolder's label mapping
    "img_size": 224,
    "normalize_mean": [0.485, 0.456, 0.406],
    "normalize_std":  [0.229, 0.224, 0.225],
    "best_val_acc": 0.9947,
    "test_acc": 0.9915,
    "history": {...},                  # per-epoch train/val loss & accuracy
}
```

Any code loading this file must **rebuild the exact same architecture** before calling `load_state_dict` — the pickle only stores weights and metadata, not the model class itself. Both `alzimer_backend/main.py` and `predict_alzheimer.py` do this independently (see §7).

`alzheimer_cnn_metadata.json` is a small human-readable sibling file with the headline numbers (architecture name, classes, image size, val/test accuracy, epoch count, dataset name, total image count) — useful for quick inspection without unpickling.

---

## 6. Evaluation

### 6.1 Reported metrics (from training)

| Metric | Value |
|---|---|
| Best validation accuracy | 99.47% |
| Test accuracy | 99.15% |

### 6.2 Independent verification

These numbers were re-verified independently (not just trusted from the metadata file) by reproducing the exact same seeded split (`SEED=42`, same fractions) against the saved weights and re-running inference on the resulting 3,398-image test subset:

| Metric | Reported | Independently reproduced |
|---|---|---|
| Test accuracy | 99.1466% | **99.15%** (3,368 / 3,398 correct) |

**Per-class breakdown:**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| MildDemented | 99.55% | 99.55% | 99.55% | 898 |
| ModerateDemented | 100% | 100% | 100% | 667 |
| NonDemented | 98.49% | 98.60% | 98.54% | 927 |
| VeryMildDemented | 98.78% | 98.68% | 98.73% | 906 |

**Confusion matrix** (rows = true, columns = predicted):

```
                    Mild  Moderate  Non  VeryMild
MildDemented         894      0     2      2
ModerateDemented       0    667     0      0
NonDemented             4      0   914      9
VeryMildDemented        0      0    12    894
```

`ModerateDemented` is classified perfectly — likely the most visually distinct class. Nearly all errors are between `NonDemented` and `VeryMildDemented` (13 of 21 total mistakes), which is expected since very-mild cognitive changes can be subtle on a single MRI slice.

### 6.3 How to re-run this evaluation

There's no committed script for this (it was done ad hoc), but the recipe is:
1. Load `alzheimer_cnn_model.pkl`, rebuild the architecture (§3), load `state_dict`.
2. Rebuild `full_dataset = ImageFolder("AugmentedAlzheimerDataset", transform=val_tf)`.
3. Reproduce the index split with `np.random.seed(42)` + `np.random.shuffle` + the same `TEST_SPLIT`/`VAL_SPLIT` fractions, exactly as in `train_alzheimer_model.py`.
4. Run inference over the `test_idx` subset and compare predictions to labels with `sklearn.metrics`.

### 6.4 Caveats & limitations

- **Possible data leakage from augmentation.** This is the *AugmentedAlzheimerDataset* — augmented copies (rotated/flipped/jittered variants) of original scans may exist as separate files. Since the train/val/test split happens *after* augmentation (splitting by file, not by source patient/scan), it's possible near-duplicate variants of the same original image landed in both the training set and the test set. If so, part of the 99%+ accuracy reflects the model recognizing a scan it's effectively already seen, not pure generalization to unseen patients. Treat 99% as an **optimistic upper bound**, not a guarantee of real-world performance. A stricter evaluation would re-split by original source image *before* augmentation.
- **Single 2D slice, not a full 3D volume.** The model classifies one image at a time. It doesn't reason across a full MRI volume/series the way a radiologist would.
- **No calibration/monitoring in production.** The confidence score is a raw softmax probability — it hasn't been calibrated (e.g., temperature scaling), and there's no drift monitoring on real-world uploads.
- **Not a clinical diagnosis.** As reflected throughout the app's UI copy, this is a screening aid; a physician reviews all results.

---

## 7. Implementation in the project

### 7.1 Backend — model loading (`alzimer_backend/main.py`)

At FastAPI startup, the pickle is loaded once and kept in memory:

```python
with open("alzheimer_cnn_model.pkl", "rb") as f:
    cnn_payload = pickle.load(f)

_cnn_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def _build_resnet50(num_classes):
    net = models.resnet50(weights=None)          # empty backbone — we load our own weights
    in_features = net.fc.in_features
    net.fc = nn.Sequential(
        nn.Dropout(0.4), nn.Linear(in_features, 512), nn.ReLU(),
        nn.Dropout(0.3), nn.Linear(512, num_classes),
    )
    return net

cnn_model = _build_resnet50(cnn_payload["num_classes"])
cnn_model.load_state_dict(cnn_payload["model_state_dict"])
cnn_model.to(_cnn_device)
cnn_model.eval()      # disables dropout/batchnorm updates for inference
```

The eval-time transform pipeline is built directly from the saved metadata (`img_size`, `normalize_mean`, `normalize_std`), so preprocessing can never silently drift from what the model was trained on.

### 7.2 Inference endpoint — `POST /predict-mri`

Stateless: image bytes in, JSON prediction out. No database interaction happens here.

**Request:** `multipart/form-data`, field `file` — a JPEG/PNG image.

**Response:**
```json
{
  "predicted_class": "VeryMildDemented",
  "severity": "Very Mild",
  "confidence": 0.9821,
  "class_probabilities": {
    "MildDemented": 0.0091,
    "ModerateDemented": 0.0006,
    "NonDemented": 0.0082,
    "VeryMildDemented": 0.9821
  },
  "model": "ResNet50 CNN"
}
```

Processing steps: validate content-type is an image → decode with PIL, force RGB → apply eval transform → batch dim → forward pass under `torch.no_grad()` → `softmax` over logits → `argmax` for the predicted class → map predicted class to a coarser **severity** label for UI coloring:

| Predicted class | Severity |
|---|---|
| `NonDemented` | None |
| `VeryMildDemented` | Very Mild |
| `MildDemented` | Mild |
| `ModerateDemented` | Moderate |

### 7.3 End-to-end flow in the app

The CNN is **not** part of the initial patient screening form. It's a doctor-gated second step:

1. Patient submits the initial clinical-data screening (XGBoost model, unrelated to this CNN) and it's routed to their assigned doctor.
2. Doctor reviews the submission in the doctor dashboard and, if they judge an MRI scan would help, flips a **"Request MRI scan"** toggle on that submission (`PUT /api/doctor/submissions/:id/mri-request`, sets `mriRequested: true` in Firestore).
3. The patient's screening-detail page now shows an MRI upload card. They pick/drag an image.
4. Frontend calls `predictMRI(file)` → this is the *only* place the CNN actually runs, hitting FastAPI's `POST /predict-mri` directly.
5. The returned prediction JSON is immediately persisted via `saveMriResult(submissionId, mriPrediction)` → `PUT /api/submissions/:id/mri` on the Node/Express backend, which writes it into the submission's `mriPrediction` field (rejecting the write with 403 if `mriRequested` isn't `true`).
6. Both the patient's results page and the doctor's detail panel read `mriPrediction` off the same submission document and render an identical classification + confidence + per-class probability breakdown.

```
Doctor dashboard                Patient screening detail            FastAPI (CNN)
─────────────────                ──────────────────────             ──────────────
"Request MRI scan" toggle   ──►  Upload card appears
                                  patient selects image
                                  predictMRI(file)             ──►  POST /predict-mri
                                                                     (ResNet50 inference)
                                  mriPrediction JSON            ◄──  response
                                  saveMriResult(id, result)
                                        │
                                        ▼
                             Node backend: PUT /api/submissions/:id/mri
                             (403 unless mriRequested === true)
                                        │
                                        ▼
                             Firestore submission.mriPrediction
                                        │
                        ┌───────────────┴────────────────┐
                        ▼                                 ▼
              Patient Results page              Doctor detail panel
              (probability bars,                 (probability bars,
               severity badge)                    severity badge)
```

### 7.4 Relevant source locations

| File | Role |
|---|---|
| `alzimer_backend/main.py` | Loads the model at startup, exposes `POST /predict-mri` |
| `alzimer_backend/alzheimer_cnn_model.pkl` | Trained weights + metadata (pickle) |
| `alzimer_backend/alzheimer_cnn_metadata.json` | Human-readable summary of the above |
| `train_alzheimer_model.py` | Full training script (repo root) |
| `predict_alzheimer.py` | Standalone CLI: `python predict_alzheimer.py <image.jpg>` |
| `alzimer-frontend/src/api/api.js` | `predictMRI()`, `saveMriResult()`, `requestMri()` client calls |
| `alzimer-frontend/src/pages/DoctorDashboard.jsx` | "Request MRI scan" toggle + MRI result display |
| `alzimer-frontend/src/pages/Results.jsx` | `MriUploadCard` — patient-facing upload UI |
| `alzimer-frontend/server.js` | `PUT /api/doctor/submissions/:id/mri-request`, `PUT /api/submissions/:id/mri` |

### 7.5 Standalone usage (outside the web app)

```bash
cd alzimer_backend
python ../predict_alzheimer.py path/to/scan.jpg
```
Loads the same pickle, runs the same preprocessing, and prints the predicted class plus the full probability breakdown to the console — useful for quick manual checks without starting the FastAPI server.
