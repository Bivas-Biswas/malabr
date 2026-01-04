import pandas as pd
import matplotlib.pyplot as plt
from scipy.interpolate import make_interp_spline
import numpy as np

# =========================
# DATA INPUT
# =========================
unix_socket = {
    "Payload": ["33.22KB"]*5 + ["230KB"]*5 + ["1.5MB"]*5,
    "Iteration": [5000]*15,
    "Concurrency": [5, 25, 50, 100, 200]*3,
    "Average": [4.91, 25.77, 49.86, 98.91, 196.94,
                22.47, 102.93, 216.78, 434.19, 876.59,
                166.58, 811.67, 1625.49, 3214.35, 6453.11]
}

http = {
    "Payload": ["33.22KB"]*5 + ["230KB"]*5 + ["1.5MB"]*5,
    "Iteration": [5000]*15,
    "Concurrency": [5, 25, 50, 100, 200]*3,
    "Average": [17.88, 85.42, 169.83, 353.45, 725.11,
                36.51, 173.94, 341.22, 710.82, 1391.95,
                229.15, 1066.85, 2149.80, 4291.32, 8399.67]
}

# =========================
# DATA PREPARATION
# =========================
df_unix = pd.DataFrame(unix_socket)
df_http = pd.DataFrame(http)

payloads = ["33.22KB", "230KB", "1.5MB"]
titles = [
    "Average Pipeline Time vs Concurrency (33.22KB payload, 5000 iterations)",
    "Average Pipeline Time vs Concurrency (230KB payload, 5000 iterations)",
    "Average Pipeline Time vs Concurrency (1.5MB payload, 5000 iterations)"
]

# =========================
# PLOT CONFIGURATION
# =========================
for payload, title in zip(payloads, titles):
    subset_unix = df_unix[df_unix["Payload"] == payload]
    subset_http = df_http[df_http["Payload"] == payload]

    x = np.array(subset_unix["Concurrency"])
    y_unix = np.array(subset_unix["Average"])
    y_http = np.array(subset_http["Average"])

    # Smooth using cubic spline interpolation
    x_smooth = np.linspace(x.min(), x.max(), 200)
    y_unix_smooth = make_interp_spline(x, y_unix, k=3)(x_smooth)
    y_http_smooth = make_interp_spline(x, y_http, k=3)(x_smooth)

    plt.figure(figsize=(8, 6))

    # Smooth line plots
    plt.plot(x_smooth, y_unix_smooth, label="Unix Socket", linewidth=1.5)
    plt.plot(x_smooth, y_http_smooth, label="HTTP", linewidth=1.5, linestyle='--')

    plt.yscale("log")

    # Title at top
    plt.title(title, fontsize=14, fontweight='bold', pad=10)

    # Axis labels
    plt.xlabel("Concurrency", fontsize=14, fontweight='bold', labelpad=5)
    plt.ylabel("Average Pipeline Time (ms)", fontsize=14, fontweight='bold')

    # Grid and axis styling
    plt.tick_params(axis='both', which='major', labelsize=12, width=2)
    plt.grid(True, which="both", linestyle="--", linewidth=0.7, color="gray", alpha=0.7)
    
    # Bold axes
    for spine in plt.gca().spines.values():
        spine.set_linewidth(2)

    plt.legend(fontsize=12)
    plt.tight_layout()

    # Save to EPS
    eps_filename = f"smooth_plot_{payload.replace('.', '').replace('KB', 'KB').replace('MB', 'MB')}.eps"
    plt.savefig(eps_filename, format='eps', bbox_inches='tight')
    plt.show()
    print(f"Saved: {eps_filename}")
