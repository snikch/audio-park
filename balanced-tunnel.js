(() => {
  "use strict";

  if (new URLSearchParams(location.search).get("station") !== "balanced") {
    return;
  }

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "audioPark.balancedTunnel.v1";
  const SIGNAL_KEY = "audioPark.signalDispatch.v4";
  const MOTION_KEY = "audioPark.reducedMotion";
  function signalInstructionCurrent() {
    try {
      const signal = JSON.parse(localStorage.getItem(SIGNAL_KEY) || "null");
      return Boolean(
        signal?.completed?.slice(1, 4).every(Boolean) &&
          signal.headroom?.revealed,
      );
    } catch {
      return false;
    }
  }
  if (!signalInstructionCurrent()) {
    location.href = location.pathname;
    return;
  }
  const chapterNames = [
    "Tunnel map",
    "Two voltages",
    "What balanced means",
    "Rejection",
    "Coupling & units",
    "Optional bench extension",
  ];
  const defaults = {
    chapter: 0,
    maxChapter: 0,
    completed: [false, false, false, false, false, false],
    common: { vdiff: 1, vcm: 0.2 },
    rejection: {
      mismatch: 1,
      prediction: "",
      reasoning: "",
      revealed: false,
    },
    units: { vrms: 1, prediction: "", reasoning: "", revealed: false },
    coupling: { capacitance: 1, prediction: "", reasoning: "", revealed: false },
    retrieval: { common: "", balance: "", rejection: "", units: "", coupling: "" },
    lab: {
      djIdentity: "",
      streamerIdentity: "",
      sourceProvenance: "",
      levelEvidence: "",
      cableLength: "",
      sourceReferences: "",
      unknowns: "",
      moduleIdentity: "",
      modulePhoto: "",
      continuityMap: "",
      railEvidence: "",
      poweredState: "blocked",
      blocker: "",
      checks: [false, false, false, false, false, false],
      fixtureReference: "",
      currentLimit: "",
      stimulusFixture: "",
      noShort: "",
      railPlus: "",
      railMinus: "",
      idleCurrent: "",
      temperature: "",
      dcOffset: "",
      gainVin: "",
      gainVout: "",
      polarity: "",
      response20: "",
      response1k: "",
      response20k: "",
      gainCapture: "",
      clippingType: "",
      clippingValue: "",
      clippingCapture: "",
      cmInput: "",
      cmOutput: "",
      cmFrequency: "",
      cmBandwidth: "",
      cmCapture: "",
      noiseComparison: "",
      reflection: "",
      disposition: "",
      acceptReuse: false,
      status: "not-started",
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return clone(defaults);
      return {
        ...clone(defaults),
        ...saved,
        common: { ...defaults.common, ...saved.common },
        rejection: { ...defaults.rejection, ...saved.rejection },
        units: { ...defaults.units, ...saved.units },
        coupling: { ...defaults.coupling, ...saved.coupling },
        retrieval: { ...defaults.retrieval, ...saved.retrieval },
        lab: {
          ...defaults.lab,
          ...saved.lab,
          checks: defaults.lab.checks.map((value, index) =>
            Boolean(saved.lab?.checks?.[index] ?? value),
          ),
        },
        completed: defaults.completed.map((value, index) =>
          Boolean(saved.completed?.[index] ?? value),
        ),
      };
    } catch {
      return clone(defaults);
    }
  }

  function signalFixtureRecorded() {
    try {
      return (
        JSON.parse(localStorage.getItem(SIGNAL_KEY) || "null")?.lab?.status ===
        "evidence-recorded"
      );
    } catch {
      return false;
    }
  }

  function instructionCurrent(candidate) {
    return (
      candidate.completed.slice(1, 4).every(Boolean) &&
      candidate.retrieval.common === "average" &&
      candidate.retrieval.balance === "impedance" &&
      candidate.retrieval.rejection === "system" &&
      candidate.retrieval.units === "normalize" &&
      candidate.retrieval.coupling === "conditional" &&
      candidate.rejection.revealed &&
      candidate.units.revealed &&
      candidate.coupling.revealed
    );
  }

  function unresolvedPoweredEvidence(lab) {
    const unresolvedPattern = /\b(?:tbd|unknown|unresolved|unsupported|unverified|uncertain|ambiguous|assum(?:e|ed|ption)|not\s+(?:yet\s+)?(?:independently\s+)?(?:supported|verified|confirmed|measured|identified|documented|known))\b/i;
    return [
      ["exact module identity", lab.moduleIdentity],
      ["continuity/resistance map", lab.continuityMap],
      ["rail/polarity/range evidence", lab.railEvidence],
      ["powered-readiness note", lab.blocker],
      ["fixture drawing", lab.fixtureReference],
      ["current-limit evidence", lab.currentLimit],
      ["balanced/isolated stimulus fixture", lab.stimulusFixture],
      ["no-short justification", lab.noShort],
    ]
      .filter(([, value]) => !value || unresolvedPattern.test(value))
      .map(([label]) => label);
  }

  function poweredEvidenceCurrent(lab) {
    return (
      lab.poweredState === "ready" &&
      lab.checks.every(Boolean) &&
      unresolvedPoweredEvidence(lab).length === 0
    );
  }

  let state = loadState();
  if (!instructionCurrent(state)) {
    state.completed[4] = false;
    state.maxChapter = Math.min(state.maxChapter, 4);
    state.chapter = Math.min(state.chapter, 4);
    if (state.lab.status === "complete") {
      state.lab.status = "evidence-stale";
      state.completed[5] = false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else if (state.lab.status === "complete" && !signalFixtureRecorded()) {
    state.lab.status = "blocked-station1";
    state.completed[5] = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else if (
    state.lab.status === "complete" &&
    (!instructionCurrent(state) || !poweredEvidenceCurrent(state.lab))
  ) {
    state.lab.status = "not-started";
    state.completed[5] = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  let paused = false;
  const savedMotion = localStorage.getItem(MOTION_KEY);
  let reducedMotion = savedMotion === null
    ? matchMedia("(prefers-reduced-motion: reduce)").matches
    : savedMotion === "true";
  let animationTime = 0;
  let animationSpeed = 1;
  let cartTravel = 1;
  let cartFrom = { x: 520, y: 390 };
  let cartTo = { x: 520, y: 390 };
  let cartPosition = { ...cartFrom };
  let worldScale = 1;

  document.title = "Audio Park — Balanced Tunnel";
  document.body.classList.add("balanced-mode");
  $("stopKicker").textContent = "STOP 2 OF 11";
  $("stationTitle").textContent = "Balanced Tunnel";
  $("stationLead").textContent =
    "Separate impedance balance from signal symmetry, then test what the real receiver actually rejects.";
  $("guide").setAttribute("aria-label", "Balanced Tunnel lesson guide");
  $("lessonNav").setAttribute("aria-label", "Balanced Tunnel lessons");
  $("dispatchRoute").classList.remove("current");
  $("dispatchRoute").classList.add("released");
  $("balancedRoute").classList.add("current");
  $("balancedRoute").classList.remove("released");
  $("routeStatus").textContent = "three stations open";
  if (signalFixtureRecorded()) {
    $("dispatchStation").classList.add("completed-station");
  }
  $("balancedStation").classList.remove("released-station");
  $("balancedStation").classList.add("active-balanced-station");
  $("lessonCount").textContent = `1 / ${chapterNames.length}`;
  document.querySelector(".world-hud span:first-child b").textContent = "2 / 11";

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  function format(value, decimals = 3) {
    return Number(value).toFixed(decimals);
  }

  function setFeedback(element, message, correct) {
    element.textContent = message;
    element.className = `feedback ${correct ? "correct" : "incorrect"}`;
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
    renderGainStationStatus();
  }

  function invalidateInstruction(index) {
    state.completed[index] = false;
    if (state.lab.status === "complete") {
      state.lab.status = "evidence-stale";
      state.completed[5] = false;
    }
    saveState();
    renderFooter();
    renderGainStationStatus();
  }

  function worldTargetForChapter(index) {
    return [
      { x: 520, y: 390 },
      { x: 560, y: 365 },
      { x: 595, y: 345 },
      { x: 635, y: 325 },
      { x: 675, y: 350 },
      { x: 710, y: 385 },
    ][index];
  }

  function setJourneyTarget(target, replayFromPrevious = false) {
    cartFrom = replayFromPrevious
      ? worldTargetForChapter(Math.max(0, state.chapter - 1))
      : { ...cartPosition };
    cartTo = { ...target };
    cartTravel = reducedMotion ? 1 : 0;
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
    $("lessonDots").innerHTML = chapterNames
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
    if (state.chapter === 0) next.textContent = "Enter tunnel →";
    else if (state.chapter === chapterNames.length - 1) {
      next.textContent = state.lab.status === "complete"
        ? "Optional lab badge ✓"
        : "Optional bench extension";
    } else next.textContent = "Continue →";
  }

  function goToChapter(index) {
    if (index < 0 || index >= chapterNames.length || index > state.maxChapter) {
      return;
    }
    state.chapter = index;
    setJourneyTarget(worldTargetForChapter(index));
    saveState();
    render();
    $("guide").scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  const templates = [
    () => `
      <div class="lesson-banner">A balanced line is defined by impedance balance. Equal-and-opposite voltages are one possible drive method, not the definition.</div>
      <h2>Read the tunnel map</h2>
      <p>The DJ path reaches the selector over two signal conductors inside an XLR cable. The receiver cares primarily about their voltage difference. Noise rejection depends on how similarly the two conductors interact with the source, cable, receiver, shield, and environment.</p>
      <div class="interface-map" role="img" aria-label="DJ XLR and streamer RCA interface map">
        <div><b>DJ XLR</b><span>pin 2 · signal conductor +</span><span>pin 3 · signal conductor −</span><span>pin 1 · cable shield</span></div>
        <span class="map-arrow">→</span>
        <div><b>Receiver</b><span>subtracts the two signal inputs</span><span>rejects common mode imperfectly</span></div>
        <div><b>Streamer RCA</b><span>centre · signal</span><span>shell · signal return/shield</span></div>
      </div>
      <div class="terms-card">
        <h3>Keep these objects distinct</h3>
        <dl>
          <dt>Signal reference</dt><dd>The node a voltage is measured against.</dd>
          <dt>Return path</dt><dd>The physical path current takes back to its source.</dd>
          <dt>Shield</dt><dd>A conductor intended to intercept interference; on XLR it is pin 1.</dd>
          <dt>Chassis</dt><dd>The conductive enclosure or structural reference, if one exists.</dd>
          <dt>PSU 0 V</dt><dd>The selected supply reference. It is not automatically pin 1, chassis, or every signal return.</dd>
        </dl>
      </div>
      <div class="safety-box"><b>Project boundary:</b> the existing NE5532 module is uncharacterised. Its label does not prove its schematic, pinout, rails, gain, grounding, or CMRR. No powered connection is authorised by the simulation.</div>
      <div class="completion-card"><h3>Ready to enter?</h3><p>The next stop defines the two voltages the receiver sees before introducing balance or rejection.</p></div>
    `,
    () => {
      const vplus = state.common.vcm + state.common.vdiff / 2;
      const vminus = state.common.vcm - state.common.vdiff / 2;
      return `
        <div class="lesson-banner">Differential voltage is the difference; common-mode voltage is the average.</div>
        <h2>Two conductor voltages</h2>
        <p>Call the receiver inputs V+ and V−. Both are measured against the same stated reference for this model.</p>
        <div class="formula-card"><span class="formula">Vdiff = V+ − V−</span><span class="formula">Vcm = (V+ + V−) / 2</span><span class="formula-note">The + and − labels describe receiver polarity, not a promise that either conductor is positive relative to ground.</span></div>
        <div class="worked-example"><b>Worked snapshot</b><p>At one instant, V+ = +0.500 V and V− = −0.500 V gives Vdiff = 1.000 V and Vcm = 0.000 V. Add +0.200 V to both: V+ = +0.700 V and V− = −0.300 V. Their difference remains 1.000 V; their average becomes +0.200 V.</p><p class="formula-note">These are signed instantaneous values. RMS magnitudes are never negative; steady sine-wave calculations also need phase.</p></div>
        <div class="interactive-card">
          <h3>Observe one variable: shared interference</h3>
          <p>Vdiff stays fixed at 1.000 V in this instantaneous snapshot. Move only the common-mode term.</p>
          <div class="control-row"><label for="commonMode">Common-mode snapshot</label><output id="commonModeValue">${format(state.common.vcm)} V</output><input id="commonMode" type="range" min="-0.5" max="0.5" step="0.05" value="${state.common.vcm}" /></div>
          <div class="rail-meter"><div><small>V+</small><strong id="vPlus">${format(vplus)} V</strong></div><div><small>V−</small><strong id="vMinus">${format(vminus)} V</strong></div><div><small>Vdiff</small><strong id="vDiff">${format(state.common.vdiff)} V</strong></div><div><small>Vcm</small><strong id="vCm">${format(state.common.vcm)} V</strong></div></div>
        </div>
        <table class="anchor-table"><thead><tr><th>Disturbance placement</th><th>Ideal consequence</th></tr></thead><tbody><tr><td>+0.300 V on both XLR signal conductors</td><td>Vcm changes; Vdiff does not</td></tr><tr><td>+0.300 V on V+ only</td><td>Vdiff changes by +0.300 V, so it passes as signal/error</td></tr><tr><td>+0.300 V movement on an RCA return</td><td>The return is the signal reference; the measured RCA signal changes</td></tr></tbody></table>
        <div class="tycoon-tip"><b>Scope:</b> equal-leg rejection is the ideal subtraction model. Real cable coupling and source/receiver imbalance can turn some common mode into differential error.</div>
        <div class="check-card"><h3>Retrieve it</h3><p>If +0.300 V is added equally to both conductor snapshots, what happens in the ideal subtraction model?</p><div class="answer-list"><label><input type="radio" name="commonAnswer" value="difference" ${state.retrieval.common === "difference" ? "checked" : ""} /> Vdiff increases by 0.300 V</label><label><input type="radio" name="commonAnswer" value="average" ${state.retrieval.common === "average" ? "checked" : ""} /> Vdiff stays the same; Vcm increases by 0.300 V</label><label><input type="radio" name="commonAnswer" value="zero" ${state.retrieval.common === "zero" ? "checked" : ""} /> Both Vdiff and Vcm become zero</label></div><button id="checkCommon" class="action-button" type="button">Check answer</button><p id="commonFeedback" class="feedback" aria-live="polite"></p></div>
      `;
    },
    () => `
      <div class="lesson-banner">Balance, differential signalling, and symmetrical drive describe different properties.</div>
      <h2>What “balanced” actually means</h2>
      <p>A line is balanced when the two signal conductors present closely matched impedances to the reference environment. That matching makes external interference tend to couple similarly into both conductors, where a differential receiver can reject it.</p>
      <div class="comparison-grid">
        <article><h3>Impedance balance</h3><p>Do the two conductors see closely matched source and load impedances?</p><b>This defines balance.</b></article>
        <article><h3>Differential signalling</h3><p>Does information live in V+ − V− and does the receiver subtract?</p><b>This defines the signal/receiver relationship.</b></article>
        <article><h3>Symmetrical drive</h3><p>Are the two conductor voltages equal in magnitude and opposite in polarity?</p><b>This is optional.</b></article>
      </div>
      <div class="drive-diagrams">
        <div><b>Symmetrical balanced drive</b><code>V+ = +0.5 V   Z+ = 100 Ω<br>V− = −0.5 V   Z− = 100 Ω</code></div>
        <div><b>Impedance-balanced, asymmetric drive</b><code>V+ = +1.0 V   Z+ = 100 Ω<br>V− =  0.0 V   Z− = 100 Ω</code></div>
      </div>
      <p>Both examples have 1.000 V differential signal and matched 100 Ω source impedances. Only the first has symmetrical conductor voltages.</p>
      <div class="tycoon-tip"><b>Why this matters:</b> measuring only V+ and V− amplitudes does not establish balance. Source impedance on each leg and the complete receiver interface matter.</div>
      <div class="check-card"><h3>Check the definition</h3><p>Which observation directly establishes impedance balance?</p><div class="answer-list"><label><input type="radio" name="balanceAnswer" value="voltage" ${state.retrieval.balance === "voltage" ? "checked" : ""} /> Equal-and-opposite conductor voltages</label><label><input type="radio" name="balanceAnswer" value="connector" ${state.retrieval.balance === "connector" ? "checked" : ""} /> An XLR connector is fitted</label><label><input type="radio" name="balanceAnswer" value="impedance" ${state.retrieval.balance === "impedance" ? "checked" : ""} /> Closely matched conductor impedances under stated conditions</label></div><button id="checkBalance" class="action-button" type="button">Check answer</button><p id="balanceFeedback" class="feedback" aria-live="polite"></p></div>
    `,
    () => {
      const m = state.rejection.mismatch / 100;
      const residual = Math.abs(m * 0.2);
      const cmrr = m > 0 ? -20 * Math.log10(m) : Infinity;
      return `
        <div class="lesson-banner">A receiver rejects shared interference only as well as the complete interface remains matched.</div>
        <h2>Rejection and mismatch</h2>
        <p>An ideal difference receiver has zero common-mode gain. A real receiver has differential gain Ad and common-mode gain Acm.</p>
        <div class="formula-card"><span class="formula">CMRR = 20 log10 |Ad / Acm|</span><span class="formula-note">CMRR depends on frequency, level, common-mode range, source balance, circuit matching, and the measurement fixture.</span></div>
        <div class="worked-example"><b>Worked example</b><p>At unity differential gain, 60 dB CMRR means 1.000 Vrms common mode appears as about 0.001 Vrms of output residue under the stated conditions.</p></div>
        <div class="interactive-card">
          <h3>Predict before the fog clears</h3>
          <p>This simplified teaching model holds Vdiff at 1.000 Vrms and Vcm at 0.200 Vrms. It changes only symmetric receiver gain mismatch. The model keeps wanted gain constant and estimates common-mode residue as <b>mismatch × Vcm</b>.</p>
          <div class="control-row"><label for="mismatchControl">Receiver mismatch</label><output id="mismatchValue">${format(state.rejection.mismatch, 1)}%</output><input id="mismatchControl" type="range" min="0" max="5" step="0.5" value="${state.rejection.mismatch}" /></div>
          <div class="prediction-lock ${state.rejection.revealed ? "revealed" : ""}">${state.rejection.revealed ? `Model residue: ${format(residual * 1000, 1)} mVrms · equivalent CMRR ${Number.isFinite(cmrr) ? `${format(cmrr, 1)} dB` : "ideal/infinite"}` : "The residual stays hidden until you commit a prediction."}</div>
          <div class="answer-list"><label><input type="radio" name="rejectPrediction" value="none" ${state.rejection.prediction === "none" ? "checked" : ""} /> No common-mode residue</label><label><input type="radio" name="rejectPrediction" value="small" ${state.rejection.prediction === "small" ? "checked" : ""} /> A small residue proportional to mismatch</label><label><input type="radio" name="rejectPrediction" value="full" ${state.rejection.prediction === "full" ? "checked" : ""} /> The entire 0.200 Vrms passes through</label></div>
          <label class="standalone-field">Why?<textarea id="rejectReasoning" rows="2" placeholder="Use Vdiff, Vcm, balance, or matching in your reasoning.">${safe(state.rejection.reasoning)}</textarea></label>
          <button id="revealRejection" class="action-button" type="button">Commit prediction and reveal</button>
          <div id="rejectionResult"></div>
        </div>
        <div class="check-card"><h3>Retrieve the cause</h3><p>Why can an XLR-to-NE5532 path reject less interference than the op amp datasheet headline suggests?</p><div class="answer-list"><label><input type="radio" name="rejectionAnswer" value="label" ${state.retrieval.rejection === "label" ? "checked" : ""} /> The XLR shell absorbs a fixed amount</label><label><input type="radio" name="rejectionAnswer" value="system" ${state.retrieval.rejection === "system" ? "checked" : ""} /> Source impedance, cable, receiver network, grounding, frequency, and common-mode range form the real system</label><label><input type="radio" name="rejectionAnswer" value="digital" ${state.retrieval.rejection === "digital" ? "checked" : ""} /> Analog receivers add a network buffer</label></div><button id="checkRejection" class="action-button" type="button">Check answer</button><p id="rejectionFeedback" class="feedback" aria-live="polite"></p></div>
      `;
    },
    renderUnitsCouplingTemplate,
    renderLabTemplate,
  ];

  function renderUnitsCouplingTemplate() {
    const unitVrms = state.units.vrms;
    const dBv = 20 * Math.log10(unitVrms);
    const dBu = 20 * Math.log10(unitVrms / 0.7746);
    const { corner, ratio20, loss20 } = couplingNumbers();
    return `
      <div class="lesson-banner">Normalize source and module specifications to Vrms before using them in a gain or headroom calculation. Isolate DC only when the actual interface needs it.</div>
      <h2>Units first: compare the same voltage</h2>
      <p>A DJ, streamer, preamp, or module document can express the same signal voltage in different dB-referenced units. Convert each stated value to <b>Vrms</b> before comparing sources or calculating gain/headroom. Otherwise the unit reference itself becomes a hidden gain error.</p>
      <div class="terms-card"><h3>Two references, one voltage</h3><dl><dt>dBV</dt><dd>A voltage level referenced to 1.000 Vrms.</dd><dt>dBu</dt><dd>A voltage level referenced to 0.775 Vrms.</dd><dt>Vrms</dt><dd>The shared voltage unit used for the gain table and bench comparison.</dd></dl></div>
      <p>The 0.775 Vrms dBu reference came from the older 0 dBm convention: 1 mW in a 600 Ω load. Modern dBu is a voltage level; quoting it does <b>not</b> require a 600 Ω load.</p>
      <div class="formula-card"><span class="formula">dBV = 20 log10(Vrms / 1.000 V)</span><span class="formula">dBu = 20 log10(Vrms / 0.775 V)</span><span class="formula-note">These are reference conversions, not real-source guarantees.</span></div>
      <div class="worked-example"><b>Worked normalization examples</b><table class="anchor-table"><thead><tr><th>Same voltage expressed three ways</th><th>Vrms</th><th>dBV</th><th>dBu</th></tr></thead><tbody><tr><td>Reference level</td><td>1.000</td><td>0.00</td><td>+2.21</td></tr><tr><td>Nominal convention example</td><td>1.228</td><td>+1.78</td><td>+4.00</td></tr><tr><td>Nominal convention example</td><td>0.316</td><td>−10.00</td><td>−7.78</td></tr></tbody></table><p>+4 dBu and −10 dBV are conventions/examples, not promises about the DJ or streamer. Treating dBu as dBV makes a 2.21 dB error before any gain/headroom work.</p></div>
      <div class="interactive-card"><h3>Observe one variable: the same model voltage</h3><p>Move only the model Vrms value. The two dB readings change because their reference voltages differ.</p><div class="control-row"><label for="unitVrms">Model voltage</label><output id="unitVrmsValue">${format(unitVrms, 3)} Vrms</output><input id="unitVrms" type="range" min="0.1" max="1.5" step="0.01" value="${unitVrms}" /></div><div class="metric-grid"><div class="metric"><small>dBV</small><strong id="dBvValue">${format(dBv, 2)} dBV</strong></div><div class="metric"><small>dBu</small><strong id="dBuValue">${format(dBu, 2)} dBu</strong></div><div class="metric"><small>Reference gap</small><strong>2.21 dB</strong></div></div></div>
      <div class="prediction-lock ${state.units.revealed ? "revealed" : ""}">${state.units.revealed ? `+4 dBu normalizes to 1.228 Vrms, about +1.78 dBV. It is 2.21 dB higher than +4 dBV, not the same voltage.` : "The normalization consequence is sealed until you commit a prediction."}</div><div class="answer-list"><label><input type="radio" name="unitPrediction" value="same" ${state.units.prediction === "same" ? "checked" : ""} /> +4 dBu equals +4 dBV</label><label><input type="radio" name="unitPrediction" value="higher" ${state.units.prediction === "higher" ? "checked" : ""} /> +4 dBu is about +1.78 dBV</label><label><input type="radio" name="unitPrediction" value="lower" ${state.units.prediction === "lower" ? "checked" : ""} /> +4 dBu is about −10 dBV</label></div><label class="standalone-field">Why normalize first?<textarea id="unitReasoning" rows="2" placeholder="Mention the two reference voltages or a gain/headroom comparison.">${safe(state.units.reasoning)}</textarea></label><button id="revealUnits" class="action-button" type="button">Commit unit prediction and reveal</button><p id="unitsPredictionFeedback" class="feedback" aria-live="polite"></p>
      <h2>Coupling next: decide whether DC must stop</h2>
      <p>Every stage establishes an operating point. A source output, selector/preamp stage, or receiver input can carry or require a different DC bias. A <b>series coupling capacitor</b> blocks steady DC while allowing the changing audio voltage through, so one stage's offset or bias does not force the next stage away from its own operating point.</p>
      <p>It is not automatic. If direct coupling is safe and the actual biases are compatible, omitting a capacitor avoids its trade-offs. The decision belongs to the measured topology of each interface, not a generic audio diagram.</p>
      <div class="comparison-grid"><article><h3>Why use one?</h3><p>Keep DC offset or bias from entering a following stage with a different valid operating point.</p></article><article><h3>What it costs</h3><p>Its capacitance and effective resistance make a high-pass response; too small loses bass and changes phase. Charging can create pops. Leakage, polarity, distortion, size, tolerance, and cost can matter.</p></article></div>
      <div class="formula-card"><span class="formula">fc = 1 / (2πReqC)</span><span class="formula-note">Req is the effective resistance seen by the capacitor in the complete source/load network, not automatically one labelled resistor.</span></div>
      <div class="worked-example"><b>Worked coupling decision</b><p>For a 1 µF <em>model</em> capacitor with a 10 kΩ <em>model</em> effective resistance, fc = 1/(2π × 10,000 × 1 µF) = 15.9 Hz. At 20 Hz the model magnitude is about 0.783× (−2.1 dB). That may be a reason to choose a larger capacitor, revise the interface impedance, or retain direct coupling only after the actual bias conditions are proven.</p></div>
      <div class="interactive-card"><h3>Observe one variable: capacitance</h3><p>Req stays fixed at 10 kΩ in this teaching model.</p><div class="control-row"><label for="capControl">Coupling capacitance</label><output id="capValue">${format(state.coupling.capacitance, 1)} µF</output><input id="capControl" type="range" min="0.1" max="4.7" step="0.1" value="${state.coupling.capacitance}" /></div><div class="metric-grid"><div class="metric"><small>Corner frequency</small><strong id="cornerValue">${format(corner, 1)} Hz</strong></div><div class="metric"><small>20 Hz magnitude</small><strong id="magnitude20">${format(ratio20, 3)}×</strong></div><div class="metric"><small>20 Hz change</small><strong id="loss20">${format(loss20, 2)} dB</strong></div></div></div>
      <div class="prediction-lock ${state.coupling.revealed ? "revealed" : ""}">${state.coupling.revealed ? `With Req fixed, increasing C lowers fc and reduces low-frequency attenuation. It does not establish that this interface needs a capacitor.` : "The coupling consequence is sealed until you commit a prediction."}</div><div class="answer-list"><label><input type="radio" name="couplingPrediction" value="lower" ${state.coupling.prediction === "lower" ? "checked" : ""} /> Increasing C lowers fc with the same Req</label><label><input type="radio" name="couplingPrediction" value="higher" ${state.coupling.prediction === "higher" ? "checked" : ""} /> Increasing C raises fc with the same Req</label><label><input type="radio" name="couplingPrediction" value="always" ${state.coupling.prediction === "always" ? "checked" : ""} /> Every audio interface needs a coupling capacitor</label></div><label class="standalone-field">Why?<textarea id="couplingReasoning" rows="2" placeholder="Mention DC bias, the high-pass trade-off, or effective resistance.">${safe(state.coupling.reasoning)}</textarea></label><button id="revealCoupling" class="action-button" type="button">Commit coupling prediction and reveal</button><p id="couplingPredictionFeedback" class="feedback" aria-live="polite"></p>
      <div class="check-card"><h3>Retrieve the two decisions</h3><p>Answer without copying the explanation.</p><div class="answer-list"><p><b>Why convert dBu/dBV to Vrms?</b></p><label><input type="radio" name="unitsAnswer" value="normalize" ${state.retrieval.units === "normalize" ? "checked" : ""} /> To compare differently labelled source/stage values without a reference-unit error before gain/headroom work</label><label><input type="radio" name="unitsAnswer" value="labels" ${state.retrieval.units === "labels" ? "checked" : ""} /> To prove a source's actual nominal output from its connector</label><p><b>When is a coupling capacitor appropriate?</b></p><label><input type="radio" name="couplingAnswer" value="conditional" ${state.retrieval.coupling === "conditional" ? "checked" : ""} /> When the measured interface needs DC/bias isolation; direct coupling is retained only when its biases are compatible and safe</label><label><input type="radio" name="couplingAnswer" value="always" ${state.retrieval.coupling === "always" ? "checked" : ""} /> At every audio interface, regardless of topology</label></div><button id="checkCoupling" class="action-button" type="button">Check retrieval</button><p id="couplingFeedback" class="feedback" aria-live="polite"></p></div>
    `;
  }

  function renderLabTemplate() {
    const lab = state.lab;
    const signalReady = signalFixtureRecorded();
    return `
      <div class="lesson-banner">Optional bench extension: map first, energise second, stimulate third. Unknown hardware remains unpowered.</div>
      <h2>Optional bench extension: receiver characterisation</h2>
      <p>This activity may add a measured-versus-model badge. It never controls lesson or station availability.</p>
      <div class="prerequisite-card ${signalReady ? "ready" : "blocked"}"><b>Signal Dispatch fixture:</b> ${signalReady ? "recorded on this device" : "not recorded on this device"}. ${signalReady ? "Its optional evidence is current for this comparison." : "This optional receiver evidence record retains its source-fixture requirement; course lessons remain available."}</div>
      <div class="safety-box"><b>Hard boundary:</b> no Fosi amplifier, speaker output, 48 V distribution, or speakers. Never defeat protective earth or float a bench scope. Ordinary scope ground clips connect only to one confirmed DUT reference.</div>

      <div class="lab-card"><h3>1. Inventory the two sources</h3><p>Use manuals, model labels, or retained measurements. “Line level” and connector type are not level specifications.</p><div class="evidence-grid"><label>DJ equipment identity<input id="djIdentity" type="text" value="${safe(lab.djIdentity)}" placeholder="Exact model, or TBD" /></label><label>Streamer identity<input id="streamerIdentity" type="text" value="${safe(lab.streamerIdentity)}" placeholder="Exact WiiM model, or TBD" /></label><label class="wide">Provenance<input id="sourceProvenance" type="text" value="${safe(lab.sourceProvenance)}" placeholder="Manual URLs/sections, label photos, or notebook references" /></label><label class="wide">Nominal and maximum level evidence<input id="levelEvidence" type="text" value="${safe(lab.levelEvidence)}" placeholder="Vrms/dBu/dBV with source and condition; retain TBDs" /></label><label>Cable length/route<input id="cableLength" type="text" value="${safe(lab.cableLength)}" placeholder="Approximate length and route" /></label><label>Output references<input id="sourceReferences" type="text" value="${safe(lab.sourceReferences)}" placeholder="XLR/RCA pins and evidence" /></label><label class="wide">Unresolved values<textarea id="unknowns" rows="3" placeholder="Record every unresolved fact as TBD.">${safe(lab.unknowns)}</textarea></label></div></div>

      <div class="lab-card"><h3>2. Map the receiver while unpowered</h3><p>Photograph the exact board. Build a resistance/continuity matrix; do not infer a module pinout from the NE5532 datasheet.</p><pre class="diagram">Measure while unpowered and disconnected

candidate rail pins ↔ selected 0 V
XLR pins 1 / 2 / 3 ↔ board input nodes
output signal / ground ↔ board nodes
pin 1 / shield ↔ signal ground / chassis candidate</pre><div class="evidence-grid"><label>Exact module identity<input id="moduleIdentity" type="text" value="${safe(lab.moduleIdentity)}" placeholder="Board marking, seller record, revision" /></label><label>Photo reference<input id="modulePhoto" type="text" value="${safe(lab.modulePhoto)}" placeholder="Local evidence path or notebook page" /></label><label class="wide">Continuity/resistance matrix reference<textarea id="continuityMap" rows="3" placeholder="Measured pairs and values; distinguish continuity from assumptions.">${safe(lab.continuityMap)}</textarea></label><label class="wide">Rail/polarity/range evidence<textarea id="railEvidence" rows="3" placeholder="Evidence for permitted rails, polarity, 0 V and any remaining ambiguity.">${safe(lab.railEvidence)}</textarea></label></div></div>

      <div class="lab-card"><h3>3. Decide whether powered work is unblocked</h3><p>Source inventory may retain explicit TBDs. Powered readiness may not: the module, rails, fixture, current limit, stimulus, and no-short case must be resolved and mutually consistent.</p><select id="poweredState"><option value="blocked" ${lab.poweredState === "blocked" ? "selected" : ""}>Powered work is blocked</option><option value="ready" ${lab.poweredState === "ready" ? "selected" : ""}>All powered prerequisites are supported</option></select><div class="step-list powered-checks"><label><input class="powered-check" data-index="0" type="checkbox" ${lab.checks[0] ? "checked" : ""} /><span>Exact rail polarity, permitted voltage range, and 0 V are supported.</span></label><label><input class="powered-check" data-index="1" type="checkbox" ${lab.checks[1] ? "checked" : ""} /><span>Split supply capability is verified; both rails will be set and DMM-checked while disconnected.</span></label><label><input class="powered-check" data-index="2" type="checkbox" ${lab.checks[2] ? "checked" : ""} /><span>A justified current limit and its source are recorded.</span></label><label><input class="powered-check" data-index="3" type="checkbox" ${lab.checks[3] ? "checked" : ""} /><span>The scope reference and every proposed probe connection are known and within ratings.</span></label><label><input class="powered-check" data-index="4" type="checkbox" ${lab.checks[4] ? "checked" : ""} /><span>The low-level balanced/isolated stimulus and its reference are verified; no incompatible generator outputs are tied together.</span></label><label><input class="powered-check" data-index="5" type="checkbox" ${lab.checks[5] ? "checked" : ""} /><span>Stop conditions are understood: unexpected current, rail collapse, heat, DC offset, instability, or uncertain reference.</span></label></div><label class="standalone-field">Blocker or readiness note<textarea id="blocker" rows="3" placeholder="If blocked, name the missing evidence. If ready, cite the current-limit and fixture decisions.">${safe(lab.blocker)}</textarea></label></div>

      <div class="lab-card powered-evidence ${lab.poweredState === "ready" ? "" : "is-disabled"}"><h3>4. Record controlled energisation</h3><p>Configure and verify the split supply while disconnected. Power with audio inputs/outputs safely terminated or disconnected. Record conditions before applying a signal.</p><div class="evidence-grid"><label class="wide">Fixture drawing reference<input id="fixtureReference" type="text" value="${safe(lab.fixtureReference)}" /></label><label>Current limit and source<input id="currentLimit" type="text" value="${safe(lab.currentLimit)}" placeholder="Value, rationale, and evidence source" /></label><label>Balanced/isolated stimulus fixture<input id="stimulusFixture" type="text" value="${safe(lab.stimulusFixture)}" placeholder="Source, isolation, series resistors, references" /></label><label class="wide">Why the fixture cannot create a short<textarea id="noShort" rows="3">${safe(lab.noShort)}</textarea></label><label>Positive rail (V)<input id="railPlus" type="number" step="0.001" value="${safe(lab.railPlus)}" /></label><label>Negative rail (V)<input id="railMinus" type="number" step="0.001" value="${safe(lab.railMinus)}" /></label><label>Idle current (mA)<input id="idleCurrent" type="number" min="0" step="0.1" value="${safe(lab.idleCurrent)}" /></label><label>Observed temperature (°C)<input id="temperature" type="number" step="0.1" value="${safe(lab.temperature)}" /></label><label>Output DC offset (mV)<input id="dcOffset" type="number" step="0.1" value="${safe(lab.dcOffset)}" /></label></div></div>

      <div class="lab-card powered-evidence ${lab.poweredState === "ready" ? "" : "is-disabled"}"><h3>5. Record differential and common-mode tests</h3><p>Apply only the verified low-level stimulus through known matched series resistors. Hold measured DUT input constant for the frequency comparison.</p><div class="evidence-grid"><label>1 kHz differential Vin (Vrms)<input id="gainVin" type="number" min="0" step="0.001" value="${safe(lab.gainVin)}" /></label><label>1 kHz output (Vrms)<input id="gainVout" type="number" min="0" step="0.001" value="${safe(lab.gainVout)}" /></label><label>Polarity<select id="polarity"><option value="" ${!lab.polarity ? "selected" : ""}>Select observed result</option><option value="non-inverting" ${lab.polarity === "non-inverting" ? "selected" : ""}>Non-inverting</option><option value="inverting" ${lab.polarity === "inverting" ? "selected" : ""}>Inverting</option></select></label><label>20 Hz output (Vrms)<input id="response20" type="number" min="0" step="0.001" value="${safe(lab.response20)}" /></label><label>1 kHz output (Vrms)<input id="response1k" type="number" min="0" step="0.001" value="${safe(lab.response1k)}" /></label><label>20 kHz output (Vrms)<input id="response20k" type="number" min="0" step="0.001" value="${safe(lab.response20k)}" /></label><label class="wide">Gain/polarity/frequency capture reference<input id="gainCapture" type="text" value="${safe(lab.gainCapture)}" /></label><label>Clipping result<select id="clippingType"><option value="" ${!lab.clippingType ? "selected" : ""}>Select safe result</option><option value="onset" ${lab.clippingType === "onset" ? "selected" : ""}>Onset observed within limits</option><option value="lower-bound" ${lab.clippingType === "lower-bound" ? "selected" : ""}>Safe lower bound only</option></select></label><label>Clipping input/lower bound (Vrms)<input id="clippingValue" type="number" min="0" step="0.001" value="${safe(lab.clippingValue)}" /></label><label class="wide">Clipping capture/reference<input id="clippingCapture" type="text" value="${safe(lab.clippingCapture)}" /></label><label>Common-mode input (Vrms)<input id="cmInput" type="number" min="0" step="0.001" value="${safe(lab.cmInput)}" /></label><label>Output residue (Vrms)<input id="cmOutput" type="number" min="0" step="0.0001" value="${safe(lab.cmOutput)}" /></label><label>CM frequency (Hz)<input id="cmFrequency" type="number" min="1" step="1" value="${safe(lab.cmFrequency)}" /></label><label>Scope bandwidth/settings<input id="cmBandwidth" type="text" value="${safe(lab.cmBandwidth)}" /></label><label class="wide">Common-mode capture/reference<input id="cmCapture" type="text" value="${safe(lab.cmCapture)}" /></label><label class="wide">Termination / cable / source hum-noise comparison<textarea id="noiseComparison" rows="3">${safe(lab.noiseComparison)}</textarea></label></div><div id="measuredCmrr" class="formula-card"></div></div>

      <div class="lab-card"><h3>6. Compare, decide, and save</h3><div class="evidence-grid"><label class="wide">Prediction versus observation reflection<textarea id="reflection" rows="3">${safe(lab.reflection)}</textarea></label><label>Disposition<select id="disposition"><option value="" ${!lab.disposition ? "selected" : ""}>Choose from evidence</option><option value="reuse" ${lab.disposition === "reuse" ? "selected" : ""}>Reuse provisionally</option><option value="investigate" ${lab.disposition === "investigate" ? "selected" : ""}>Investigate / retest</option><option value="replace" ${lab.disposition === "replace" ? "selected" : ""}>Replace</option></select></label><label class="wide acceptance-check"><input id="acceptReuse" type="checkbox" ${lab.acceptReuse ? "checked" : ""} /><span>I accept provisional reuse from the recorded evidence. I understand this is not a final PCB capture or a claim that a buffer repairs common-mode rejection.</span></label></div><button id="saveReceiverLab" class="action-button" type="button">Validate and save current evidence</button><p id="receiverFeedback" class="feedback" aria-live="polite"></p><div id="receiverCompletion"></div></div>
    `;
  }

  const bindings = [
    bindOrientation,
    bindCommon,
    bindBalance,
    bindRejection,
    bindCoupling,
    bindLab,
  ];

  function render() {
    renderNav();
    renderFooter();
    $("lessonContent").innerHTML = templates[state.chapter]();
    bindings[state.chapter]();
    updateWorld(true);
  }

  function bindOrientation() {
    $("cartCargo").textContent = "interface map";
    $("worldNarration").textContent =
      "Twin signal rails enter the tunnel. Pin 1 is the shield; it is not one of the two signal conductors.";
  }

  function bindCommon() {
    const control = $("commonMode");
    const update = () => {
      state.common.vcm = Number(control.value);
      const vplus = state.common.vcm + state.common.vdiff / 2;
      const vminus = state.common.vcm - state.common.vdiff / 2;
      $("commonModeValue").textContent = `${format(state.common.vcm)} V`;
      $("vPlus").textContent = `${format(vplus)} V`;
      $("vMinus").textContent = `${format(vminus)} V`;
      $("vDiff").textContent = `${format(vplus - vminus)} V`;
      $("vCm").textContent = `${format((vplus + vminus) / 2)} V`;
      $("cartCargo").textContent =
        `${format(state.common.vdiff)} Vdiff · ${format(state.common.vcm)} Vcm snapshot`;
      saveState();
      updateWorld();
    };
    control.addEventListener("input", update);
    document.querySelectorAll('input[name="commonAnswer"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.retrieval.common = input.value;
        invalidateInstruction(1);
      }),
    );
    $("checkCommon").addEventListener("click", () => {
      const answer = document.querySelector('input[name="commonAnswer"]:checked');
      if (!answer) {
        return setFeedback($("commonFeedback"), "Choose an answer first.", false);
      }
      const correct = answer.value === "average";
      setFeedback(
        $("commonFeedback"),
        correct
          ? "Correct. Adding the same voltage to both inputs changes their average, not their difference."
          : "Calculate the new difference and average separately.",
        correct,
      );
      if (correct) completeChapter(1);
    });
    update();
    $("worldNarration").textContent =
      "Shared fog moves both rail snapshots together. Their ideal instantaneous difference remains 1.000 V.";
  }

  function bindBalance() {
    document.querySelectorAll('input[name="balanceAnswer"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.retrieval.balance = input.value;
        invalidateInstruction(2);
      }),
    );
    $("checkBalance").addEventListener("click", () => {
      const answer = document.querySelector('input[name="balanceAnswer"]:checked');
      if (!answer) {
        return setFeedback($("balanceFeedback"), "Choose an observation first.", false);
      }
      const correct = answer.value === "impedance";
      setFeedback(
        $("balanceFeedback"),
        correct
          ? "Correct. Closely matched conductor impedances establish balance; connector and voltage symmetry do not."
          : "Balance describes the two conductor impedances, not the connector or voltage symmetry.",
        correct,
      );
      if (correct) completeChapter(2);
    });
    $("cartCargo").textContent = "matched impedances";
    $("worldNarration").textContent =
      "The two rails stay equally exposed to the fog when their impedances are matched—even if only one rail is actively driven.";
  }

  function rejectionNumbers() {
    const mismatch = state.rejection.mismatch / 100;
    return {
      mismatch,
      residual: Math.abs(mismatch * 0.2),
      cmrr: mismatch > 0 ? -20 * Math.log10(mismatch) : Infinity,
    };
  }

  function renderRejectionResult() {
    const target = $("rejectionResult");
    if (!target || !state.rejection.revealed) return;
    const { residual, cmrr } = rejectionNumbers();
    const predicted = state.rejection.prediction;
    const correct =
      (state.rejection.mismatch === 0 && predicted === "none") ||
      (state.rejection.mismatch > 0 && predicted === "small");
    target.innerHTML = `<div class="formula-card"><span class="formula">residue = ${format(state.rejection.mismatch, 1)}% × 0.200 Vrms</span><span class="formula">= ${format(residual * 1000, 1)} mVrms</span><span class="formula">equivalent CMRR = ${Number.isFinite(cmrr) ? `${format(cmrr, 1)} dB` : "ideal / infinite"}</span></div><p class="feedback ${correct ? "correct" : "incorrect"}">${correct ? "Prediction matched the teaching model." : "Prediction did not match this teaching model."} This is a deliberately symmetric mismatch model, not a measurement of the NE5532 module.</p>`;
  }

  function bindRejection() {
    const mismatch = $("mismatchControl");
    mismatch.addEventListener("change", () => {
      state.rejection.mismatch = Number(mismatch.value);
      state.rejection.prediction = "";
      state.rejection.reasoning = "";
      state.rejection.revealed = false;
      invalidateInstruction(3);
      render();
    });
    document
      .querySelectorAll('input[name="rejectPrediction"]')
      .forEach((input) =>
        input.addEventListener("change", () => {
          state.rejection.prediction = input.value;
          state.rejection.revealed = false;
          invalidateInstruction(3);
        }),
      );
    $("rejectReasoning").addEventListener("input", (event) => {
      state.rejection.reasoning = event.target.value;
      state.rejection.revealed = false;
      invalidateInstruction(3);
    });
    $("revealRejection").addEventListener("click", () => {
      const selected = document.querySelector(
        'input[name="rejectPrediction"]:checked',
      );
      const reasoning = $("rejectReasoning").value.trim();
      if (!selected || reasoning.length < 12) {
        $("rejectionResult").innerHTML =
          '<p class="feedback incorrect">Choose a prediction and record a short causal reason before revealing.</p>';
        return;
      }
      state.rejection.prediction = selected.value;
      state.rejection.reasoning = reasoning;
      state.rejection.revealed = true;
      saveState();
      render();
    });
    $("checkRejection").addEventListener("click", () => {
      const answer = document.querySelector(
        'input[name="rejectionAnswer"]:checked',
      );
      if (!answer) {
        return setFeedback(
          $("rejectionFeedback"),
          "Choose an explanation first.",
          false,
        );
      }
      if (!state.rejection.revealed) {
        return setFeedback(
          $("rejectionFeedback"),
          "Commit and reveal the model prediction first.",
          false,
        );
      }
      const correct = answer.value === "system";
      setFeedback(
        $("rejectionFeedback"),
        correct
          ? "Correct. Practical rejection belongs to the complete interface and its test conditions."
          : "The module is a complete source–cable–receiver–grounding system, not an IC label.",
        correct,
      );
      if (correct) completeChapter(3);
    });
    document
      .querySelectorAll('input[name="rejectionAnswer"]')
      .forEach((input) =>
        input.addEventListener("change", () => {
          state.retrieval.rejection = input.value;
          invalidateInstruction(3);
        }),
      );
    renderRejectionResult();
    const { residual } = rejectionNumbers();
    $("cartCargo").textContent = state.rejection.revealed
      ? `${format(residual * 1000, 1)} mVrms residue (model)`
      : "prediction sealed";
    $("worldNarration").textContent = state.rejection.revealed
      ? "The mismatched subtraction gate leaves a visible ripple. Its size is a teaching-model result."
      : "Pause at the tunnel gate, predict the residue, then reveal what the simplified mismatch model does.";
  }

  function couplingNumbers() {
    const c = state.coupling.capacitance * 1e-6;
    const corner = 1 / (2 * Math.PI * 10000 * c);
    const ratio20 = 20 / Math.sqrt(20 ** 2 + corner ** 2);
    return { corner, ratio20, loss20: 20 * Math.log10(ratio20) };
  }

  function bindCoupling() {
    const unitControl = $("unitVrms");
    const capControl = $("capControl");
    const invalidateStop = () => {
      state.completed[4] = false;
      if (state.lab.status === "complete") {
        state.lab.status = "not-started";
        state.completed[5] = false;
      }
      saveState();
      renderFooter();
      renderGainStationStatus();
    };
    const updateUnits = () => {
      state.units.vrms = Number(unitControl.value);
      const dBv = 20 * Math.log10(state.units.vrms);
      const dBu = 20 * Math.log10(state.units.vrms / 0.7746);
      $("unitVrmsValue").textContent = `${format(state.units.vrms, 3)} Vrms`;
      $("dBvValue").textContent = `${format(dBv, 2)} dBV`;
      $("dBuValue").textContent = `${format(dBu, 2)} dBu`;
      $("cartCargo").textContent = `${format(state.units.vrms, 3)} Vrms model level`;
      saveState();
      updateWorld();
    };
    const updateCap = () => {
      const { corner, ratio20, loss20 } = couplingNumbers();
      $("capValue").textContent = `${format(state.coupling.capacitance, 1)} µF`;
      $("cornerValue").textContent = `${format(corner, 1)} Hz`;
      $("magnitude20").textContent = `${format(ratio20, 3)}×`;
      $("loss20").textContent = `${format(loss20, 2)} dB`;
      saveState();
      updateWorld();
    };
    unitControl.addEventListener("input", () => {
      state.units.vrms = Number(unitControl.value);
      state.units.prediction = "";
      state.units.reasoning = "";
      state.units.revealed = false;
      state.retrieval.units = "";
      invalidateStop();
      render();
    });
    capControl.addEventListener("input", () => {
      state.coupling.capacitance = Number(capControl.value);
      state.coupling.prediction = "";
      state.coupling.reasoning = "";
      state.coupling.revealed = false;
      state.retrieval.coupling = "";
      invalidateStop();
      render();
    });
    document.querySelectorAll('input[name="unitPrediction"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.units.prediction = input.value;
        state.units.revealed = false;
        invalidateStop();
      }),
    );
    $("unitReasoning").addEventListener("input", (event) => {
      state.units.reasoning = event.target.value;
      state.units.revealed = false;
      invalidateStop();
    });
    $("revealUnits").addEventListener("click", () => {
      if (!state.units.prediction || state.units.reasoning.trim().length < 12) {
        return setFeedback($("unitsPredictionFeedback"), "Choose a conversion and record a short reason before revealing.", false);
      }
      state.units.revealed = true;
      saveState();
      setFeedback(
        $("unitsPredictionFeedback"),
        state.units.prediction === "higher"
          ? "Prediction recorded. Normalize values to Vrms before comparing gain/headroom."
          : "Prediction recorded. Compare both reference voltages in the revealed result.",
        state.units.prediction === "higher",
      );
      render();
    });
    document.querySelectorAll('input[name="couplingPrediction"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.coupling.prediction = input.value;
        state.coupling.revealed = false;
        invalidateStop();
      }),
    );
    $("couplingReasoning").addEventListener("input", (event) => {
      state.coupling.reasoning = event.target.value;
      state.coupling.revealed = false;
      invalidateStop();
    });
    $("revealCoupling").addEventListener("click", () => {
      if (!state.coupling.prediction || state.coupling.reasoning.trim().length < 12) {
        return setFeedback($("couplingPredictionFeedback"), "Choose a coupling outcome and record a short reason before revealing.", false);
      }
      state.coupling.revealed = true;
      saveState();
      setFeedback(
        $("couplingPredictionFeedback"),
        state.coupling.prediction === "lower"
          ? "Prediction recorded. The high-pass model changes; the real topology decides whether coupling is needed."
          : "Prediction recorded. Use the revealed high-pass relationship and the actual DC-bias decision.",
        state.coupling.prediction === "lower",
      );
      render();
    });
    document.querySelectorAll('input[name="unitsAnswer"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.retrieval.units = input.value;
        invalidateStop();
      }),
    );
    document.querySelectorAll('input[name="couplingAnswer"]').forEach((input) =>
      input.addEventListener("change", () => {
        state.retrieval.coupling = input.value;
        invalidateStop();
      }),
    );
    $("checkCoupling").addEventListener("click", () => {
      if (!state.units.revealed || !state.coupling.revealed) {
        return setFeedback($("couplingFeedback"), "Commit and reveal both predictions before retrieval.", false);
      }
      const correct =
        state.retrieval.units === "normalize" &&
        state.retrieval.coupling === "conditional";
      setFeedback(
        $("couplingFeedback"),
        correct
          ? "Correct. Normalize first; add coupling only when the measured interface needs DC/bias isolation."
          : "Recheck the reference-unit mismatch and the actual-bias decision.",
        correct,
      );
      if (correct) completeChapter(4);
    });
    updateUnits();
    updateCap();
    $("worldNarration").textContent =
      "The cart compares voltage references, then pauses at a DC-bias gate. The high-pass model is not a hardware decision.";
  }

  function collectLab() {
    const lab = state.lab;
    const textIds = [
      "djIdentity",
      "streamerIdentity",
      "sourceProvenance",
      "levelEvidence",
      "cableLength",
      "sourceReferences",
      "unknowns",
      "moduleIdentity",
      "modulePhoto",
      "continuityMap",
      "railEvidence",
      "blocker",
      "fixtureReference",
      "currentLimit",
      "stimulusFixture",
      "noShort",
      "railPlus",
      "railMinus",
      "idleCurrent",
      "temperature",
      "dcOffset",
      "gainVin",
      "gainVout",
      "polarity",
      "response20",
      "response1k",
      "response20k",
      "gainCapture",
      "clippingType",
      "clippingValue",
      "clippingCapture",
      "cmInput",
      "cmOutput",
      "cmFrequency",
      "cmBandwidth",
      "cmCapture",
      "noiseComparison",
      "reflection",
      "disposition",
    ];
    textIds.forEach((id) => {
      lab[id] = $(id)?.value.trim() ?? lab[id];
    });
    lab.poweredState = $("poweredState").value;
    lab.acceptReuse = $("acceptReuse").checked;
  }

  function inventoryComplete(lab) {
    return [
      lab.djIdentity,
      lab.streamerIdentity,
      lab.sourceProvenance,
      lab.levelEvidence,
      lab.cableLength,
      lab.sourceReferences,
      lab.unknowns,
      lab.moduleIdentity,
      lab.modulePhoto,
      lab.continuityMap,
      lab.railEvidence,
    ].every((value) => value.trim().length > 0);
  }

  function measuredCmrr(lab) {
    const gainVin = Number(lab.gainVin);
    const gainVout = Number(lab.gainVout);
    const cmInput = Number(lab.cmInput);
    const cmOutput = Number(lab.cmOutput);
    if (!(gainVin > 0 && gainVout > 0 && cmInput > 0 && cmOutput > 0)) {
      return null;
    }
    const ad = gainVout / gainVin;
    const acm = cmOutput / cmInput;
    return 20 * Math.log10(Math.abs(ad / acm));
  }

  function renderMeasuredCmrr() {
    const target = $("measuredCmrr");
    if (!target) return;
    collectLab();
    const value = measuredCmrr(state.lab);
    target.innerHTML = value === null
      ? '<span class="formula-note">Enter differential Vin/Vout and non-zero common-mode input/output to calculate the fixture-specific CMRR estimate.</span>'
      : `<span class="formula">Ad = ${format(Number(state.lab.gainVout) / Number(state.lab.gainVin), 3)}×</span><span class="formula">Acm = ${format(Number(state.lab.cmOutput) / Number(state.lab.cmInput), 6)}×</span><span class="formula">CMRR = ${format(value, 1)} dB under the recorded conditions</span>`;
  }

  function invalidateLab() {
    collectLab();
    state.lab.status = "not-started";
    state.completed[5] = false;
    saveState();
    renderFooter();
    renderReceiverCompletion();
  }

  function renderReceiverCompletion() {
    renderGainStationStatus();
    const target = $("receiverCompletion");
    if (!target) return;
    const messages = {
      "blocked-powered":
        '<div class="blocked-box"><b>Optional lab safely blocked:</b> source and power-off mapping are retained. Powered work remains physically blocked until every named prerequisite is supported; course lessons remain available.</div>',
      "blocked-station1":
        '<div class="blocked-box"><b>Optional receiver evidence retained:</b> Signal Dispatch fixture evidence is missing on this device, so this optional record cannot be accepted.</div>',
      "needs-investigation":
        '<div class="blocked-box"><b>Evidence retained for investigation:</b> the selected disposition does not support provisional reuse. Course lessons remain available.</div>',
      "evidence-stale":
        '<div class="blocked-box"><b>Optional evidence needs refresh:</b> the instructional model changed, so this retained record cannot carry a current badge until the revised instructional sequence is completed.</div>',
      complete:
        '<div class="completion-card"><h3>Optional Balanced Tunnel bench badge recorded</h3><p>The source map, receiver fixture, differential/common-mode comparison, and provisional reuse decision are current for this retained comparison.</p></div>',
    };
    target.innerHTML =
      messages[state.lab.status] ||
      '<div class="blocked-box"><b>Gate open for preparation:</b> inventory and power-off mapping are useful evidence even if powered work remains blocked.</div>';
  }

  function renderGainStationStatus() {
    const station = $("gainStation");
    const route = $("gainRoute");
    const ready = instructionCurrent(state);
    station.classList.toggle("ready-station", ready);
    station.classList.toggle("released-station", ready);
    station.classList.toggle("locked-station", !ready);
    station.setAttribute(
      "aria-label",
      ready ? "Open Gain Lift" : "Gain Lift needs the Balanced Tunnel instructional sequence",
    );
    route.classList.toggle("locked", !ready);
    route.classList.toggle("released", ready);
    route.disabled = !ready;
    route.textContent = "3 Gain Lift";
    route.setAttribute(
      "aria-label",
      ready ? "Open Gain Lift" : "Gain Lift needs the Balanced Tunnel instructional sequence",
    );
    $("routeStatus").textContent = ready ? "three stations open" : "two stations open";
  }

  function bindLab() {
    document.querySelectorAll(".powered-check").forEach((check) =>
      check.addEventListener("change", () => {
        state.lab.checks[Number(check.dataset.index)] = check.checked;
        invalidateLab();
      }),
    );
    $("poweredState").addEventListener("change", () => {
      collectLab();
      invalidateLab();
      render();
    });
    document
      .querySelectorAll(
        ".lab-card input:not(.powered-check), .lab-card textarea, .lab-card select:not(#poweredState)",
      )
      .forEach((field) =>
        field.addEventListener("input", () => {
          invalidateLab();
          if (["gainVin", "gainVout", "cmInput", "cmOutput"].includes(field.id)) {
            renderMeasuredCmrr();
          }
        }),
      );
    $("saveReceiverLab").addEventListener("click", () => {
      collectLab();
      const lab = state.lab;
      const feedback = $("receiverFeedback");
      if (!inventoryComplete(lab)) {
        return setFeedback(
          feedback,
          "Complete the source inventory, retained unknowns, exact module identity, photo, continuity map, and rail evidence before saving a gate state.",
          false,
        );
      }
      if (lab.poweredState === "blocked") {
        if (lab.blocker.length < 12) {
          return setFeedback(
            feedback,
            "Name the evidence that blocks powered work. Do not invent measurements.",
            false,
          );
        }
        lab.status = "blocked-powered";
        saveState();
        setFeedback(
          feedback,
          "Safe blocked state saved. The module remains unpowered.",
          true,
        );
        renderReceiverCompletion();
        return;
      }
      if (!lab.checks.every(Boolean)) {
        return setFeedback(
          feedback,
          "Every powered-readiness check must be supported before powered evidence can be accepted.",
          false,
        );
      }
      const unresolved = unresolvedPoweredEvidence(lab);
      if (unresolved.length > 0) {
        return setFeedback(
          feedback,
          `Powered evidence remains unresolved or contradicts readiness: ${unresolved.join(", ")}. Select blocked or replace those entries with supported evidence before energising or completing the gate.`,
          false,
        );
      }
      const requiredText = [
        lab.blocker,
        lab.fixtureReference,
        lab.currentLimit,
        lab.stimulusFixture,
        lab.noShort,
        lab.polarity,
        lab.gainCapture,
        lab.clippingType,
        lab.clippingCapture,
        lab.cmBandwidth,
        lab.cmCapture,
        lab.noiseComparison,
        lab.reflection,
        lab.disposition,
      ];
      if (requiredText.some((value) => !value || value.trim().length < 3)) {
        return setFeedback(
          feedback,
          "Record the fixture/no-short case, captures, settings, clipping result, comparison, reflection, and disposition.",
          false,
        );
      }
      const numericIds = [
        "railPlus",
        "railMinus",
        "idleCurrent",
        "temperature",
        "dcOffset",
        "gainVin",
        "gainVout",
        "response20",
        "response1k",
        "response20k",
        "clippingValue",
        "cmInput",
        "cmOutput",
        "cmFrequency",
      ];
      if (numericIds.some((id) => lab[id] === "" || !Number.isFinite(Number(lab[id])))) {
        return setFeedback(
          feedback,
          "Complete every numerical observation; zero is valid only where it was actually observed.",
          false,
        );
      }
      if (
        !(Number(lab.railPlus) > 0 && Number(lab.railMinus) < 0) ||
        !(Number(lab.idleCurrent) >= 0) ||
        !(Number(lab.gainVin) > 0 && Number(lab.gainVout) >= 0) ||
        !(Number(lab.cmInput) > 0 && Number(lab.cmOutput) >= 0) ||
        !(Number(lab.cmFrequency) > 0)
      ) {
        return setFeedback(
          feedback,
          "The signed rails or positive stimulus observations are internally inconsistent. Recheck units and transcription.",
          false,
        );
      }
      if (!instructionCurrent(state)) {
        return setFeedback(
          feedback,
          "Re-complete the current differential/common-mode, balance, mismatch-prediction, and coupling retrieval gates before receiver evidence can complete the station.",
          false,
        );
      }
      if (!signalFixtureRecorded()) {
        lab.status = "blocked-station1";
        saveState();
        setFeedback(
          feedback,
          "Receiver evidence saved, but the Signal Dispatch fixture gate is not recorded on this device.",
          false,
        );
        renderReceiverCompletion();
        return;
      }
      if (
        lab.disposition === "reuse" &&
        (
          measuredCmrr(lab) === null ||
          Number(lab.gainVout) <= 0 ||
          Number(lab.response20) <= 0 ||
          Number(lab.response1k) <= 0 ||
          Number(lab.response20k) <= 0 ||
          Number(lab.clippingValue) <= 0
        )
      ) {
        return setFeedback(
          feedback,
          "Provisional reuse needs positive gain/frequency/clipping evidence and a calculable differential-versus-common-mode result. Record an instrument-floor bound instead of a zero residue.",
          false,
        );
      }
      if (lab.disposition !== "reuse" || !lab.acceptReuse) {
        lab.status = "needs-investigation";
        saveState();
        setFeedback(
          feedback,
          "Evidence saved. Investigate/retest and replace are valid engineering outcomes; course lessons remain available.",
          false,
        );
        renderReceiverCompletion();
        return;
      }
      lab.status = "complete";
      completeChapter(5);
      saveState();
      setFeedback(
        feedback,
        "Current evidence accepted for provisional receiver reuse. Editing any gated input invalidates completion.",
        true,
      );
      renderReceiverCompletion();
    });
    renderMeasuredCmrr();
    renderReceiverCompletion();
    $("cartCargo").textContent = "receiver evidence";
    $("worldNarration").textContent =
      "The cart waits outside the powered test bay. Unknown rails or references keep the gate physically closed.";
  }

  function updateWorld(force = false) {
    const cart = $("signalCart");
    const eased = 1 - (1 - cartTravel) ** 3;
    cartPosition = {
      x: cartFrom.x + (cartTo.x - cartFrom.x) * eased,
      y: cartFrom.y + (cartTo.y - cartFrom.y) * eased,
    };
    cart.setAttribute(
      "transform",
      `translate(${cartPosition.x.toFixed(1)} ${cartPosition.y.toFixed(1)})`,
    );
    const fogAmount =
      state.chapter === 1
        ? Math.min(1, Math.abs(state.common.vcm) / 0.5)
        : state.chapter === 3
          ? 0.65
          : 0.25;
    const fogA = document.querySelector(".fog-a");
    const fogB = document.querySelector(".fog-b");
    const drift = Math.sin(animationTime) * 7;
    fogA?.setAttribute("transform", `translate(${drift.toFixed(1)} 0)`);
    fogB?.setAttribute("transform", `translate(${(-drift * 0.6).toFixed(1)} 0)`);
    $("balancedRide").style.setProperty("--fog-opacity", String(fogAmount));
    let residue = 0;
    if (state.chapter === 3 && state.rejection.revealed) {
      residue = Math.min(12, rejectionNumbers().residual * 1000 * 1.2);
    }
    let path = "M102 107";
    for (let x = 0; x <= 36; x += 3) {
      const y = 107 + Math.sin((x / 36) * Math.PI * 4 + animationTime) * residue;
      path += ` L${102 + x} ${y.toFixed(1)}`;
    }
    $("tunnelResidue").setAttribute("d", path);
    $("tunnelResidue").style.opacity = residue > 0 ? "1" : "0";
    const wave = $("cartWave");
    let amplitude = 8;
    if (state.chapter === 4) amplitude *= couplingNumbers().ratio20;
    let wavePath = "";
    for (let x = -23; x <= 23; x += 2) {
      const y = -7 - Math.sin(((x + 23) / 46) * Math.PI * 4 + animationTime) * amplitude;
      wavePath += `${x === -23 ? "M" : "L"}${x},${y.toFixed(1)} `;
    }
    wave.setAttribute("d", wavePath);
    updateCamera();
    if (force && !reducedMotion) cart.getBoundingClientRect();
  }

  function animate() {
    if (!paused && !reducedMotion) {
      animationTime += 0.035 * animationSpeed;
      cartTravel = Math.min(1, cartTravel + 0.012 * animationSpeed);
    }
    updateWorld();
    requestAnimationFrame(animate);
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
      mobile ? "275 190 660 420" : "0 0 1200 760",
    );
    if (mobile && worldScale !== 1) {
      worldScale = 1;
      updateCamera();
    }
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
  const openDispatch = () => {
    location.href = location.pathname;
  };
  $("dispatchRoute").addEventListener("click", openDispatch);
  $("dispatchStation").addEventListener("click", openDispatch);
  $("dispatchStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDispatch();
    }
  });
  $("balancedRoute").addEventListener("click", () =>
    goToChapter(Math.min(state.maxChapter, 1)),
  );
  $("balancedStation").addEventListener("click", () =>
    goToChapter(Math.min(state.maxChapter, 1)),
  );
  const openGain = () => {
    if (!instructionCurrent(state)) {
      $("worldNarration").textContent =
        "Gain Lift needs the Balanced Tunnel simulation, committed predictions, and retrieval sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=gain";
  };
  $("gainRoute").addEventListener("click", openGain);
  $("gainStation").addEventListener("click", openGain);
  $("gainStation").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGain();
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
    const { residual } = rejectionNumbers();
    const { corner, ratio20 } = couplingNumbers();
    const summaries = [
      "Interfaces: XLR pins 2/3 are the signal pair; pin 1 is the shield. RCA has one signal and one shared return/shield.",
      `Snapshot model: ${format(state.common.vdiff)} Vdiff and ${format(state.common.vcm)} Vcm. V+ and V− share one stated reference.`,
      "Balance: matched conductor impedances. Differential signalling and symmetrical drive are separate properties.",
      state.rejection.revealed
        ? `Mismatch model: ${format(state.rejection.mismatch, 1)}% leaves ${format(residual * 1000, 1)} mVrms residue from 0.200 Vrms common mode.`
        : "Mismatch outcome is sealed until a prediction and causal reason are committed.",
      `Coupling model: 10 kΩ with ${format(state.coupling.capacitance, 1)} µF gives fc ${format(corner, 1)} Hz and ${format(ratio20, 3)}× at 20 Hz.`,
      `Receiver lab: ${state.lab.status}. Powered work is ${state.lab.poweredState}; Signal Dispatch fixture is ${signalFixtureRecorded() ? "recorded" : "missing"}.`,
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
  $("zoomIn").addEventListener("click", () => {
    worldScale = Math.min(1.5, worldScale + 0.1);
    updateCamera();
  });
  $("zoomOut").addEventListener("click", () => {
    worldScale = Math.max(0.75, worldScale - 0.1);
    updateCamera();
  });
  $("fitWorld").addEventListener("click", () => {
    worldScale = 1;
    updateCamera();
  });
  $("guideToggle").addEventListener("click", () => {
    const hidden = document.body.classList.toggle("guide-hidden");
    $("guideToggle").textContent = hidden ? "Show guide" : "Hide guide";
    $("guideToggle").setAttribute("aria-expanded", String(!hidden));
  });
  $("aboutButton").addEventListener("click", () => $("aboutDialog").showModal());
  document.querySelectorAll("[data-lock]").forEach((station) => {
    const inspect = () => {
      $("worldNarration").textContent = station.dataset.lock;
      station.focus();
    };
    station.addEventListener("click", inspect);
    station.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspect();
      }
    });
  });
  addEventListener("resize", updateResponsiveView);

  cartFrom = worldTargetForChapter(state.chapter);
  cartTo = { ...cartFrom };
  cartPosition = { ...cartFrom };
  updateResponsiveView();
  renderMotionControl();
  renderGainStationStatus();
  render();
  animate();
})();
