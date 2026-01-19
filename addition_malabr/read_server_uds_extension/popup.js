import { flatbuffers } from './flatbuffers.js';
import QAService from './qa_schema_generated.js';
import { question, context } from './file3.js'

// console.log('flatbuffers:', flatbuffers);
// console.log('QAService:', QAService);
// console.log('QAService.Payloads:', QAService.Payloads);
// console.log('QAService.Payloads.QARequest:', QAService.Payloads?.QARequest);

// READ DATA
const readDataBtnEle = document.getElementById('readDataBtn');
const showReadDataResponseEle = document.getElementById('showReadDataResponse');

readDataBtnEle.addEventListener('click', () => {
  // Clear previous
  showReadDataResponseEle.textContent = '';
  showReadDataResponseEle.classList.remove('error');

  chrome.readServerUds.readData((response) => {
    if (chrome.runtime.lastError) {
      showReadDataResponseEle.textContent = 'Native Error: ' + chrome.runtime.lastError.message;
      showReadDataResponseEle.classList.add('error');
      return;
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch {
      showReadDataResponseEle.textContent = 'Invalid JSON response.';
      showReadDataResponseEle.classList.add('error');
      return;
    }

    if (!parsedResponse.status) {
      showReadDataResponseEle.textContent = parsedResponse.message || 'Server returned an error.';
      showReadDataResponseEle.classList.add('error');
      return;
    }

    showReadDataResponseEle.textContent = parsedResponse.message || 'Success!';
    showReadDataResponseEle.classList.remove('error');
  });
});


// SEND DATA
const sendDataBtnEle = document.getElementById('sendDataBtn');
const sendDataIptEle = document.getElementById('sendDataIpt');
const sendDataErrorEle = document.getElementById('sendDataError');
const showsendDataResponseEle = document.getElementById('showsendDataResponse');

sendDataBtnEle.addEventListener('click', () => {
  const message = sendDataIptEle.value.trim();

  // Clear previous
  sendDataErrorEle.textContent = '';
  sendDataErrorEle.classList.remove('error');
  showsendDataResponseEle.textContent = '';
  showsendDataResponseEle.classList.remove('error');

  if (!message) {
    sendDataErrorEle.textContent = 'Please enter a message before sending.';
    sendDataErrorEle.classList.add('error');
    return;
  }

  chrome.readServerUds.sendData(message, (response) => {
    if (chrome.runtime.lastError) {
      sendDataErrorEle.textContent = 'Native Error: ' + chrome.runtime.lastError.message;
      sendDataErrorEle.classList.add('error');
      return;
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch {
      sendDataErrorEle.textContent = 'Invalid JSON response.';
      sendDataErrorEle.classList.add('error');
      return;
    }

    if (parsedResponse.status == "error") {
      sendDataErrorEle.textContent = parsedResponse.message || 'Server returned an error.';
      sendDataErrorEle.classList.add('error');
      return;
    } else {
      showsendDataResponseEle.textContent = parsedResponse.message || 'Success!';
      // sendDataIptEle.value = '';
    }

  });
});


// LOAD BERT
const loadBertBtnEle = document.getElementById('loadBertBtn');
const showLoadBertResponseEle = document.getElementById('showLoadBertResponse');

loadBertBtnEle.addEventListener('click', () => {
  // Clear previous
  showLoadBertResponseEle.textContent = '';
  showLoadBertResponseEle.classList.remove('error');

  // show message loading
  showLoadBertResponseEle.textContent = 'Loading...';
  showLoadBertResponseEle.classList.add('loading');

  chrome.readServerUds.loadModelBERT((response) => {

    // removing the loading style
    showLoadBertResponseEle.textContent = '';
    showLoadBertResponseEle.classList.remove('loading');

    if (chrome.runtime.lastError) {
      showLoadBertResponseEle.textContent = 'Native Error: ' + chrome.runtime.lastError.message;
      showLoadBertResponseEle.classList.add('error');
      return;
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch {
      showLoadBertResponseEle.textContent = 'Invalid JSON response.';
      showLoadBertResponseEle.classList.add('error');
      return;
    }

    if (parsedResponse.status == "error") {
      showLoadBertResponseEle.textContent = parsedResponse.message || 'Server returned an error.';
      showLoadBertResponseEle.classList.add('error');
      return;
    } else {
      showLoadBertResponseEle.textContent = parsedResponse.message || 'Success!';
      showLoadBertResponseEle.classList.remove(['error'])
    }

  });
});


function createQARequestBuffer(question, context) {
  const builder = new flatbuffers.Builder(1024);

  // Create strings in buffer
  const questionOffset = builder.createString(question);
  const contextOffset = builder.createString(context);

  // Build QARequest
  QAService.Payloads.QARequest.startQARequest(builder);
  QAService.Payloads.QARequest.addQuestion(builder, questionOffset);
  QAService.Payloads.QARequest.addContext(builder, contextOffset);
  const qaRequestOffset = QAService.Payloads.QARequest.endQARequest(builder);

  // Wrap in Root table with union type
  QAService.Payloads.Root.startRoot(builder);
  QAService.Payloads.Root.addPayloadType(builder, QAService.Payloads.AnyPayload.QARequest);
  QAService.Payloads.Root.addPayload(builder, qaRequestOffset);
  const rootOffset = QAService.Payloads.Root.endRoot(builder);

  // Finish with file identifier
  builder.finish(rootOffset, "QASV");

  // Return as Uint8Array
  return builder.asUint8Array();
}


// SINGLE INFERENCE BERT
const singleBertInferBtnEle = document.getElementById('singleBertInferBtn');
const bertQuestionInputEle = document.getElementById('bertQuestionInput');
const bertContextInputEle = document.getElementById('bertContextInput');
const bertInputErrorEle = document.getElementById('bertInputError');
const singleBertInferResponseEle = document.getElementById('singleBertInferResponse');

singleBertInferBtnEle.addEventListener('click', () => {
  const question = bertQuestionInputEle.value.trim();
  const context = bertContextInputEle.value.trim();

  bertInputErrorEle.textContent = '';
  bertInputErrorEle.classList.remove('error');
  singleBertInferResponseEle.textContent = '';
  singleBertInferResponseEle.classList.remove('error');

  if (!question || !context) {
    bertInputErrorEle.textContent = 'Please fill both question and context before sending.';
    bertInputErrorEle.classList.add('error');
    return;
  }

  const flatbufferPayload = createQARequestBuffer(question, context);

  chrome.readServerUds.inferSingleBERT({ payload: flatbufferPayload, fb_id: "QASV" }, (response) => {
    if (chrome.runtime.lastError) {
      bertInputErrorEle.textContent = 'Native Error: ' + chrome.runtime.lastError.message;
      bertInputErrorEle.classList.add('error');
      return;
    }

    // Normal JSON on
    response = JSON.parse(response)
    if (response.status == "ok") {
      singleBertInferResponseEle.textContent = response.message;
    } else if (response.status == "error") {
      singleBertInferResponseEle.textContent = response.message;
      bertInputErrorEle.classList.add('error');
    } else {
      bertInputErrorEle.textContent = 'Unexpected payload type in response.';
      bertInputErrorEle.classList.add('error');
    }
  });
});

function inferSingleBERTAsync(args) {
  return new Promise((resolve, reject) => {
    try {
      const flatbufferPayload = createQARequestBuffer(question, context);
      // console.log(flatbufferPayload);
      chrome.readServerUds.inferSingleBERT({ payload: flatbufferPayload, fb_id: "QASV" }, (result) => {
      // chrome.readServerUds.inferSingleBERT(args, (result) => {
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// SINGLE INFERENCE BENCHMARK BERT
const singleBertInferBenchmarkBtnEle = document.getElementById('singleBertBenchmarkBtn');
const singleBertInferBenchmarkIterationEle = document.getElementById('singleBertInferBenchmarkIteration');
const singleBertInferBenchmarkIterationTimeEle = document.getElementById('singleBertInferBenchmarkIterationTime');
const NO_OF_INTERATION = 1000
const NO_OF_WARMUP_INTERATION = 100

singleBertInferBenchmarkBtnEle.addEventListener('click', async () => {
  // Define fixed question and context 

  const flatbufferPayload = createQARequestBuffer(question, context);
  singleBertInferBenchmarkIterationEle.textContent = "running";
  await benchmarkWithSequential({ payload: flatbufferPayload, fb_id: "QASV" }, 10, 2);
  // await benchmarkBurst({ payload: flatbufferPayload, fb_id: "QASV" }, 50, 5);
  // await benchmarkWithConcurrency({ payload: flatbufferPayload, fb_id: "QASV" }, 5000, 50, 10);
  singleBertInferBenchmarkIterationEle.textContent = "done";
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
