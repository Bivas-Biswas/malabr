import pandas as pd
import plotly.graph_objects as go

# =========================
# DATA INPUT
# =========================
data1 = {
    "Payload": ["33.22KB"]*5 + ["230KB"]*5 + ["1.5MB"]*5,
    "Iteration": [5000]*15,
    "Concurrency": [5, 25, 50, 100, 200]*3,
    "Average": [4.91, 25.77, 49.86, 98.91, 196.94,
                22.47, 102.93, 216.78, 434.19, 876.59,
                166.58, 811.67, 1625.49, 3214.35, 6453.11]
}

data2 = {
    "Payload": ["33.22KB"]*5 + ["230KB"]*5 + ["1.5MB"]*5,
    "Iteration": [5000]*15,
    "Concurrency": [5, 25, 50, 100, 200]*3,
    "Average": [17.88, 85.42, 169.83, 353.45, 725.11,
                36.51, 173.94, 341.22, 710.82, 1391.95,
                229.15, 1066.85, 2149.80, 4291.32, 8399.67]
}

df1 = pd.DataFrame(data1)
df2 = pd.DataFrame(data2)

# =========================
# PLOT CONFIGURATION
# =========================
fig = go.Figure()

payloads = df1["Payload"].unique()

# Plot each payload for both datasets
for payload in payloads:
    subset1 = df1[df1["Payload"] == payload]
    subset2 = df2[df2["Payload"] == payload]
    
    # Dataset 1 (solid line)
    fig.add_trace(go.Scatter(
        x=subset1["Concurrency"], y=subset1["Average"],
        mode='lines',
        name=f"{payload} - Dataset 1",
        line_shape='spline',
        line=dict(width=4),
        hovertemplate='Payload: %{text}<br>Concurrency: %{x}<br>Average: %{y}<extra></extra>',
        text=[payload]*len(subset1)
    ))
    
    # Dataset 2 (dotted line)
    fig.add_trace(go.Scatter(
        x=subset2["Concurrency"], y=subset2["Average"],
        mode='lines',
        name=f"{payload} - Dataset 2",
        line_shape='spline',
        line=dict(width=4, dash='dot'),
        hovertemplate='Payload: %{text}<br>Concurrency: %{x}<br>Average: %{y}<extra></extra>',
        text=[payload]*len(subset2)
    ))

# =========================
# STYLE AND LAYOUT
# =========================
fig.update_layout(
    xaxis_title="Concurrency",
    yaxis_title="Average (ms)",
    yaxis_type="log",
    hovermode="x unified",
    template="plotly_white",
    font=dict(size=18),
    margin=dict(l=80, r=50, t=80, b=150),
    annotations=[
        dict(
            text="Performance Comparison (Smoothed Curves, Log Scale)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.5, y=-0.25,
            xanchor="center", yanchor="top",
            font=dict(size=18)
        )
    ]
)

# Axis and grid styling
fig.update_xaxes(
    showline=True, linewidth=3, linecolor='black', mirror=True,
    showgrid=True, gridcolor='lightgray', tickfont=dict(size=18)
)
fig.update_yaxes(
    showline=True, linewidth=3, linecolor='black', mirror=True,
    showgrid=True, gridcolor='lightgray',
    tickvals=[1, 10, 100, 1000, 10000, 100000],
    ticktext=[f"10<sup>{i}</sup>" for i in range(0, 6)],
    tickfont=dict(size=18)
)

# =========================
# SAVE FIGURE
# =========================
output_path = "performance_comparison.pdf"
fig.write_image(output_path, format="pdf")

print(f"EPS file successfully saved as: {output_path}")
