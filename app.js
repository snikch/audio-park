(() => {
  "use strict";

  if (new URLSearchParams(location.search).get("station")) {
    return;
  }

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "audioPark.signalDispatch.v4";
  const MOTION_KEY = "audioPark.reducedMotion";
  const chapterNames = [
    "Orientation",
    "Signal level",
    "Gain in dB",
    "Headroom",
    "Optional bench extension",
  ];
  const defaults = {
    chapter: 0,
    maxChapter: 0,
    completed: [false, false, false, false, false],
    waveform: { vrms: 0.5, frequency: 1000 },
    gain: { vin: 0.5, db: 6 },
    headroom: { vin: 0.5, db: 6, limit: 1, prediction: "", revealed: false },
    lab: {
      source: "",
      sourceIdentity: "",
      sourceReference: "",
      sourceLimits: "",
      fixtureReference: "",
      r1: "",
      r2: "",
      intendedVin: "0.500",
      predictedVout: "",
      observedVin: "",
      observedVout: "",
      scopeSettings: "",
      captureReference: "",
      comparison: "",
      checks: [false, false, false, false],
      status: "not-started",
    },
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return structuredClone(defaults);
      return {
        ...structuredClone(defaults),
        ...saved,
        waveform: { ...defaults.waveform, ...saved.waveform },
        gain: { ...defaults.gain, ...saved.gain },
        headroom: { ...defaults.headroom, ...saved.headroom },
        lab: { ...defaults.lab, ...saved.lab },
        completed: defaults.completed.map((value, index) =>
          Boolean(saved.completed?.[index] ?? value),
        ),
      };
    } catch {
      return structuredClone(defaults);
    }
  }

  let state = loadState();
  let paused = false;
  let animationTime = 0;
  let animationSpeed = 1;
  let worldScale = 1;
  const savedMotion = localStorage.getItem(MOTION_KEY);
  let reducedMotion = savedMotion === null
    ? matchMedia("(prefers-reduced-motion: reduce)").matches
    : savedMotion === "true";
  let cartTravel = 1;
  let cartFrom = { x: 236, y: 390 };
  let cartTo = { x: 236, y: 390 };
  let cartPosition = { x: 236, y: 390 };

  document.title = "Audio Park — Signal Dispatch";

  function worldTargetForChapter(index) {
    const targets = [
      { x: 236, y: 390 },
      { x: 330, y: 360 },
      { x: 390, y: 328 },
      { x: 462, y: 356 },
      { x: 505, y: 386 },
    ];
    if (index === 3 && state.headroom.revealed) {
      const clips =
        state.headroom.vin * ratioFromDb(state.headroom.db) >
        state.headroom.limit;
      return clips ? { x: 468, y: 356 } : { x: 556, y: 330 };
    }
    return targets[index];
  }

  function setJourneyTarget(target, replayFromPrevious = false) {
    cartFrom = replayFromPrevious
      ? worldTargetForChapter(Math.max(0, state.chapter - 1))
      : { ...cartPosition };
    cartTo = { ...target };
    cartTravel = reducedMotion ? 1 : 0;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function completeChapter(index) {
    state.completed[index] = true;
    state.maxChapter = Math.max(
      state.maxChapter,
      Math.min(index + 1, chapterNames.length - 1),
    );
    saveState();
    renderNav();
    renderFooter();
    updateStationAccess();
  }

  function instructionCurrent() {
    return state.completed.slice(1, 4).every(Boolean) && state.headroom.revealed;
  }

  function updateBalancedAccess() {
    const ready = instructionCurrent();
    const station = $("balancedStation");
    const route = $("balancedRoute");
    station.classList.toggle("released-station", ready);
    station.classList.toggle("locked-station", !ready);
    station.setAttribute(
      "aria-label",
      ready ? "Open Balanced Tunnel" : "Balanced Tunnel needs the Signal Dispatch instructional sequence",
    );
    route.disabled = !ready;
    route.classList.toggle("released", ready);
    route.classList.toggle("locked", !ready);
  }

  function readProgress(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function balancedInstructionCurrent() {
    const candidate = readProgress("audioPark.balancedTunnel.v1");
    return Boolean(
      candidate?.completed?.slice(1, 5).every(Boolean) &&
        candidate.rejection?.revealed &&
        candidate.units?.revealed &&
        candidate.coupling?.revealed &&
        candidate.retrieval?.common === "average" &&
        candidate.retrieval?.balance === "impedance" &&
        candidate.retrieval?.rejection === "system" &&
        candidate.retrieval?.units === "normalize" &&
        candidate.retrieval?.coupling === "conditional",
    );
  }

  function gainInstructionCurrent() {
    try {
      const candidate = readProgress("audioPark.gainLift.v1");
      return Boolean(
        candidate?.completed?.slice(1, 5).every(Boolean) &&
          candidate.prediction?.revealed &&
          candidate.retrieval?.gain === "headroom" &&
          candidate.retrieval?.loading === "parallel" &&
          candidate.retrieval?.noise === "early",
      );
    } catch {
      return false;
    }
  }

  function zoneInstructionCurrent() {
    const candidate = readProgress("audioPark.zoneSwitchyard.v1");
    return Boolean(
      candidate?.completed?.slice(1, 5).every(Boolean) &&
        candidate.prediction?.revealed &&
        candidate.retrieval?.first === "segments" &&
        candidate.retrieval?.second === "muteFirst" &&
        candidate.design?.choice === "separate",
    );
  }

  function setStationAccess(id, routeId, ready, openLabel, lockedLabel) {
    const station = $(id);
    const route = $(routeId);
    station.classList.toggle("released-station", ready);
    station.classList.toggle("locked-station", !ready);
    station.setAttribute("aria-label", ready ? openLabel : lockedLabel);
    if (ready) station.removeAttribute("data-lock");
    route.disabled = !ready;
    route.classList.toggle("released", ready);
    route.classList.toggle("locked", !ready);
  }

  function updateGainAccess() {
    setStationAccess(
      "gainStation",
      "gainRoute",
      balancedInstructionCurrent(),
      "Open Gain Lift",
      "Gain Lift needs the Balanced Tunnel instructional sequence",
    );
  }

  function updateZoneAccess() {
    const ready = gainInstructionCurrent();
    setStationAccess(
      "zoneStation",
      "zoneRoute",
      ready,
      "Open Zone Switchyard",
      "Zone Switchyard needs the Gain Lift instructional sequence",
    );
  }

  function updatePowerAccess() {
    setStationAccess(
      "powerStation",
      "powerRoute",
      zoneInstructionCurrent(),
      "Open Power Gorge",
      "Power Gorge needs the Zone Switchyard instructional sequence",
    );
  }

  function updateStationAccess() {
    updateBalancedAccess();
    updateGainAccess();
    updateZoneAccess();
    updatePowerAccess();
    const open = 1 + Number(instructionCurrent()) + Number(balancedInstructionCurrent()) + Number(gainInstructionCurrent()) + Number(zoneInstructionCurrent());
    $("routeStatus").textContent = `${open} station${open === 1 ? "" : "s"} open`;
  }

  function format(value, decimals = 3) {
    return Number(value).toFixed(decimals);
  }

  function safe(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function ratioFromDb(db) {
    return 10 ** (db / 20);
  }

  function renderNav() {
    const nav = $("lessonNav");
    nav.replaceChildren();
    chapterNames.forEach((name, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1} ${name}`;
      button.disabled = index > state.maxChapter;
      if (index === state.chapter) button.setAttribute("aria-current", "step");
      if (state.completed[index]) button.classList.add("complete");
      button.addEventListener("click", () => goToChapter(index));
      nav.append(button);
    });
    $("lessonCount").textContent =
      `${state.chapter + 1} / ${chapterNames.length}`;
    const dots = $("lessonDots");
    dots.innerHTML = chapterNames
      .map(
        (_, index) =>
          `<i class="${index === state.chapter ? "active" : ""}"></i>`,
      )
      .join("");
  }

  function renderFooter() {
    const previous = $("previousLesson");
    const next = $("nextLesson");
    previous.disabled = state.chapter === 0;
    next.disabled =
      state.chapter > 0 &&
      state.chapter !== chapterNames.length - 1 &&
      !state.completed[state.chapter];
    if (state.chapter === 0) next.textContent = "Begin lesson →";
    else if (state.chapter === chapterNames.length - 1)
      next.textContent = state.lab.status === "evidence-recorded"
        ? "Optional lab badge ✓"
        : "Optional bench extension";
    else next.textContent = "Continue →";
  }

  function goToChapter(index) {
    if (index < 0 || index >= chapterNames.length || index > state.maxChapter)
      return;
    state.chapter = index;
    setJourneyTarget(worldTargetForChapter(index));
    saveState();
    render();
    $("guide").scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function render() {
    renderNav();
    renderFooter();
    const content = $("lessonContent");
    content.innerHTML = chapterTemplates[state.chapter]();
    chapterBindings[state.chapter]();
    updateWorld(true);
  }

  const chapterTemplates = [
    () => `
      <div class="lesson-banner">A signal is a changing voltage measured between two points.</div>
      <h2>Meet the signal cart</h2>
      <p>The yellow cart represents a controlled stereo line-level test signal. It begins at the DJ/streamer yard and eventually travels through source conditioning, gain, zone control, power amplifiers, and speakers.</p>
      <p>Before changing the signal, you need a precise language for describing what the cart carries. This station introduces that language in small steps.</p>
      <div class="tycoon-tip"><b>Tycoon tip:</b> The cart is a model, not electricity in a box. Its height, colour, and cargo label visualize calculated signal state.</div>
      <h3>What this station teaches</h3>
      <ul>
        <li>Voltage always has a reference.</li>
        <li>Vrms, Vpeak, Vpp, and frequency describe a sine wave.</li>
        <li>dB describes a ratio between input and output.</li>
        <li>Headroom is unused output capability; clipping occurs when the requested output exceeds it.</li>
        <li>A measurement fixture is drawn and understood before instruments are connected.</li>
      </ul>
      <div class="safety-box"><b>Bench boundary:</b> Nothing in the first four lessons asks you to connect hardware. The physical lab is a passive two-resistor circuit at no more than 1 Vrms. It uses no bench PSU, amplifier, or speaker.</div>
      <div class="completion-card"><h3>Ready to depart?</h3><p>Use <b>Begin lesson</b> below. The cart will enter Signal Dispatch and load its first useful quantity: voltage level.</p></div>
    `,
    () => {
      const { vrms, frequency } = state.waveform;
      return `
        <div class="lesson-banner">Vrms tells you the useful level of a sine wave; Vpeak and Vpp describe its excursions.</div>
        <h2>Signal level</h2>
        <p>Voltage is a difference between two points. For this teaching sine wave, the signal swings above and below a defined 0 V reference.</p>
        <div class="formula-card">
          <span class="formula">Vpeak = Vrms × √2</span>
          <span class="formula">Vpp = 2 × Vpeak</span>
          <span class="formula-note">These conversions apply to a sine wave. Other waveform shapes have different RMS relationships.</span>
        </div>
        <div class="interactive-card">
          <h3>Observe the waveform</h3>
          <div class="control-row"><label for="vrmsControl">Level</label><output id="vrmsValue">${format(vrms)} Vrms</output><input id="vrmsControl" type="range" min="0.1" max="1" step="0.05" value="${vrms}" /></div>
          <div class="control-row"><label for="frequencyControl">Frequency</label><output id="frequencyValue">${frequency} Hz</output><input id="frequencyControl" type="range" min="100" max="10000" step="100" value="${frequency}" /></div>
          <div class="wave-panel"><svg viewBox="0 0 360 140" aria-label="Animated sine wave"><g class="wave-grid">${[30, 60, 90, 120].map((y) => `<line x1="0" y1="${y}" x2="360" y2="${y}" />`).join("")}${[60, 120, 180, 240, 300].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="140" />`).join("")}</g><line class="wave-zero" x1="0" y1="70" x2="360" y2="70" /><path id="wavePath" class="wave-line" /></svg></div>
          <div class="metric-grid"><div class="metric"><small>RMS level</small><strong id="metricVrms"></strong></div><div class="metric"><small>Positive peak</small><strong id="metricPeak"></strong></div><div class="metric"><small>Peak to peak</small><strong id="metricVpp"></strong></div></div>
          <p id="frequencyExplanation" class="tycoon-tip"></p>
        </div>
        <div class="check-card">
          <h3>Check your model</h3>
          <p>A sine wave is 0.500 Vrms. What is its approximate peak-to-peak voltage?</p>
          <div class="answer-list">
            <label><input type="radio" name="waveAnswer" value="0.500" /> 0.500 Vpp</label>
            <label><input type="radio" name="waveAnswer" value="0.707" /> 0.707 Vpp</label>
            <label><input type="radio" name="waveAnswer" value="1.414" /> 1.414 Vpp</label>
          </div>
          <button id="checkWave" class="action-button" type="button">Check answer</button>
          <p id="waveFeedback" class="feedback" aria-live="polite"></p>
        </div>
      `;
    },
    () => {
      const { vin, db } = state.gain;
      const ratio = ratioFromDb(db);
      return `
        <div class="lesson-banner">dB is a compact way to describe a ratio between two signal levels.</div>
        <h2>Gain in decibels</h2>
        <p>Voltage gain compares output voltage with input voltage. Positive dB means a larger voltage; negative dB means attenuation.</p>
        <div class="formula-card">
          <span class="formula">voltage ratio = 10^(gain dB / 20)</span>
          <span class="formula">Vout = Vin × voltage ratio</span>
          <span class="formula-note">The ratio has no unit. Vin and Vout must use the same voltage unit.</span>
        </div>
        <table class="anchor-table"><thead><tr><th>Gain</th><th>Ratio</th><th>Intuition</th></tr></thead><tbody><tr><td>−6.0206 dB</td><td>0.500×</td><td>half voltage</td></tr><tr><td>0 dB</td><td>1.000×</td><td>same voltage</td></tr><tr><td>+6 dB</td><td>1.995×</td><td>almost double</td></tr><tr><td>+6.0206 dB</td><td>2.000×</td><td>exactly double</td></tr><tr><td>+12 dB</td><td>3.981×</td><td>almost four times</td></tr></tbody></table>
        <div class="tycoon-tip"><b>Key fact:</b> +6 dB increases Vrms by about 100%. More precisely, it produces 1.995 times the starting voltage. Exact doubling is +6.0206 dB.</div>
        <div class="interactive-card">
          <h3>Load the gain cart</h3>
          <div class="control-row"><label for="gainVin">Input level</label><output id="gainVinValue">${format(vin)} Vrms</output><input id="gainVin" type="range" min="0.1" max="1" step="0.05" value="${vin}" /></div>
          <div class="control-row"><label for="gainDb">Gain</label><output id="gainDbValue">${db > 0 ? "+" : ""}${db} dB</output><input id="gainDb" type="range" min="-12" max="18" step="1" value="${db}" /></div>
          <div class="metric-grid"><div class="metric"><small>Voltage ratio</small><strong id="gainRatio">${format(ratio)}×</strong></div><div class="metric"><small>Calculated output</small><strong id="gainOutput">${format(vin * ratio)} Vrms</strong></div><div class="metric"><small>Voltage change</small><strong id="gainChange">${format((ratio - 1) * 100, 1)}%</strong></div></div>
          <div id="gainCalculation" class="formula-card"></div>
        </div>
        <div class="check-card"><h3>Retrieve it</h3><p>0.500 Vrms receives +6 dB gain. Which output is closest?</p><div class="answer-list"><label><input type="radio" name="gainAnswer" value="0.25" /> 0.250 Vrms</label><label><input type="radio" name="gainAnswer" value="0.75" /> 0.750 Vrms</label><label><input type="radio" name="gainAnswer" value="0.998" /> 0.998 Vrms</label><label><input type="radio" name="gainAnswer" value="3" /> 3.000 Vrms</label></div><button id="checkGain" class="action-button" type="button">Check answer</button><p id="gainFeedback" class="feedback" aria-live="polite"></p></div>
      `;
    },
    () => {
      const h = state.headroom;
      return `
        <div class="lesson-banner">Headroom is the unused output capability between the requested signal and a stage's usable limit.</div>
        <h2>Headroom and clipping</h2>
        <p>Every real stage has a maximum usable output swing. That limit depends on supply rails, circuit, load, frequency, and the distortion criterion. The adjustable limit below is deliberately labelled <b>model limit</b>; it is not a measurement of the PT2314, NE5532 module, or Fosi amplifiers.</p>
        <div class="formula-card"><span class="formula">predicted output = Vin × 10^(gain dB / 20)</span><span class="formula">headroom = model limit − predicted output</span><span class="formula-note">Positive headroom fits the chosen model. Negative headroom predicts clipping.</span></div>
        <div class="interactive-card">
          <h3>Set a condition, then predict</h3>
          <div class="control-row"><label for="headVin">Input level</label><output id="headVinValue">${format(h.vin)} Vrms</output><input id="headVin" type="range" min="0.1" max="1.2" step="0.05" value="${h.vin}" /></div>
          <div class="control-row"><label for="headDb">Gain</label><output id="headDbValue">${h.db > 0 ? "+" : ""}${h.db} dB</output><input id="headDb" type="range" min="-6" max="18" step="1" value="${h.db}" /></div>
          <div class="control-row"><label for="headLimit">Model output limit</label><output id="headLimitValue">${format(h.limit)} Vrms</output><input id="headLimit" type="range" min="0.5" max="2" step="0.05" value="${h.limit}" /></div>
          <div id="headroomTrack" class="headroom-track"><div class="headroom-safe"></div><div class="headroom-limit"></div><div id="headroomSignal" class="headroom-signal"></div><span class="track-label">model limit</span></div>
          <div id="headroomLocked" class="prediction-lock ${h.revealed ? "revealed" : ""}">${h.revealed ? "Outcome revealed below." : "Output and headroom stay hidden until you commit a prediction."}</div>
          <div class="answer-list"><label><input type="radio" name="headPrediction" value="fits" ${h.prediction === "fits" ? "checked" : ""} /> It fits within the model limit</label><label><input type="radio" name="headPrediction" value="clips" ${h.prediction === "clips" ? "checked" : ""} /> It exceeds the model limit and clips</label></div>
          <button id="revealHeadroom" class="action-button" type="button">Commit prediction and reveal</button>
          <div id="headroomResult"></div>
        </div>
        <div class="tycoon-tip"><b>Engineering judgement:</b> A result that fits by only 0.002 Vrms has essentially no useful margin. A final gain plan needs allowance for source variation, loading, component tolerances, frequency, supply conditions, and the chosen distortion limit.</div>
      `;
    },
    () => {
      const lab = state.lab;
      return `
        <div class="lesson-banner">Optional bench extension: a passive divider with two resistors, one safe sine source, and one clearly defined 0 V reference.</div>
        <h2>Optional bench extension: measure a 2:1 divider</h2>
        <p>This activity can add a measured-versus-model badge. It does not control lesson or station availability.</p>
        <p>A resistor divider uses two resistors in series. Vout is taken from their junction. With equal resistors and a light measurement load, Vout is approximately half Vin.</p>
        <pre class="diagram" aria-label="Resistor divider wiring diagram">source signal ── R1 10 kΩ ──┬── Vout
                             │
                           R2 10 kΩ
                             │
source return ───────────────┴── circuit 0 V

scope ground clip ────────────────────┘
scope probe tip  ── measure Vin, then Vout</pre>
        <div class="formula-card"><span class="formula">Vout = Vin × R2 / (R1 + R2)</span><span class="formula">equal resistors → Vout ≈ Vin × 0.5</span></div>
        <div class="safety-box"><b>Boundary:</b> ≤1 Vrms test sine only. No bench PSU, amplifier, speaker output, DJ booth, streamer, PT2314, or Fosi connection. Connect or move wires with the source output disabled.</div>

        <div class="lab-card">
          <h3>1. Identify the stimulus source</h3>
          <p>A suitable source produces an adjustable, repeatable sine wave near 1 kHz at no more than 1 Vrms, with a known output return.</p>
          <label for="sourceChoice"><b>What source will you use?</b></label>
          <select id="sourceChoice">
            <option value="" ${lab.source === "" ? "selected" : ""}>Choose only when known</option>
            <option value="generator" ${lab.source === "generator" ? "selected" : ""}>Bench function generator</option>
            <option value="interface" ${lab.source === "interface" ? "selected" : ""}>Audio interface / USB sound device</option>
            <option value="tone-module" ${lab.source === "tone-module" ? "selected" : ""}>Purpose-built low-level tone module</option>
            <option value="none" ${lab.source === "none" ? "selected" : ""}>No suitable source available yet</option>
          </select>
          <div id="sourceGuidance" class="blocked-box"></div>
          <div class="evidence-grid source-record">
            <label>Exact source / software / device<input id="sourceIdentity" type="text" value="${safe(lab.sourceIdentity)}" placeholder="Make/model or named software + output device" /></label>
            <label>Signal and return evidence<input id="sourceReference" type="text" value="${safe(lab.sourceReference)}" placeholder="Manual section, continuity result, or drawing reference" /></label>
            <label class="wide">Adjustable range, frequency behaviour, and limitations<textarea id="sourceLimits" rows="3" placeholder="Record verified controls, safe range, reference behaviour, and uncertainties.">${safe(lab.sourceLimits)}</textarea></label>
          </div>
        </div>

        <div class="lab-card">
          <h3>2. Confirm the fixture before connecting</h3>
          <p>A scope channel measures between its probe tip and ground clip. Many bench-scope ground clips are tied to protective earth.</p>
          <div class="step-list">
            <label><input class="lab-check" data-index="0" type="checkbox" ${lab.checks[0] ? "checked" : ""} /><span>I identified the source signal and source return from a manual or safe continuity check.</span></label>
            <label><input class="lab-check" data-index="1" type="checkbox" ${lab.checks[1] ? "checked" : ""} /><span>I identified whether the scope ground clip is earth-referenced; if uncertain, I treat it as earth-referenced.</span></label>
            <label><input class="lab-check" data-index="2" type="checkbox" ${lab.checks[2] ? "checked" : ""} /><span>I drew the source, both resistors, source return, probe tip, and probe ground.</span></label>
            <label><input class="lab-check" data-index="3" type="checkbox" ${lab.checks[3] ? "checked" : ""} /><span>I will attach the ground clip only to the divider's circuit 0 V.</span></label>
          </div>
          <label class="standalone-field">Fixture drawing reference<input id="fixtureReference" type="text" value="${safe(lab.fixtureReference)}" placeholder="Notebook page, local evidence path, or evidence.md row" /></label>
        </div>

        <div class="lab-card">
          <h3>3. Predict from measured resistor values</h3>
          <div class="evidence-grid">
            <label>R1 measured (Ω)<input id="labR1" type="number" min="1" step="1" value="${safe(lab.r1)}" placeholder="e.g. 9980" /></label>
            <label>R2 measured (Ω)<input id="labR2" type="number" min="1" step="1" value="${safe(lab.r2)}" placeholder="e.g. 10020" /></label>
            <label>Intended Vin (Vrms)<input id="labIntendedVin" type="number" min="0.01" max="1" step="0.001" value="${safe(lab.intendedVin)}" /></label>
            <label>Predicted Vout (Vrms)<input id="labPredicted" type="text" readonly value="${safe(lab.predictedVout)}" placeholder="calculate first" /></label>
          </div>
          <button id="calculateDivider" class="action-button" type="button">Calculate prediction</button>
          <p id="dividerFeedback" class="feedback"></p>
        </div>

        <div class="lab-card">
          <h3>4. Record observation only after measuring</h3>
          <div class="evidence-grid">
            <label>Observed Vin (Vrms)<input id="labObservedVin" type="number" min="0" max="1" step="0.001" value="${safe(lab.observedVin)}" /></label>
            <label>Observed Vout (Vrms)<input id="labObservedVout" type="number" min="0" max="1" step="0.001" value="${safe(lab.observedVout)}" /></label>
            <label class="wide">Scope settings<input id="scopeSettings" type="text" value="${safe(lab.scopeSettings)}" placeholder="Frequency, probe attenuation, coupling, bandwidth limit" /></label>
            <label class="wide">Vin and Vout capture reference<input id="captureReference" type="text" value="${safe(lab.captureReference)}" placeholder="Screenshot paths, notebook references, or evidence.md row" /></label>
            <label class="wide">Prediction-versus-observation interpretation<textarea id="labComparison" rows="3" placeholder="Describe the difference and a plausible reason.">${safe(lab.comparison)}</textarea></label>
          </div>
          <p class="tycoon-tip"><b>Correlation gate:</b> the observed Vout must be within 5% or 10 mV (whichever is larger) of the value recalculated from observed Vin and the measured resistors. A larger difference is useful evidence, but it opens an investigation instead of the next station.</p>
          <button id="saveLab" class="action-button" type="button">Save lab state</button>
          <p id="labFeedback" class="feedback" aria-live="polite"></p>
        </div>
        <div id="labCompletion"></div>
      `;
    },
  ];

  const chapterBindings = [
    () => {
      $("cartCargo").textContent = "quiet test signal";
      $("worldNarration").textContent =
        "The signal cart waits in the source yard. Begin by learning what its voltage label means.";
    },
    bindWaveform,
    bindGain,
    bindHeadroom,
    bindLab,
  ];

  function bindWaveform() {
    const vrms = $("vrmsControl");
    const frequency = $("frequencyControl");
    const update = () => {
      state.waveform.vrms = Number(vrms.value);
      state.waveform.frequency = Number(frequency.value);
      const peak = state.waveform.vrms * Math.SQRT2;
      const vpp = peak * 2;
      $("vrmsValue").textContent = `${format(state.waveform.vrms)} Vrms`;
      $("frequencyValue").textContent = `${state.waveform.frequency} Hz`;
      $("metricVrms").textContent = `${format(state.waveform.vrms)} V`;
      $("metricPeak").textContent = `${format(peak)} V`;
      $("metricVpp").textContent = `${format(vpp)} V`;
      const cycles = 1 + (Math.log10(state.waveform.frequency) - 2) * 2.5;
      const amplitude = 55 * state.waveform.vrms;
      drawWaveformPanel(cycles, amplitude);
      $("frequencyExplanation").innerHTML =
        `<b>Observe:</b> frequency changes how many cycles occur each second. It does not change the ${format(state.waveform.vrms)} Vrms level or its peak conversions.`;
      $("cartCargo").textContent =
        `${format(state.waveform.vrms)} Vrms · ${state.waveform.frequency} Hz`;
      saveState();
      updateWorld();
    };
    vrms.addEventListener("input", update);
    frequency.addEventListener("input", update);
    $("checkWave").addEventListener("click", () => {
      const answer = document.querySelector('input[name="waveAnswer"]:checked');
      const feedback = $("waveFeedback");
      if (!answer)
        return setFeedback(
          feedback,
          "Choose an answer before checking.",
          false,
        );
      const correct = answer.value === "1.414";
      setFeedback(
        feedback,
        correct
          ? "Correct. 0.500 × √2 × 2 = 1.414 Vpp."
          : "Not yet. Convert Vrms to Vpeak with √2, then double Vpeak.",
        correct,
      );
      if (correct) completeChapter(1);
    });
    update();
    $("worldNarration").textContent =
      "Signal Dispatch draws the cart's sine wave. Change level and frequency separately and watch which quantities respond.";
  }

  function drawWaveformPanel(cycles, amplitude) {
    const pathElement = $("wavePath");
    if (!pathElement) return;
    if (cycles === undefined) {
      cycles = 1 + (Math.log10(state.waveform.frequency) - 2) * 2.5;
    }
    if (amplitude === undefined) amplitude = 55 * state.waveform.vrms;
    let path = "";
    for (let x = 0; x <= 360; x += 3) {
      const y =
        70 -
        Math.sin((x / 360) * Math.PI * 2 * cycles + animationTime) * amplitude;
      path += `${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    }
    pathElement.setAttribute("d", path);
  }

  function bindGain() {
    const vin = $("gainVin");
    const db = $("gainDb");
    const update = () => {
      state.gain.vin = Number(vin.value);
      state.gain.db = Number(db.value);
      const ratio = ratioFromDb(state.gain.db);
      const output = state.gain.vin * ratio;
      $("gainVinValue").textContent = `${format(state.gain.vin)} Vrms`;
      $("gainDbValue").textContent =
        `${state.gain.db > 0 ? "+" : ""}${state.gain.db} dB`;
      $("gainRatio").textContent = `${format(ratio)}×`;
      $("gainOutput").textContent = `${format(output)} Vrms`;
      $("gainChange").textContent = `${format((ratio - 1) * 100, 1)}%`;
      $("gainCalculation").innerHTML =
        `<span class="formula">${format(state.gain.vin)} Vrms × 10^(${state.gain.db} / 20)</span><span class="formula">= ${format(state.gain.vin)} Vrms × ${format(ratio)}</span><span class="formula">= ${format(output)} Vrms</span>`;
      $("cartCargo").textContent = `${format(output)} Vrms after gain`;
      saveState();
      updateWorld();
    };
    vin.addEventListener("input", update);
    db.addEventListener("input", update);
    $("checkGain").addEventListener("click", () => {
      const answer = document.querySelector('input[name="gainAnswer"]:checked');
      const feedback = $("gainFeedback");
      if (!answer)
        return setFeedback(
          feedback,
          "Choose an output before checking.",
          false,
        );
      const correct = answer.value === "0.998";
      setFeedback(
        feedback,
        correct
          ? "Correct. +6 dB is 1.995×, so 0.500 Vrms becomes about 0.998 Vrms."
          : "Use 10^(6/20) = 1.995, then multiply by 0.500 Vrms.",
        correct,
      );
      if (correct) completeChapter(2);
    });
    update();
    $("worldNarration").textContent =
      "The source crane raises the cart according to the voltage ratio. +6 dB nearly doubles its level.";
  }

  function bindHeadroom() {
    const h = state.headroom;
    const vin = $("headVin");
    const db = $("headDb");
    const limit = $("headLimit");
    const resetPrediction = () => {
      h.vin = Number(vin.value);
      h.db = Number(db.value);
      h.limit = Number(limit.value);
      h.prediction = "";
      h.revealed = false;
      setJourneyTarget(worldTargetForChapter(3));
      saveState();
      render();
    };
    vin.addEventListener("change", resetPrediction);
    db.addEventListener("change", resetPrediction);
    limit.addEventListener("change", resetPrediction);
    document.querySelectorAll('input[name="headPrediction"]').forEach((input) =>
      input.addEventListener("change", () => {
        h.prediction = input.value;
        saveState();
      }),
    );
    $("revealHeadroom").addEventListener("click", () => {
      const selected = document.querySelector(
        'input[name="headPrediction"]:checked',
      );
      if (!selected) {
        $("headroomResult").innerHTML =
          '<p class="feedback incorrect">Choose a prediction before revealing the result.</p>';
        return;
      }
      h.prediction = selected.value;
      h.revealed = true;
      setJourneyTarget(worldTargetForChapter(3));
      const output = h.vin * ratioFromDb(h.db);
      const headroom = h.limit - output;
      const fits = headroom >= 0;
      const correct =
        (fits && h.prediction === "fits") ||
        (!fits && h.prediction === "clips");
      saveState();
      render();
      const result = $("headroomResult");
      result.innerHTML = `<div class="formula-card"><span class="formula">output = ${format(h.vin)} × ${format(ratioFromDb(h.db))} = ${format(output)} Vrms</span><span class="formula">headroom = ${format(h.limit)} − ${format(output)} = ${format(headroom)} Vrms</span></div><p class="feedback ${correct ? "correct" : "incorrect"}">${correct ? "Prediction confirmed." : "Prediction did not match the model."} ${fits ? "The sine fits within this model limit." : "The requested output exceeds this model limit, so the model clips."}</p>`;
      if (correct) completeChapter(3);
      updateWorld();
    });
    if (h.revealed) {
      const output = h.vin * ratioFromDb(h.db);
      const headroom = h.limit - output;
      const fits = headroom >= 0;
      const correct =
        (fits && h.prediction === "fits") ||
        (!fits && h.prediction === "clips");
      $("headroomResult").innerHTML =
        `<div class="formula-card"><span class="formula">output = ${format(h.vin)} × ${format(ratioFromDb(h.db))} = ${format(output)} Vrms</span><span class="formula">headroom = ${format(h.limit)} − ${format(output)} = ${format(headroom)} Vrms</span></div><p class="feedback ${correct ? "correct" : "incorrect"}">${correct ? "Prediction confirmed." : "Prediction did not match the model."} ${fits ? "The sine fits within this model limit." : "The requested output exceeds this model limit, so the model clips."}</p>`;
      const width = Math.min(100, (output / h.limit) * 72);
      $("headroomSignal").style.width = `${width}%`;
    } else {
      $("headroomSignal").style.width = "0";
    }
    $("cartCargo").textContent = h.revealed
      ? `${format(h.vin * ratioFromDb(h.db))} Vrms modeled`
      : "prediction sealed";
    $("worldNarration").textContent = h.revealed
      ? "The barrier shows the chosen model limit. The cart only changes colour after your prediction is committed."
      : "The station hides the consequence. Use the rule, commit a prediction, then reveal the cart's result.";
  }

  function bindLab() {
    const lab = state.lab;
    const source = $("sourceChoice");
    const invalidateLab = (clearPrediction = false) => {
      lab.status = "not-started";
      if (clearPrediction) {
        lab.predictedVout = "";
        $("labPredicted").value = "";
      }
      saveState();
      renderFooter();
      renderLabCompletion();
      updateWorld();
    };
    const updateSourceGuidance = () => {
      lab.source = source.value;
      const guidance = $("sourceGuidance");
      const copy = {
        "": "Do not guess. Check what equipment or software you actually have before choosing.",
        generator:
          "Confirm the generator output connector, return/reference, sine mode, 1 kHz setting, amplitude units, and whether its return is earth-referenced.",
        interface:
          "Confirm the audio interface output pinout and reference. Begin at minimum volume. Do not assume its software level display equals the scope's measured Vrms.",
        "tone-module":
          "Confirm supply, output reference, waveform, frequency, and maximum amplitude from authoritative information or safe measurement.",
        none: "The practical lab is blocked, not failed. Complete the fixture drawing and record that a suitable stimulus source must be identified or obtained before measuring.",
      };
      guidance.textContent = copy[lab.source];
      saveState();
    };
    source.addEventListener("change", () => {
      invalidateLab();
      updateSourceGuidance();
    });
    document.querySelectorAll(".lab-check").forEach((check) =>
      check.addEventListener("change", () => {
        invalidateLab();
        lab.checks[Number(check.dataset.index)] = check.checked;
        saveState();
      }),
    );
    ["labR1", "labR2", "labIntendedVin"].forEach((id) =>
      $(id).addEventListener("input", () => invalidateLab(true)),
    );
    [
      "sourceIdentity",
      "sourceReference",
      "sourceLimits",
      "fixtureReference",
      "labObservedVin",
      "labObservedVout",
      "scopeSettings",
      "captureReference",
      "labComparison",
    ].forEach((id) => $(id).addEventListener("input", () => invalidateLab()));
    $("calculateDivider").addEventListener("click", () => {
      const r1 = Number($("labR1").value);
      const r2 = Number($("labR2").value);
      const intendedVin = Number($("labIntendedVin").value);
      const feedback = $("dividerFeedback");
      if (!(r1 > 0 && r2 > 0 && intendedVin > 0 && intendedVin <= 1)) {
        return setFeedback(
          feedback,
          "Enter positive measured resistor values and an intended Vin no greater than 1 Vrms.",
          false,
        );
      }
      lab.r1 = String(r1);
      lab.r2 = String(r2);
      lab.intendedVin = format(intendedVin);
      lab.predictedVout = format((intendedVin * r2) / (r1 + r2));
      saveState();
      $("labPredicted").value = lab.predictedVout;
      setFeedback(
        feedback,
        `Prediction saved: ${lab.predictedVout} Vrms. Keep it hidden from the observation until after measuring.`,
        true,
      );
    });
    $("saveLab").addEventListener("click", () => {
      lab.sourceIdentity = $("sourceIdentity").value.trim();
      lab.sourceReference = $("sourceReference").value.trim();
      lab.sourceLimits = $("sourceLimits").value.trim();
      lab.fixtureReference = $("fixtureReference").value.trim();
      lab.r1 = $("labR1").value.trim();
      lab.r2 = $("labR2").value.trim();
      lab.intendedVin = $("labIntendedVin").value.trim();
      lab.observedVin = $("labObservedVin").value.trim();
      lab.observedVout = $("labObservedVout").value.trim();
      lab.scopeSettings = $("scopeSettings").value.trim();
      lab.captureReference = $("captureReference").value.trim();
      lab.comparison = $("labComparison").value.trim();
      const feedback = $("labFeedback");
      if (lab.source === "none") {
        lab.status = "blocked-source";
        saveState();
        setFeedback(
          feedback,
          "Blocked state saved. Do not invent measurements; identify a suitable stimulus source before continuing.",
          true,
        );
        renderLabCompletion();
        return;
      }
      if (!lab.source)
        return setFeedback(
          feedback,
          "Identify the stimulus source or explicitly record that none is available.",
          false,
        );
      if (!lab.checks.every(Boolean))
        return setFeedback(
          feedback,
          "Complete all four fixture checks before recording a measurement.",
          false,
        );
      if (
        !lab.sourceIdentity ||
        !lab.sourceReference ||
        !lab.sourceLimits ||
        !lab.fixtureReference
      )
        return setFeedback(
          feedback,
          "Record the exact source, signal/return evidence, verified limits, and fixture drawing reference.",
          false,
        );
      const r1 = Number(lab.r1);
      const r2 = Number(lab.r2);
      const intendedVin = Number(lab.intendedVin);
      const recalculatedPrediction = (intendedVin * r2) / (r1 + r2);
      if (!(
        r1 > 0 &&
        r2 > 0 &&
        intendedVin > 0 &&
        intendedVin <= 1 &&
        lab.predictedVout &&
        Math.abs(Number(lab.predictedVout) - recalculatedPrediction) <= 0.0006
      ))
        return setFeedback(
          feedback,
          "The resistor or intended-input fields do not match the saved prediction. Calculate it again before measuring.",
          false,
        );
      if (
        !(Number(lab.observedVin) > 0 && Number(lab.observedVout) >= 0) ||
        !lab.scopeSettings ||
        !lab.captureReference ||
        !lab.comparison
      )
        return setFeedback(
          feedback,
          "Record observed Vin/Vout, scope settings, both capture references, and your interpretation.",
          false,
        );
      const observedVin = Number(lab.observedVin);
      const observedVout = Number(lab.observedVout);
      if (observedVin > 1 || observedVout > 1)
        return setFeedback(
          feedback,
          "The recorded level exceeds this lab boundary. Disable the source and check the setup.",
          false,
        );
      const expectedFromObservedVin = (observedVin * r2) / (r1 + r2);
      const allowedDifference = Math.max(0.01, expectedFromObservedVin * 0.05);
      const observedDifference = Math.abs(
        observedVout - expectedFromObservedVin,
      );
      if (observedDifference > allowedDifference) {
        lab.status = "needs-investigation";
        saveState();
        setFeedback(
          feedback,
          `Evidence saved for investigation. With the measured resistors and ${format(observedVin)} Vrms observed Vin, expected Vout is ${format(expectedFromObservedVin)} Vrms. The ${format(observedDifference)} Vrms difference exceeds the ${format(allowedDifference)} Vrms correlation limit. Disable the source and inspect the fixture before repeating.`,
          false,
        );
        renderLabCompletion();
        updateWorld();
        return;
      }
      lab.status = "evidence-recorded";
      saveState();
      setFeedback(
        feedback,
        `Optional lab evidence accepted. Expected Vout from observed Vin is ${format(expectedFromObservedVin)} Vrms; the ${format(observedDifference)} Vrms difference is within the ${format(allowedDifference)} Vrms correlation limit.`,
        true,
      );
      renderLabCompletion();
      updateWorld();
    });
    updateSourceGuidance();
    renderLabCompletion();
    $("cartCargo").textContent = "fixture map";
    $("worldNarration").textContent =
      "The cart is parked in the bench bay. Hardware work begins only after the source and every reference conductor are identified.";
  }

  function renderLabCompletion() {
    const target = $("labCompletion");
    if (!target) return;
    if (state.lab.status === "blocked-source") {
      target.innerHTML =
        '<div class="blocked-box"><b>Optional lab safely blocked:</b> the fixture model is available, but no suitable stimulus source is recorded. Course lessons remain available.</div>';
    } else if (state.lab.status === "needs-investigation") {
      target.innerHTML =
        '<div class="blocked-box"><b>Investigation gate:</b> the readings and evidence references are saved, but the divider result does not correlate with its calculated ratio. Disable the source and inspect wiring, references, settings, and resistor values before repeating the measurement.</div>';
    } else if (state.lab.status === "evidence-recorded") {
      target.innerHTML =
        '<div class="completion-card"><h3>Optional Signal Dispatch bench badge recorded</h3><p>The evidence is retained for measured-versus-model comparison. Course progression remains instructional.</p></div>';
    } else {
      target.innerHTML =
        '<div class="blocked-box"><b>Gate open for work:</b> complete the source, fixture, prediction, and observation records. It is valid to stop with a documented blocker.</div>';
    }
  }

  function setFeedback(element, message, correct) {
    element.textContent = message;
    element.className = `feedback ${correct ? "correct" : "incorrect"}`;
  }

  function updateWorld(force = false) {
    const cart = $("signalCart");
    const wave = $("cartWave");
    const barrier = $("crestBarrier");
    const eased = 1 - (1 - cartTravel) ** 3;
    cartPosition = {
      x: cartFrom.x + (cartTo.x - cartFrom.x) * eased,
      y: cartFrom.y + (cartTo.y - cartFrom.y) * eased,
    };
    cart.setAttribute(
      "transform",
      `translate(${cartPosition.x.toFixed(1)} ${cartPosition.y.toFixed(1)})`,
    );
    let amplitude = 7;
    let cycles = 2;
    if (state.chapter === 1) {
      amplitude = 4 + state.waveform.vrms * 13;
      cycles = 1 + (Math.log10(state.waveform.frequency) - 2) * 1.5;
    } else if (state.chapter === 2) {
      amplitude = Math.min(18, 6 + ratioFromDb(state.gain.db) * 3);
      cycles = 2;
    } else if (state.chapter === 3 && state.headroom.revealed) {
      amplitude = Math.min(
        20,
        5 + state.headroom.vin * ratioFromDb(state.headroom.db) * 8,
      );
    }
    const clips =
      state.chapter === 3 &&
      state.headroom.revealed &&
      state.headroom.vin * ratioFromDb(state.headroom.db) >
        state.headroom.limit;
    let d = "";
    for (let x = -23; x <= 23; x += 2) {
      let waveValue =
        Math.sin(((x + 23) / 46) * Math.PI * 2 * cycles + animationTime) *
        amplitude;
      if (clips) {
        const clipLevel = amplitude * 0.48;
        waveValue = Math.max(-clipLevel, Math.min(clipLevel, waveValue));
      }
      const y = -7 - waveValue;
      d += `${x === -23 ? "M" : "L"}${x},${y.toFixed(1)} `;
    }
    wave.setAttribute("d", d);
    barrier.classList.toggle("visible", clips);
    cart.classList.toggle("clipping", clips);
    const tunnel = $("balancedStation");
    tunnel?.classList.toggle("ready-station", instructionCurrent());
    updateCamera();
    if (force && !reducedMotion) cart.getBoundingClientRect();
  }

  function animate() {
    if (!paused && !reducedMotion) {
      animationTime += 0.035 * animationSpeed;
      cartTravel = Math.min(1, cartTravel + 0.012 * animationSpeed);
    }
    updateWorld();
    if (state.chapter === 1 && !paused && !reducedMotion) drawWaveformPanel();
    requestAnimationFrame(animate);
  }

  $("previousLesson").addEventListener("click", () =>
    goToChapter(state.chapter - 1),
  );
  $("nextLesson").addEventListener("click", () => {
    if (state.chapter === 0) {
      completeChapter(0);
      goToChapter(1);
    } else if (
      state.completed[state.chapter] &&
      state.chapter < chapterNames.length - 1
    ) {
      goToChapter(state.chapter + 1);
    }
  });
  $("dispatchStation").addEventListener("click", () =>
    goToChapter(Math.min(state.maxChapter, 1)),
  );
  $("dispatchRoute").addEventListener("click", () =>
    goToChapter(Math.min(state.maxChapter, 1)),
  );
  const openBalancedTunnel = () => {
    if (!instructionCurrent()) {
      $("worldNarration").textContent =
        "Balanced Tunnel needs the Signal Dispatch simulation, committed prediction, and retrieval sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=balanced";
  };
  const openZoneSwitchyard = () => {
    if (!gainInstructionCurrent()) {
      $("worldNarration").textContent =
        "Zone Switchyard needs the Gain Lift simulation, committed prediction, retrieval, and design sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=zone";
  };
  const openGainLift = () => {
    if (!balancedInstructionCurrent()) {
      $("worldNarration").textContent =
        "Gain Lift needs the Balanced Tunnel simulation, committed predictions, and retrieval sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=gain";
  };
  const openPowerGorge = () => {
    if (!zoneInstructionCurrent()) {
      $("worldNarration").textContent =
        "Power Gorge needs the Zone Switchyard simulation, committed prediction, retrieval, and design sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=power";
  };
  $("balancedStation").addEventListener("click", openBalancedTunnel);
  $("balancedStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openBalancedTunnel();
    }
  });
  $("balancedRoute").addEventListener("click", openBalancedTunnel);
  $("gainStation").addEventListener("click", openGainLift);
  $("gainStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGainLift();
    }
  });
  $("gainRoute").addEventListener("click", openGainLift);
  $("zoneStation").addEventListener("click", openZoneSwitchyard);
  $("zoneStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openZoneSwitchyard();
    }
  });
  $("zoneRoute").addEventListener("click", openZoneSwitchyard);
  $("powerStation").addEventListener("click", openPowerGorge);
  $("powerStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPowerGorge();
    }
  });
  $("powerRoute").addEventListener("click", openPowerGorge);
  $("dispatchStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToChapter(Math.min(state.maxChapter, 1));
    }
  });
  $("pauseButton").addEventListener("click", () => {
    paused = !paused;
    $("pauseButton").setAttribute("aria-pressed", String(paused));
    $("pauseButton").querySelector("span").textContent = paused ? "▶" : "Ⅱ";
    $("pauseButton").querySelector(".control-label").textContent = paused
      ? "Play"
      : "Pause";
  });
  $("stepButton").addEventListener("click", () => {
    paused = true;
    animationTime += 0.45;
    cartTravel = Math.min(1, cartTravel + 0.18);
    $("pauseButton").setAttribute("aria-pressed", "true");
    $("pauseButton").querySelector("span").textContent = "▶";
    $("pauseButton").querySelector(".control-label").textContent = "Play";
    updateWorld();
  });
  $("replayButton").addEventListener("click", () => {
    animationTime = 0;
    paused = false;
    setJourneyTarget(worldTargetForChapter(state.chapter), true);
    $("pauseButton").setAttribute("aria-pressed", "false");
    $("pauseButton").querySelector("span").textContent = "Ⅱ";
    $("pauseButton").querySelector(".control-label").textContent = "Pause";
    updateWorld(true);
  });
  $("inspectButton").addEventListener("click", () => {
    const summaries = [
      "Cart: quiet test signal. Reference: not assigned until the fixture is drawn. Hardware: disconnected.",
      `Cart: ${format(state.waveform.vrms)} Vrms at ${state.waveform.frequency} Hz. This is a calculated sine model.`,
      `Cart: ${format(state.gain.vin)} Vrms × ${format(ratioFromDb(state.gain.db))} = ${format(state.gain.vin * ratioFromDb(state.gain.db))} Vrms.`,
      state.headroom.revealed
        ? `Cart: ${format(state.headroom.vin * ratioFromDb(state.headroom.db))} Vrms against a ${format(state.headroom.limit)} Vrms model limit.`
        : "Cart outcome is sealed until a headroom prediction is committed.",
      `Bench gate: ${state.lab.status}. Source and every reference conductor must be identified before measurement.`,
    ];
    $("worldNarration").textContent = summaries[state.chapter];
  });
  function renderMotionControl() {
    $("motionButton").setAttribute("aria-pressed", String(reducedMotion));
    $("motionButton").setAttribute(
      "aria-label",
      reducedMotion ? "Disable reduced motion" : "Enable reduced motion",
    );
    $("motionButton").classList.toggle("active", reducedMotion);
  }
  $("motionButton").addEventListener("click", () => {
    reducedMotion = !reducedMotion;
    localStorage.setItem(MOTION_KEY, String(reducedMotion));
    if (reducedMotion) cartTravel = 1;
    renderMotionControl();
    updateWorld(true);
  });
  $("speedControl").addEventListener("input", (event) => {
    animationSpeed = Number(event.target.value);
    $("speedOutput").textContent = `${animationSpeed}×`;
  });
  $("signToggle").addEventListener("change", (event) =>
    $("world").classList.toggle("no-signs", !event.target.checked),
  );
  $("followToggle").addEventListener("change", updateCamera);
  $("zoomIn").addEventListener("click", () =>
    setWorldScale(Math.min(1.5, worldScale + 0.1)),
  );
  $("zoomOut").addEventListener("click", () =>
    setWorldScale(Math.max(0.75, worldScale - 0.1)),
  );
  $("fitWorld").addEventListener("click", () => setWorldScale(1));
  function setWorldScale(value) {
    worldScale = value;
    updateCamera();
  }

  function updateCamera() {
    const park = $("park");
    const follow = $("followToggle")?.checked;
    park.style.transformOrigin = follow
      ? `${(cartPosition.x / 1200) * 100}% ${(cartPosition.y / 760) * 100}%`
      : "50% 50%";
    park.style.transform = `scale(${worldScale})`;
  }

  function updateResponsiveView() {
    const mobile = matchMedia("(max-width: 640px)").matches;
    $("park").setAttribute(
      "viewBox",
      mobile ? "130 205 700 445" : "0 0 1200 760",
    );
    if (mobile && worldScale !== 1) setWorldScale(1);
  }

  function inspectLockedStation(event) {
    const station = event.currentTarget;
    $("worldNarration").textContent = station.dataset.lock;
    station.focus();
  }

  document.querySelectorAll("[data-lock]").forEach((station) => {
    if (["gainStation", "zoneStation", "powerStation"].includes(station.id)) return;
    station.addEventListener("click", inspectLockedStation);
    station.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspectLockedStation(event);
      }
    });
  });
  addEventListener("resize", updateResponsiveView);
  $("guideToggle").addEventListener("click", () => {
    const hidden = document.body.classList.toggle("guide-hidden");
    $("guideToggle").textContent = hidden ? "Show guide" : "Hide guide";
    $("guideToggle").setAttribute("aria-expanded", String(!hidden));
  });
  $("aboutButton").addEventListener("click", () =>
    $("aboutDialog").showModal(),
  );

  cartFrom = worldTargetForChapter(state.chapter);
  cartTo = { ...cartFrom };
  cartPosition = { ...cartFrom };
  updateResponsiveView();
  renderMotionControl();
  updateStationAccess();
  render();
  animate();
})();
