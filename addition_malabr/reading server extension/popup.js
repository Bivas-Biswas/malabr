import { context, question } from './file3.js';

const loadModelBERTButton = document.getElementById('loadModelBERT');
const inferSingleButton = document.getElementById('inferSingleButton');
const inferBatchButton = document.getElementById('inferBatchButton');
const benchmarkInferenceButton = document.getElementById('benchmarkInferenceButton');
const trainModelButton = document.getElementById('trainModel');
const benchmarkInferenceResultEle = document.getElementById('benchmarkInferenceResult');

// Inputs for single inference.
const questionInput = document.getElementById('questionInput');
const contextInput = document.getElementById('contextInput');

// Input for batch inference (expects a JSON array).
const batchInput = document.getElementById('batchInput');

// Load MobileBERT Model.
loadModelBERTButton.addEventListener('click', () => {
  chrome.readServer.loadModelBERT((response) => {
    try {
      const parsedResponse = JSON.parse(response);
      if (parsedResponse.status) {
        console.log('Model loaded:', parsedResponse.status);
        alert('Model loaded: ' + parsedResponse.status);
      } else {
        console.error('Error:', parsedResponse.error);
        alert('Error: ' + parsedResponse.error);
      }
    } catch (e) {
      console.error('Failed to parse load model response:', e);
    }
  });
});

// Single Inference.
inferSingleButton.addEventListener('click', () => {
  // const question = questionInput.value.trim();
  // const context = contextInput.value.trim();
  // if (!question || !context) {
  //   alert('Please provide both a question and a context.');
  //   return;
  // }
  const payload = { question: question, context: context };
  const jsonPayload = JSON.stringify(payload);
  console.log("Single inference payload:", jsonPayload);
  chrome.readServer.inferSingleBERT(jsonPayload, (response) => {
    try {
      const parsedResponse = JSON.parse(response);
      if (parsedResponse.answer) {
        console.log('Single inference result:', parsedResponse.answer);
        alert('Answer: ' + parsedResponse.answer);
      } else {
        console.error('Error:', parsedResponse.error);
        alert('Error: ' + parsedResponse.error);
      }
    } catch (e) {
      // console.error('Failed to parse single inference response:', e,);
      alert('Error: Failed to parse inference response', response);
    }
  });
});


// Batch Inference.
inferBatchButton.addEventListener('click', () => {
  let batchData;
  try {
    const batchValue = batchInput.value.trim()
    if (!batchValue) {
      alert("Invalid JSON for batch input. Please provide a valid JSON array.");
      return;
    }
    batchData = JSON.parse(batchValue);
  } catch (e) {
    alert('Invalid JSON for batch input. Please provide a valid JSON array.');
    return;
  }
  const jsonPayload = JSON.stringify(batchData);
  console.log("Batch inference payload:", jsonPayload);
  chrome.readServer.inferBatchBERT(jsonPayload, (response) => {
    try {
      const parsedResponse = JSON.parse(response);
      console.log('Batch inference result:', parsedResponse);
      alert('Batch Inference Result: ' + JSON.stringify(parsedResponse));
    } catch (e) {
      console.error('Failed to parse batch inference response:', e);
      alert('Error: Failed to parse batch inference response');
    }
  });
});

