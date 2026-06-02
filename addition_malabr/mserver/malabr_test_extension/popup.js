import LogisticRegression from "./malabr_js/logistic_regression.js";
import RandomForestClassifier from "./malabr_js/random_forest_classifier.js";
import SVC from "./malabr_js/svc.js";

const MODEL_REGISTRY = {
  logistic: LogisticRegression,
  random_forest: RandomForestClassifier,
  svc: SVC,
};

const modelSelect = document.getElementById("model-key");
const modelConfigInput = document.getElementById("model-config");
const trainXInput = document.getElementById("train-x");
const trainYInput = document.getElementById("train-y");
const testXInput = document.getElementById("test-x");
const testYInput = document.getElementById("test-y");
const runButton = document.getElementById("run-demo-btn");
const statusText = document.getElementById("run-status");
const output = document.getElementById("output");
const errorOutput = document.getElementById("error-output");

output.innerHTML = "<p class=\"output__empty\">Run the model to see formatted results.</p>";
errorOutput.textContent = "No errors.";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(value, label) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function parseJsonArray(value, label) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON array`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "n/a";
  }
  return score.toFixed(4);
}

function formatParamValue(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[object]";
    }
  }
  return String(value);
}

function extractParams(result) {
  const details = result.modelDetails;
  if (details && typeof details === "object") {
    if (details.params && typeof details.params === "object" && !Array.isArray(details.params)) {
      return details.params;
    }
    if (details.parameters && typeof details.parameters === "object" && !Array.isArray(details.parameters)) {
      return details.parameters;
    }
  }
  if (result.modelConfig && typeof result.modelConfig === "object" && !Array.isArray(result.modelConfig)) {
    return result.modelConfig;
  }
  return {};
}

function renderOutput(result) {
  const params = extractParams(result);

  const checksHtml = Object.entries(result.checks)
    .map(([key, value]) => {
      const cls = value ? "check check--ok" : "check check--bad";
      const mark = value ? "PASS" : "FAIL";
      return `<span class="${cls}">${escapeHtml(key)}: ${mark}</span>`;
    })
    .join("");

  const predictionsHtml = (Array.isArray(result.predictions) ? result.predictions : [])
    .map((value, index) => `<li>#${index + 1}: ${escapeHtml(value)}</li>`)
    .join("");

  const paramsEntries = Object.entries(params);
  const paramsHtml = paramsEntries.length
    ? paramsEntries
      .map(([key, value]) => `<li><span class="param__key">${escapeHtml(key)}</span><span class="param__value">${escapeHtml(formatParamValue(value))}</span></li>`)
      .join("")
    : "<li><span class=\"param__value\">No parameters provided.</span></li>";

  const statusValue = result.status && typeof result.status === "object"
    ? escapeHtml(result.status.status || "unknown")
    : "unknown";

  output.innerHTML = `
    <article class="result">
      <div class="result__top">
        <h3 class="result__title">${escapeHtml(result.model)} run</h3>
        <span class="result__tag">${result.allPassed ? "All checks passed" : "Checks failed"}</span>
      </div>

      <div class="metrics">
        <div class="metric">
          <p class="metric__label">Score</p>
          <p class="metric__value">${escapeHtml(formatScore(result.score))}</p>
        </div>
        <div class="metric">
          <p class="metric__label">Predictions</p>
          <p class="metric__value">${Array.isArray(result.predictions) ? result.predictions.length : 0}</p>
        </div>
        <div class="metric">
          <p class="metric__label">Status</p>
          <p class="metric__value">${statusValue}</p>
        </div>
      </div>

      <div class="checks">${checksHtml}</div>

      <div class="predictions">
        <p class="predictions__label">Prediction values</p>
        <ul class="prediction-list">${predictionsHtml}</ul>
      </div>

      <div class="params">
        <p class="predictions__label">Parameters</p>
        <ul class="param-list">${paramsHtml}</ul>
      </div>
    </article>
  `;
}

async function waitForReady(model, options = {}) {
  const maxAttempts = options.maxAttempts || 20;
  const intervalMs = options.intervalMs || 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await model.check_status();
    if (status && status.status === "ready") {
      return status;
    }
    if (status && status.status === "failed") {
      throw new Error(status.error_msg || "Training failed");
    }
    await sleep(intervalMs);
  }

  throw new Error("Model did not become ready in time");
}

async function runFromUi() {
  const modelKey = modelSelect.value;
  const ModelClass = MODEL_REGISTRY[modelKey];

  if (!ModelClass) {
    throw new Error(`Unsupported model: ${modelKey}`);
  }

  const modelConfig = parseJsonObject(modelConfigInput.value, "Model Config");
  const trainX = parseJsonArray(trainXInput.value, "Train X");
  const trainY = parseJsonArray(trainYInput.value, "Train Y");
  const testX = parseJsonArray(testXInput.value, "Test X");
  const testY = parseJsonArray(testYInput.value, "Test Y");

  if (trainX.length !== trainY.length) {
    throw new Error("Train X and Train Y must have the same number of elements");
  }

  if (testX.length !== testY.length) {
    throw new Error("Test X and Test Y must have the same number of elements");
  }

  if (trainX.length === 0 || testX.length === 0) {
    throw new Error("Train and test arrays must not be empty");
  }

  let model;

  model = new ModelClass(modelConfig, { name: `${modelKey}_demo_model` });

  try {
    statusText.textContent = "Training model...";

    const started = await model.fit(trainX, trainY);
    statusText.textContent = "Waiting for model readiness...";

    const status = await waitForReady(model);
    statusText.textContent = "Running prediction and scoring...";

    const yPred = await model.predict(testX);
    const modelScore = await model.score(testX, testY);

    const checks = {
      fitStarted: started === true,
      statusReady: status && status.status === "ready",
      predictionLengthMatch: Array.isArray(yPred) && yPred.length === testX.length,
      scoreInRange: typeof modelScore === "number" && modelScore >= 0 && modelScore <= 1
    };
    const allPassed = Object.values(checks).every(Boolean);

    const result = {
      model: modelKey,
      modelConfig,
      checks,
      allPassed,
      predictions: yPred,
      score: modelScore,
      status,
      modelDetails: model.details(),
    };

    renderOutput(result);
    errorOutput.textContent = "No errors.";
    statusText.textContent = allPassed ? "Run completed successfully." : "Run completed with failed checks.";

  } catch (error) {
    output.innerHTML = "<p class=\"output__empty\">Run failed. Fix inputs and try again.</p>";
    errorOutput.textContent = error && error.stack ? error.stack : String(error.message || error);
    statusText.textContent = "Run failed.";
  } finally {
    if (model && typeof model.destroy === "function") {
      model.destroy();
    }
  }
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  statusText.textContent = "Starting run...";
  output.innerHTML = "<p class=\"output__empty\">Running model...</p>";
  errorOutput.textContent = "No errors.";

  await runFromUi();

  runButton.disabled = false;
});