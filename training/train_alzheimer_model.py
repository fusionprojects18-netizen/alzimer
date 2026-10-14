"""
Alzheimer's MRI Classification - CNN Training Script
Dataset: AugmentedAlzheimerDataset (4 classes)
Classes: MildDemented, ModerateDemented, NonDemented, VeryMildDemented
Model: ResNet50 (pretrained on ImageNet, fine-tuned)
Output: alzheimer_cnn_model.pkl
"""

import os
import time
import pickle
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, models, transforms
from sklearn.metrics import classification_report, confusion_matrix
import warnings
warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
DATA_DIR    = os.path.join(os.path.dirname(__file__), "AugmentedAlzheimerDataset")
OUTPUT_PKL  = os.path.join(os.path.dirname(__file__), "alzheimer_cnn_model.pkl")
META_FILE   = os.path.join(os.path.dirname(__file__), "alzheimer_cnn_metadata.json")

IMG_SIZE    = 224
BATCH_SIZE  = 64      # fits RTX 3050 6 GB
NUM_EPOCHS  = 20
LR          = 1e-4
WEIGHT_DECAY= 1e-4
VAL_SPLIT   = 0.15
TEST_SPLIT  = 0.10
SEED        = 42

# ── Device ────────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")
if device.type == "cuda":
    print(f"  GPU: {torch.cuda.get_device_name(0)}")
    print(f"  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

torch.manual_seed(SEED)
np.random.seed(SEED)

# ── Transforms ────────────────────────────────────────────────────────────────
train_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
    transforms.RandomCrop(IMG_SIZE),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

val_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

# ── Dataset split ─────────────────────────────────────────────────────────────
print("\nLoading dataset...")
full_dataset = datasets.ImageFolder(DATA_DIR, transform=train_tf)
classes      = full_dataset.classes
num_classes  = len(classes)
total        = len(full_dataset)
print(f"Classes: {classes}")
print(f"Total images: {total}")
for cls, idx in full_dataset.class_to_idx.items():
    cnt = sum(1 for _, l in full_dataset.samples if l == idx)
    print(f"  {cls}: {cnt}")

# Deterministic split
indices = list(range(total))
np.random.shuffle(indices)
test_end  = int(TEST_SPLIT * total)
val_end   = test_end + int(VAL_SPLIT * total)

test_idx  = indices[:test_end]
val_idx   = indices[test_end:val_end]
train_idx = indices[val_end:]

print(f"\nSplit — train: {len(train_idx)}, val: {len(val_idx)}, test: {len(test_idx)}")

from torch.utils.data import Subset

train_dataset = Subset(full_dataset, train_idx)
val_dataset   = Subset(datasets.ImageFolder(DATA_DIR, transform=val_tf), val_idx)
test_dataset  = Subset(datasets.ImageFolder(DATA_DIR, transform=val_tf), test_idx)

# Weighted sampler to handle class imbalance
train_labels  = [full_dataset.targets[i] for i in train_idx]
class_counts  = np.bincount(train_labels)
class_weights = 1.0 / class_counts
sample_weights = [class_weights[l] for l in train_labels]
sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, sampler=sampler,
                          num_workers=0, pin_memory=True)
val_loader   = DataLoader(val_dataset,   batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=0, pin_memory=True)
test_loader  = DataLoader(test_dataset,  batch_size=BATCH_SIZE, shuffle=False,
                          num_workers=0, pin_memory=True)

# ── Model ─────────────────────────────────────────────────────────────────────
print("\nBuilding ResNet50 model...")
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

# Freeze early layers, fine-tune layer3/4 + fc
for name, param in model.named_parameters():
    if "layer4" in name or "layer3" in name:
        param.requires_grad = True
    else:
        param.requires_grad = False

# Replace final FC layer
in_features = model.fc.in_features
model.fc = nn.Sequential(
    nn.Dropout(0.4),
    nn.Linear(in_features, 512),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(512, num_classes),
)
model = model.to(device)

total_params     = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Total params: {total_params:,}  |  Trainable: {trainable_params:,}")

# ── Training setup ────────────────────────────────────────────────────────────
criterion = nn.CrossEntropyLoss()
optimizer = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                        lr=LR, weight_decay=WEIGHT_DECAY)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS)

# Use AMP for faster GPU training
scaler = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

