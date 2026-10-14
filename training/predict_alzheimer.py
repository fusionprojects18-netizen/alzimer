"""
Inference helper — loads alzheimer_cnn_model.pkl and predicts a single image.
Usage: python predict_alzheimer.py <path_to_image.jpg>
"""

import sys
import pickle
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


def load_model(pkl_path: str):
    with open(pkl_path, "rb") as f:
        payload = pickle.load(f)

    model = models.resnet50(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, payload["num_classes"]),
    )
    model.load_state_dict(payload["model_state_dict"])
    model.eval()
    return model, payload


def predict(image_path: str, pkl_path: str = "alzheimer_cnn_model.pkl"):
    model, payload = load_model(pkl_path)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    img_size = payload["img_size"]
    tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(payload["normalize_mean"], payload["normalize_std"]),
    ])

    img = Image.open(image_path).convert("RGB")
    tensor = tf(img).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(tensor)
        probs  = torch.softmax(logits, dim=1)[0]

    classes = payload["classes"]
    pred_idx = probs.argmax().item()
    result = {cls: round(probs[i].item(), 4) for i, cls in enumerate(classes)}
    return classes[pred_idx], result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict_alzheimer.py <image_path> [model.pkl]")
        sys.exit(1)

    image_path = sys.argv[1]
    pkl_path   = sys.argv[2] if len(sys.argv) > 2 else "alzheimer_cnn_model.pkl"

    predicted_class, probabilities = predict(image_path, pkl_path)
    print(f"\nPrediction: {predicted_class}")
    print("Probabilities:")
    for cls, prob in sorted(probabilities.items(), key=lambda x: -x[1]):
        print(f"  {cls:<25} {prob:.4f} ({prob*100:.1f}%)")
