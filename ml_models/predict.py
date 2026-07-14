import sys
import json
import os
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

    # Ensure these specific features are present
    features = [
        "CWE-129_area_area",
        "CWE-130_area_area",
        "CWE-131_area_area",
        "CWE-1321_area_area",
        "CWE-1333_area_area",
        "CWE-134_area_area",
        "CWE-159_area_area",
        "CWE-190_area_area",
        "CWE-191_area_area",
        "CWE-193_area_area"
    ]

    # Build the feature row
    row = {}
    for f in features:
        # The input_data comes keyed by CWE-XXX
        cwe = f.split('_')[0]
        row[f] = float(input_data.get(cwe, 0.0))

    df = pd.DataFrame([row])

    models_dir = os.path.dirname(os.path.abspath(__file__))
    model_files = [
        "Access Control_random_forest_model.pkl",
        "Integrity_random_forest_model.pkl",
        "Maintainability_random_forest_model.pkl",
        "availability_random_forest_model.pkl",
        "confidentiality_random_forest_model.pkl"
    ]

    results = {}
    for model_file in model_files:
        model_path = os.path.join(models_dir, model_file)
        if os.path.exists(model_path):
            try:
                model = joblib.load(model_path)
                prediction = model.predict(df)[0]
                model_name = model_file.replace("_random_forest_model.pkl", "")
                results[model_name] = float(prediction)
            except Exception as e:
                results[model_file] = f"Error: {str(e)}"
        else:
            results[model_file] = "Not found"

    print(json.dumps({"predictions": results}))

if __name__ == "__main__":
    main()
