import sys
import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib

def emit_progress(percentage, message):
    print(f"PROGRESS:{percentage}:{message}", flush=True)

def calculate_y(df):
    """Calculate the target y as the mean of non-zero features for each row"""
    project_col = df.columns[0]
    feature_cols = df.columns[1:]
    
    y_values = []
    for _, row in df.iterrows():
        features = row[feature_cols].values
        non_zero = features[features > 0]
        if len(non_zero) > 0:
            y_values.append(np.mean(non_zero))
        else:
            y_values.append(0.0)
            
    df['y'] = y_values
    return df

def emit_error(message):
    print(message, file=sys.stderr, flush=True)

def main():
    if len(sys.argv) < 2:
        emit_error("Usage: python retrain_pipeline.py <path_to_cwe_area_matrix.csv>")
        sys.exit(1)
        
    input_csv = sys.argv[1]
    emit_progress(10, f"Loading input feature matrix from {input_csv}...")
    
    if not os.path.isfile(input_csv):
        emit_error(f"Error: The selected path is not a file. Please select a CSV file. Path: {input_csv}")
        sys.exit(1)
        
    try:
        feature_matrix = pd.read_csv(input_csv)
    except Exception as e:
        emit_error(f"Error loading CSV: {e}")
        sys.exit(1)
        
    project_col = feature_matrix.columns[0]
    
    emit_progress(20, "Loading category mappings...")
    cwe_to_categories = {}
    try:
        with open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'pipline', 'categorized.json'), 'r') as f:
            categorized_data = json.load(f)
        for mapping in categorized_data.get('cwe_qualitative_characteristics_mapping', []):
            cwe_to_categories[mapping['cwe_id']] = mapping['affected_characteristics']
    except Exception as e:
        emit_progress(25, f"Warning: categorized.json not found. Using fallback mapping for all CWEs.")
        # Fallback: assign all CWEs found in the CSV to all categories so training doesn't crash
        cwe_cols = [c for c in feature_matrix.columns if c != project_col]
        for col in cwe_cols:
            cwe_id = col.split('_')[0]
            cwe_to_categories[cwe_id] = [
                'Security', 'Confidentiality', 'Access Control', 'Integrity',
                'Availability', 'Non-Repudiation', 'Maintainability', 'Usability'
            ]
        
    all_categories = [
        'Security', 'Confidentiality', 'Access Control', 'Integrity',
        'Availability', 'Non-Repudiation', 'Maintainability', 'Usability'
    ]
    
    emit_progress(30, "Filtering rows with all zeros...")
    numeric_cols = [c for c in feature_matrix.columns if c != project_col]
    for col in numeric_cols:
        feature_matrix[col] = pd.to_numeric(feature_matrix[col], errors='coerce').fillna(0)
        
    feature_matrix['sum_cwe'] = feature_matrix[numeric_cols].sum(axis=1)
    filtered_matrix = feature_matrix[feature_matrix['sum_cwe'] > 0].drop(columns=['sum_cwe'])
    
    staging_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'ml_models_staging')
    os.makedirs(staging_dir, exist_ok=True)
    
    evaluation_results = {}
    total_categories = len(all_categories)
    
    for idx, category in enumerate(all_categories):
        progress = 40 + int(50 * (idx / total_categories))
        emit_progress(progress, f"Processing category: {category}...")
        
        relevant_cwes = [cwe for cwe, cats in cwe_to_categories.items() if category in cats]
        
        existing_cols = []
        for col in numeric_cols:
            cwe_id = col.split('_')[0]
            if cwe_id in relevant_cwes:
                existing_cols.append(col)
                
        if not existing_cols:
            evaluation_results[category] = {"status": "skipped", "reason": "No relevant features found"}
            continue
            
        cat_df = filtered_matrix[[project_col] + existing_cols].copy()
        cat_df['sum_relevant'] = cat_df[existing_cols].sum(axis=1)
        cat_df = cat_df[cat_df['sum_relevant'] > 0].drop(columns=['sum_relevant'])
        
        if len(cat_df) < 5:
            evaluation_results[category] = {"status": "skipped", "reason": f"Not enough data samples ({len(cat_df)})"}
            continue
            
        cat_df = calculate_y(cat_df)
        
        X = cat_df[existing_cols]
        y = cat_df['y']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        rf_model = RandomForestRegressor(
            n_estimators=700,
            max_depth=18,
            min_samples_split=2,
            min_samples_leaf=1,
            max_features='sqrt',
            bootstrap=True,
            random_state=42,
            n_jobs=-1
        )
        
        rf_model.fit(X_train, y_train)
        
        y_pred = rf_model.predict(X_test)
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        
        model_filename = f"{category.lower()}_random_forest_model.pkl"
        if category == 'Access Control': model_filename = "Access Control_random_forest_model.pkl"
        elif category == 'Integrity': model_filename = "Integrity_random_forest_model.pkl"
        elif category == 'Maintainability': model_filename = "Maintainability_random_forest_model.pkl"
        elif category == 'Non-Repudiation': model_filename = "non-repudiation_random_forest_model.pkl"

        joblib.dump(rf_model, os.path.join(staging_dir, model_filename))
        
        evaluation_results[category] = {
            "status": "success",
            "metrics": {
                "r2": round(float(r2), 4),
                "mae": round(float(mae), 4),
                "rmse": round(float(rmse), 4)
            },
            "samples": len(cat_df)
        }
        
    emit_progress(95, "Saving evaluation results...")
    with open(os.path.join(staging_dir, 'evaluation.json'), 'w') as f:
        json.dump(evaluation_results, f, indent=4)
        
    emit_progress(100, "Retraining pipeline completed successfully.")
    
if __name__ == "__main__":
    main()
