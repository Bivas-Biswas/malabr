import matplotlib.pyplot as plt

# Data for Unix Socket
concurrency_unix = [5, 25, 50, 100, 200]
average_unix = [
4.91,
25.77,
49.86,
98.91,
196.94
]

# Data for HTTP Flask Server
concurrency_http = [5, 25, 50, 100, 200]
average_http = [
17.88,
85.42,
169.83,
353.45,
725.11
]

# Plot
plt.figure(figsize=(10, 6))
plt.plot(concurrency_unix, average_unix, marker='o', color='green', label="Unix Socket")
plt.plot(concurrency_http, average_http, marker='o', color='blue', label="HTTP Flask Server")

# Title and labels
plt.title("5KB payload, 5000 iteration")
plt.xlabel("Concurrency")
plt.ylabel("Average Time (ms)")
plt.legend()
plt.grid(True)

plt.savefig("./5KB_5000_average.png", dpi=300, bbox_inches="tight")

plt.close()