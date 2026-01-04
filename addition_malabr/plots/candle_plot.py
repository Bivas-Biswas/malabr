import pandas as pd
import plotly.graph_objects as go

# --- Data ---
data = {
    "Payload": ["33.22KB"]*5 + ["230KB"]*5 + ["1.5MB"]*5,
    "Iteration": [5000]*15,
    "Concurrency": [5, 25, 50, 100, 200]*3,
    "Average(%)": [72.53914989, 69.83142121, 70.64122946, 72.01584383, 72.8399829,
                   38.45521775, 40.82442221, 36.46914014, 38.91702541, 37.0243184,
                   27.30525856, 23.91901392, 24.38878035, 25.09647381, 23.17424375],
    "Median": [74.15730337, 70.51886792, 73.54685647, 72.39539455, 72.08672087,
               42.6183844, 40.85896692, 36.05882353, 39.05597327, 37.30951875,
               26.54071075, 23.83993988, 23.98880336, 25.40892964, 23.21512008],
    "90th Percentile": [73.70892019, 67.27078891, 56.96476965, 69.90056436, 70.41683,
                        38.14180929, 39.98929336, 32.72980501, 38.26537389, 34.97353061,
                        28.88303874, 22.98187066, 23.86024333, 25.40752351, 23.30994568],
    "99th Percentile": [59.765625, 63.62754607, 58.37708831, 65.8728148, 69.11314985,
                        -37.22943723, 37.98994975, 34.65864504, 38.00667009, 34.80485405,
                        29.19879316, 22.83340621, 24.16854322, 23.49390931, 22.92933066],
    "Throughput(req/sec)": [-263.8876952, -231.0553663, -240.2614424, -256.7649199, -270.5549351,
                            -62.53657109, -69.05813872, -57.50900526, -63.86345323, -58.82613184,
                            -37.54015603, -31.42734308, -32.2425829, -33.40698188, -30.18699911]
}

df = pd.DataFrame(data)

# --- Interactive Candle Plot ---
fig = go.Figure()

for payload in df["Payload"].unique():
    subset = df[df["Payload"] == payload]
    fig.add_trace(go.Candlestick(
        x=subset["Concurrency"],
        open=subset["Median"],
        high=subset["90th Percentile"],
        low=subset["99th Percentile"],
        close=subset["Average(%)"],
        name=payload
    ))

fig.update_layout(
    title="Candle Plot of Performance Metrics by Payload",
    xaxis_title="Concurrency",
    yaxis_title="Latency / Percentage",
    template="plotly_white",
    hovermode="x unified"
)

fig.show()
