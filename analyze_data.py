import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, accuracy_score, precision_recall_fscore_support
import glob

class ThesisAnalyzer:
    def __init__(self):
        # Load all thesis data CSV files
        all_files = glob.glob("thesis_data_*.csv")
        if not all_files: 
            raise FileNotFoundError("No 'thesis_data_*.csv' files found!")
        
        self.df = pd.concat((pd.read_csv(f) for f in all_files), ignore_index=True)
        print(f"Loaded {len(self.df)} frames from {len(all_files)} sessions.")

    def generate_thesis_report(self):
        print("\n" + "="*60)
        print(" THESIS RESULTS: ENVIRONMENTAL & DYNAMIC ANALYSIS")
        print("="*60)
        
        # --- 1. OVERALL PERFORMANCE ---
        acc = accuracy_score(self.df['Ground_Truth'], self.df['Predicted_Letter'])
        fps = self.df['FPS'].mean()
        print(f"\n[OBJECTIVE 1] GLOBAL METRICS")
        print(f"  Accuracy: {acc*100:.2f}%")
        print(f"  Avg Speed: {fps:.2f} FPS")
        
        #Helper function to calculate all metrics
        def get_detailed_metrics(x):
            # Calculate Precision, Recall, F1 (weighted average handles class imbalance)
            p, r, f1, _ = precision_recall_fscore_support(
                x['Ground_Truth'], 
                x['Predicted_Letter'], 
                average='weighted', 
                zero_division=0
            )
            acc_score = accuracy_score(x['Ground_Truth'], x['Predicted_Letter'])
            
            return pd.Series({
                'Accuracy (%)': acc_score * 100,
                'Precision': p,
                'Recall': r,
                'F1-Score': f1,
                'Avg Confidence': x['Confidence'].mean(),
                'Avg FPS': x['FPS'].mean(),
                'Sample Size': len(x)
            })

        # --- 2. STATIC VS DYNAMIC (Objective 2) ---
        print(f"\n[OBJECTIVE 2] STATIC VS DYNAMIC GESTURES")
        if 'Gesture_Type' in self.df.columns:
            # Groups data by Static/Dynamic and applies the detailed metrics function
            obj2_table = self.df.groupby('Gesture_Type').apply(get_detailed_metrics, include_groups=False).round(4)
            
            print(obj2_table.to_string())
            obj2_table.to_csv("obj2_static_vs_dynamic_detailed.csv")
        
        # --- 3. ENVIRONMENTAL CONDITIONS (Objective 3) ---
        print(f"\n[OBJECTIVE 3] ENVIRONMENTAL CONDITIONS")
        print("Comparison of: Bright/Dim Lighting x Plain/Noisy Background")
        
        if 'Environment' in self.df.columns:
            # Groups data by Environment and applies the detailed metrics function
            env_stats = self.df.groupby('Environment').apply(get_detailed_metrics, include_groups=False).round(4)
            
            # Sort explicitly for Bright/Dim presentation order
            desired_order = ['Bright_Plain', 'Dim_Plain', 'Bright_Noisy', 'Dim_Noisy']
            # Only index with existing keys to prevent errors if some environments are missing
            existing_order = [e for e in desired_order if e in env_stats.index]
            env_stats = env_stats.reindex(existing_order)
            
            print("\nEnvironment Performance Table:")
            print(env_stats.to_string())
            env_stats.to_csv("obj3_environment_detailed.csv")
            
            # --- PLOTTING ENVIRONMENTAL CHART ---
            plt.figure(figsize=(10, 6))
            if not env_stats.empty:
                sns.barplot(
                    x=env_stats.index, 
                    y=env_stats['Accuracy (%)'], 
                    hue=env_stats.index, 
                    legend=False, 
                    palette='viridis'
                )
                plt.title('Accuracy by Environmental Condition')
                plt.ylim(0, 100)
                plt.ylabel('Accuracy (%)')
                plt.xticks(rotation=15)
                plt.tight_layout()
                plt.savefig('obj3_env_chart.png')
                print("\n[SAVED] Chart: obj3_env_chart.png")
            else:
                print("\n[SKIP] Not enough data to generate Environment Chart.")

        # --- 4. CONFUSION MATRIX ---
        # Ensure we use all letters present in Ground Truth and Predictions for proper matrix shape
        all_labels = sorted(list(set(self.df['Ground_Truth'].unique()) | set(self.df['Predicted_Letter'].unique())))
        
        cm = confusion_matrix(self.df['Ground_Truth'], self.df['Predicted_Letter'], labels=all_labels)
        plt.figure(figsize=(12, 10))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=all_labels, yticklabels=all_labels)
        plt.title('Confusion Matrix')
        plt.xlabel('Predicted Label')
        plt.ylabel('True Label')
        plt.tight_layout()
        plt.savefig('confusion_matrix.png')
        print("[SAVED] Matrix: confusion_matrix.png")

# --- FIXED CODE BELOW ---
if __name__ == "__main__":
    Analyzer = ThesisAnalyzer()
    Analyzer.generate_thesis_report()