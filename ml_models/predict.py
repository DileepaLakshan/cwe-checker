import sys
import json
import os
import glob
import joblib
import pandas as pd

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input data provided"}))
        return

    try:
        input_data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
        return

    # Models directory defaults to this script's own folder (the original,
    # bundled-only behavior) but is normally passed explicitly by
    # scan-handlers.js pointing at the writable userData model store, so
    # promoted/restored models are picked up without touching this script.
    models_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))

    # Discovered dynamically instead of a fixed list, so a newly trained
    # characteristic (e.g. Usability, which has no bundled model today)
    # is served as soon as it's promoted, with no code change here.
    model_files = sorted(
        os.path.basename(p) for p in glob.glob(os.path.join(models_dir, "*_random_forest_model.pkl"))
    )

    results = {}
    for model_file in model_files:
        model_path = os.path.join(models_dir, model_file)
        if os.path.exists(model_path):
            try:
                model = joblib.load(model_path)
                
                # Dynamically extract expected feature names for this specific model
                if hasattr(model, 'feature_names_in_'):
                    expected_features = model.feature_names_in_
                else:
                    # Fallback if no feature names recorded
                    expected_features = [
                        "CWE-129_area_area", "CWE-130_area_area", "CWE-131_area_area",
                        "CWE-1321_area_area", "CWE-1333_area_area", "CWE-134_area_area",
                        "CWE-159_area_area", "CWE-190_area_area", "CWE-191_area_area",
                        "CWE-193_area_area"
                    ]
                
                importances = getattr(model, 'feature_importances_', [])
                
                # Build the row specifically for this model's required features
                row = {}
                # Convert expected_features to list to easily find index later
                expected_list = list(expected_features)
                for f in expected_list:
                    cwe = f.split('_')[0]
                    row[f] = float(input_data.get(cwe, 0.0))
                    
                model_df = pd.DataFrame([row])
                
                prediction = model.predict(model_df)[0]
                model_name = model_file.replace("_random_forest_model.pkl", "")
                
                # Build inputs_data based ONLY on what was actually scanned (input_data)
                inputs_data = []
                for scanned_cwe, scanned_val in input_data.items():
                    # Find if this scanned_cwe is a feature in the model
                    # The models use the format CWE-XXX_area_area
                    feature_name = f"{scanned_cwe}_area_area"
                    weight = 0.0
                    if feature_name in expected_list:
                        idx = expected_list.index(feature_name)
                        if idx < len(importances):
                            weight = float(importances[idx])
                            
                    inputs_data.append({
                        "cwe": scanned_cwe,
                        "value": float(scanned_val),
                        "weight": weight
                    })
                
                # Sort inputs by value descending (since they were scanned)
                inputs_data.sort(key=lambda x: x['value'], reverse=True)
                
                results[model_name] = {
                    "score": float(prediction),
                    "inputs": inputs_data
                }
            except Exception as e:
                results[model_file] = {"error": str(e)}
        else:
            results[model_file] = {"error": "Not found"}

    print(json.dumps({"predictions": results}))

if __name__ == "__main__":
    main()