# ── Training loop ─────────────────────────────────────────────────────────────
def evaluate(loader):
    model.eval()
    correct, total_n, running_loss = 0, 0, 0.0
    with torch.no_grad():
        for imgs, labels in loader:
            imgs, labels = imgs.to(device), labels.to(device)
            with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
                outputs = model(imgs)
                loss = criterion(outputs, labels)
            running_loss += loss.item() * imgs.size(0)
            _, preds = outputs.max(1)
            correct  += preds.eq(labels).sum().item()
            total_n  += imgs.size(0)
    return running_loss / total_n, correct / total_n


best_val_acc  = 0.0
best_state    = None
history       = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

print(f"\nTraining for {NUM_EPOCHS} epochs on {device}...\n")
print(f"{'Epoch':>5} {'Train Loss':>11} {'Train Acc':>10} {'Val Loss':>10} {'Val Acc':>9} {'LR':>10} {'Time':>8}")
print("-" * 70)

for epoch in range(1, NUM_EPOCHS + 1):
    model.train()
    t0 = time.time()
    running_loss, correct, total_n = 0.0, 0, 0

    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
            outputs = model(imgs)
            loss    = criterion(outputs, labels)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        running_loss += loss.item() * imgs.size(0)
        _, preds = outputs.max(1)
        correct  += preds.eq(labels).sum().item()
        total_n  += imgs.size(0)

    train_loss = running_loss / total_n
    train_acc  = correct / total_n
    val_loss, val_acc = evaluate(val_loader)
    scheduler.step()

    history["train_loss"].append(train_loss)
    history["train_acc"].append(train_acc)
    history["val_loss"].append(val_loss)
    history["val_acc"].append(val_acc)

    elapsed = time.time() - t0
    lr_now  = scheduler.get_last_lr()[0]
    print(f"{epoch:>5}  {train_loss:>11.4f}  {train_acc:>9.4f}  "
          f"{val_loss:>10.4f}  {val_acc:>9.4f}  {lr_now:>10.6f}  {elapsed:>6.1f}s")

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        best_state   = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        print(f"         ↑ Best model saved (val_acc={best_val_acc:.4f})")

# ── Test evaluation ───────────────────────────────────────────────────────────
print(f"\nLoading best model (val_acc={best_val_acc:.4f}) for test evaluation...")
model.load_state_dict(best_state)
model.to(device)

test_loss, test_acc = evaluate(test_loader)
print(f"Test Loss: {test_loss:.4f}  |  Test Accuracy: {test_acc:.4f}")

# Detailed classification report
model.eval()
all_preds, all_labels = [], []
with torch.no_grad():
    for imgs, labels in test_loader:
        imgs = imgs.to(device)
        with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
            outputs = model(imgs)
        _, preds = outputs.max(1)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.numpy())

print("\nClassification Report:")
print(classification_report(all_labels, all_preds, target_names=classes))
print("Confusion Matrix:")
print(confusion_matrix(all_labels, all_preds))

# ── Save model as .pkl ────────────────────────────────────────────────────────
print(f"\nSaving model to {OUTPUT_PKL} ...")
model.cpu()

payload = {
    "model_state_dict": best_state,
    "model_architecture": "resnet50",
    "num_classes": num_classes,
    "classes": classes,
    "class_to_idx": full_dataset.class_to_idx,
    "img_size": IMG_SIZE,
    "normalize_mean": [0.485, 0.456, 0.406],
    "normalize_std":  [0.229, 0.224, 0.225],
    "best_val_acc": best_val_acc,
    "test_acc": test_acc,
    "history": history,
}

with open(OUTPUT_PKL, "wb") as f:
    pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)

metadata = {
    "model_file": "alzheimer_cnn_model.pkl",
    "architecture": "ResNet50",
    "classes": classes,
    "img_size": IMG_SIZE,
    "best_val_accuracy": round(best_val_acc, 4),
    "test_accuracy": round(test_acc, 4),
    "training_epochs": NUM_EPOCHS,
    "dataset": "AugmentedAlzheimerDataset",
    "total_images": total,
}
with open(META_FILE, "w") as f:
    json.dump(metadata, f, indent=2)

print(f"Model saved: {OUTPUT_PKL}")
print(f"Metadata  : {META_FILE}")
print(f"\nDone! Best val acc: {best_val_acc:.4f} | Test acc: {test_acc:.4f}")