function inferSingleBERTAsync(args) {
  return new Promise((resolve, reject) => {
    try {
      const payload = JSON.stringify({ question, context });
      // console.log(payload);
      chrome.readServer.inferSingleBERT(payload, (result) => {
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}


// Benchmark Inference.
benchmarkInferenceButton.addEventListener('click', async () => {
  benchmarkInferenceResultEle.textContent = "running"
  const payload = JSON.stringify({ question, context });
  await benchmarkWithSequential(payload, 10, 2);
  // await benchmarkBurst(payload, 50, 5);
  // await benchmarkWithConcurrency(payload, 5000, 50, 10);
  benchmarkInferenceResultEle.textContent = "done"

});


async function benchmarkWithConcurrency(payload, iterations, poolSize, warmup = 10) {
  // Warmup calls (not measured)
  for (let i = 0; i < warmup; i++) {
    await inferSingleBERTAsync(payload);
  }

  let completed = 0;
  let inFlight = 0;
  const latencies = [];
  const benchmarkStart = performance.now();

  return new Promise((resolve) => {
    function launchNext() {
      // stop condition: all iterations launched and completed
      if (completed >= iterations && inFlight === 0) {
        const benchmarkEnd = performance.now();
        const totalTime = (benchmarkEnd - benchmarkStart) / 1000; // in seconds
        const throughput = iterations / totalTime;

        // Compute latency stats
        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const median = latencies[Math.floor(latencies.length / 2)];
        const p90 = latencies[Math.floor(latencies.length * 0.9)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];

        // console.log(`Benchmark over ${iterations} iterations (concurrency=${poolSize}):`);
        // console.log(`Avg: ${avg.toFixed(2)} ms, Median: ${median.toFixed(2)} ms, P90: ${p90.toFixed(2)} ms, P99: ${p99.toFixed(2)} ms`);
        // console.log(`Throughput: ${throughput.toFixed(2)} requests/sec`);

        const result = `Benchmark (N=${iterations}, concurrency=${poolSize}):\n`
          + `Avg: ${avg.toFixed(2)} ms\n`
          + `Median: ${median.toFixed(2)} ms\n`
          + `P90: ${p90.toFixed(2)} ms\n`
          + `P99: ${p99.toFixed(2)} ms\n`
          + `Throughput: ${throughput.toFixed(2)} req/sec`;

        // singleBertInferBenchmarkIterationEle.textContent = "Iteration: " + iterations;
        // singleBertInferBenchmarkIterationTimeEle.textContent = result;
        alert(result);

        resolve({ latencies, throughput, totalTime });
        return;
      }

      if (completed >= iterations) {
        return; // no more work to launch
      }

      inFlight++;
      const start = performance.now();

      inferSingleBERTAsync(payload)
        .then(() => {
          latencies.push(performance.now() - start);
        })
        .finally(() => {
          inFlight--;
          completed++;
          launchNext(); // launch the next request
        });
    }

    // Kick off initial pool
    for (let i = 0; i < poolSize && i < iterations; i++) {
      launchNext();
    }
  });
}

async function benchmarkWithSequential(payload, iterations, warmup = 10) {
  // 🔹 Warmup phase (not measured)
  for (let i = 0; i < warmup; i++) {
    await inferSingleBERTAsync(payload);
  }

  // 🔹 Measure total wall-clock time
  const benchmarkStart = performance.now();
  let latencies = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await inferSingleBERTAsync(payload);
    const endTime = performance.now();
    latencies.push(endTime - startTime);
  }

  const benchmarkEnd = performance.now();
  const durationSec = (benchmarkEnd - benchmarkStart) / 1000;
  const throughput = iterations / durationSec;

  // 🔹 Compute latency statistics
  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, cur) => acc + cur, 0);
  const avg = sum / latencies.length;
  const median = latencies[Math.floor(latencies.length / 2)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  // 🔹 Print results
  console.log("Benchmark results (Sequential):");
  console.log(`Iterations: ${iterations}`);
  console.log(`Total time: ${durationSec.toFixed(2)} sec`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/sec`);
  console.log(`Avg latency: ${avg.toFixed(2)} ms`);
  console.log(`Median latency: ${median.toFixed(2)} ms`);
  console.log(`P90 latency: ${p90.toFixed(2)} ms`);
  console.log(`P99 latency: ${p99.toFixed(2)} ms`);

  // 🔹 Show summary popup
  const result = `Benchmark (N=${iterations}, Sequential):\n`
    + `Total time: ${durationSec.toFixed(2)} sec\n`
    + `Throughput: ${throughput.toFixed(2)} req/sec\n`
    + `Avg: ${avg.toFixed(2)} ms\n`
    + `Median: ${median.toFixed(2)} ms\n`
    + `P90: ${p90.toFixed(2)} ms\n`
    + `P99: ${p99.toFixed(2)} ms`;

  alert(result);
}

async function benchmarkBurst(payload, iterations, warmup = 10) {
  // 🔹 Warmup (not measured)
  for (let i = 0; i < warmup; i++) {
    await inferSingleBERTAsync(payload);
  }

  // 🔹 Measure total time across all parallel requests
  const benchmarkStart = performance.now();

  const startTimes = new Array(iterations);
  const promises = [];

  for (let i = 0; i < iterations; i++) {
    startTimes[i] = performance.now();
    promises.push(
      inferSingleBERTAsync(payload).then(
        () => performance.now() - startTimes[i]
      )
    );
  }

  const latencies = await Promise.all(promises);
  const benchmarkEnd = performance.now();
  const durationSec = (benchmarkEnd - benchmarkStart) / 1000;
  const throughput = iterations / durationSec;

  // 🔹 Stats
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const median = latencies[Math.floor(latencies.length / 2)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  // 🔹 Print results
  console.log(`Burst benchmark over ${iterations} parallel requests:`);
  console.log(`Total time: ${durationSec.toFixed(2)} sec`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/sec`);
  console.log(
    `Avg: ${avg.toFixed(2)} ms, Median: ${median.toFixed(2)} ms, P90: ${p90.toFixed(2)} ms, P99: ${p99.toFixed(2)} ms`
  );

  const result =
    `Burst Benchmark (N=${iterations}):\n` +
    `Total time: ${durationSec.toFixed(2)} sec\n` +
    `Throughput: ${throughput.toFixed(2)} req/sec\n` +
    `Avg: ${avg.toFixed(2)} ms\n` +
    `Median: ${median.toFixed(2)} ms\n` +
    `P90: ${p90.toFixed(2)} ms\n` +
    `P99: ${p99.toFixed(2)} ms`;

  alert(result);

  return { latencies, throughput, durationSec };
}

// Training with client-side timing
trainModelButton.addEventListener('click', () => {
  const startTime = performance.now(); // Start timing here
  chrome.readServer.trainModel((response) => {
    const endTime = performance.now(); // End timing when response is received
    const clientTime = endTime - startTime;

    try {
      const parsedResponse = JSON.parse(response);
      if (parsedResponse.training_time_ms && parsedResponse.accuracy) {
        console.log('Training result:', parsedResponse);
        // Display both client-side and backend timing
        alert(`Training completed:\nClient-side Time: ${clientTime.toFixed(2)} ms\nBackend Time: ${parsedResponse.training_time_ms.toFixed(2)} ms\nAccuracy: ${(parsedResponse.accuracy * 100).toFixed(2)}%`);
      } else {
        console.error('Error:', parsedResponse.error);
        alert('Error: ' + parsedResponse.error);
      }
    } catch (e) {
      console.error('Failed to parse training response:', e);
      alert('Error: Failed to parse training response');
    }
  });
});


