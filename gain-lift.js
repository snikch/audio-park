(() => {
  "use strict";

  if (new URLSearchParams(location.search).get("station") !== "gain") return;

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "audioPark.gainLift.v1";
  const SIGNAL_KEY = "audioPark.signalDispatch.v4";
  const BALANCED_KEY = "audioPark.balancedTunnel.v1";
  const MOTION_KEY = "audioPark.reducedMotion";
  function balancedInstructionCurrent() {
    const candidate = readStorage(BALANCED_KEY);
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
  const chapterNames = [
    "Lift map",
    "Gain & headroom",
    "dB chain",
    "Loading",
    "Noise allocation",
    "Optional bench extension",
  ];
  const defaults = {
    chapter: 0,
    maxChapter: 0,
    completed: [false, false, false, false, false, false],
    model: {
      source: 0.5,
      receiverDb: 0,
      selectorDb: -6,
      amplifierDb: 6,
      limit: 1,
      sourceZ: 1000,
      inputZ: 10000,
      zones: 2,
      capacitor: 1,
    },
    prediction: { answer: "", reasoning: "", revealed: false },
    retrieval: { gain: "", loading: "", noise: "" },
    lab: {
      sourceEvidence: "",
      receiverEvidence: "",
      sourceMax: "",
      sourceClass: "",
      receiverGain: "",
      receiverClass: "",
      selectorGain: "",
      selectorClass: "",
      amplifierReference: "",
      amplifierClass: "",
      sourceZ: "",
      sourceZClass: "",
      loadOne: "",
      loadTwo: "",
      vin: "",
      vout: "",
      frequency: "",
      capture: "",
      noiseConditions: "",
      noiseResult: "",
      reflection: "",
      decision: "",
      acceptDecision: false,
      status: "not-started",
    },
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const format = (value, decimals = 3) => Number(value).toFixed(decimals);
  const dbRatio = (db) => 10 ** (db / 20);
  const readStorage = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  if (!balancedInstructionCurrent()) {
    location.href = location.pathname;
    return;
  }
  const loadState = () => {
    const saved = readStorage(STORAGE_KEY);
    if (!saved) return clone(defaults);
    return {
      ...clone(defaults),
      ...saved,
      model: { ...defaults.model, ...saved.model },
      prediction: { ...defaults.prediction, ...saved.prediction },
      retrieval: { ...defaults.retrieval, ...saved.retrieval },
      lab: { ...defaults.lab, ...saved.lab },
      completed: defaults.completed.map((v, i) =>
        Boolean(saved.completed?.[i] ?? v),
      ),
    };
  };
  function instructionCurrent(candidate = state) {
    return (
      candidate.completed.slice(1, 5).every(Boolean) &&
      candidate.prediction.revealed &&
      candidate.retrieval.gain === "headroom" &&
      candidate.retrieval.loading === "parallel" &&
      candidate.retrieval.noise === "early"
    );
  }
  let state = loadState();
  let paused = false;
  let reducedMotion =
    localStorage.getItem(MOTION_KEY) === null
      ? matchMedia("(prefers-reduced-motion: reduce)").matches
      : localStorage.getItem(MOTION_KEY) === "true";
  let time = 0;
  let speed = 1;
  let cartTravel = 1;
  let cartFrom = { x: 735, y: 410 };
  let cartTo = { ...cartFrom };
  let cartPosition = { ...cartFrom };
  let worldScale = 1;

  document.title = "Audio Park — Gain Lift";
  document.body.classList.add("gain-mode");
  $("stopKicker").textContent = "STOP 3 OF 11";
  $("stationTitle").textContent = "Gain Lift";
  $("stationLead").textContent =
    "Allocate voltage deliberately: preserve headroom, test loading, and keep model, datasheet, assumed, and measured values separate.";
  $("guide").setAttribute("aria-label", "Gain Lift lesson guide");
  $("lessonNav").setAttribute("aria-label", "Gain Lift lessons");
  $("dispatchRoute").className = "route-chip released";
  $("balancedRoute").className = "route-chip released";
  $("gainRoute").className = "route-chip current";
  $("routeStatus").textContent = "three stations open";
  $("dispatchStation").classList.add("completed-station");
  $("balancedStation").classList.remove("released-station");
  $("balancedStation").classList.add("completed-station");
  $("gainStation").classList.remove("locked-station", "ready-station");
  $("gainStation").classList.add("active-balanced-station");
  $("gainStation").removeAttribute("data-lock");
  $("gainStation").setAttribute("aria-label", "Gain Lift");
  updateZoneAccess();
  $("lessonCount").textContent = `1 / ${chapterNames.length}`;
  document.querySelector(".world-hud span:first-child b").textContent =
    "3 / 11";

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function setFeedback(element, message, correct) {
    element.textContent = message;
    element.className = `feedback ${correct ? "correct" : "incorrect"}`;
  }
  function complete(index) {
    state.completed[index] = true;
    state.maxChapter = Math.max(
      state.maxChapter,
      Math.min(index + 1, chapterNames.length - 1),
    );
    save();
    renderNav();
    renderFooter();
    updateZoneAccess();
  }
  function invalidate(index) {
    state.completed[index] = false;
    if (state.lab.status === "complete") {
      state.lab.status = "not-started";
      state.completed[5] = false;
    }
    save();
    renderFooter();
    updateZoneAccess();
  }

  function updateZoneAccess() {
    const ready = instructionCurrent();
    $("zoneRoute").disabled = !ready;
    $("zoneRoute").className = `route-chip ${ready ? "released" : "locked"}`;
    $("zoneStation").setAttribute(
      "class",
      ready ? "station released-station" : "station locked-station",
    );
    $("zoneStation").setAttribute(
      "aria-label",
      ready ? "Open Zone Switchyard" : "Zone Switchyard needs the Gain Lift instructional sequence",
    );
    if (ready) $("zoneStation").removeAttribute("data-lock");
    $("routeStatus").textContent = ready ? "four stations open" : "three stations open";
  }
  function targetFor(index) {
    return [
      { x: 705, y: 410 },
      { x: 735, y: 382 },
      { x: 765, y: 354 },
      { x: 795, y: 326 },
      { x: 824, y: 299 },
      { x: 850, y: 278 },
    ][index];
  }
  function setTarget(target, replay = false) {
    cartFrom = replay
      ? targetFor(Math.max(0, state.chapter - 1))
      : { ...cartPosition };
    cartTo = { ...target };
    cartTravel = reducedMotion ? 1 : 0;
  }
  function modelNumbers() {
    const m = state.model;
    const parallelLoad = m.inputZ / m.zones;
    const receiverIn = (m.source * parallelLoad) / (m.sourceZ + parallelLoad);
    const receiverOut = receiverIn * dbRatio(m.receiverDb);
    const selectorOut = receiverOut * dbRatio(m.selectorDb);
    const amplifierIn = selectorOut * dbRatio(m.amplifierDb);
    const headroom = m.limit - Math.max(receiverOut, selectorOut, amplifierIn);
    const corner = 1 / (2 * Math.PI * parallelLoad * m.capacitor * 1e-6);
    return {
      parallelLoad,
      receiverIn,
      receiverOut,
      selectorOut,
      amplifierIn,
      headroom,
      corner,
    };
  }
  function correctPrediction() {
    return modelNumbers().headroom >= 0 ? "fits" : "clips";
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
      button.addEventListener("click", () => goTo(index));
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
    $("previousLesson").disabled = state.chapter === 0;
    const next = $("nextLesson");
    next.disabled =
      state.chapter > 0 &&
      state.chapter !== 5 &&
      !state.completed[state.chapter];
    next.textContent =
      state.chapter === 0
        ? "Enter lift →"
        : state.chapter === 5
          ? state.lab.status === "complete"
            ? "Optional lab badge ✓"
            : "Optional bench extension"
          : "Continue →";
  }
  function goTo(index) {
    if (index < 0 || index >= chapterNames.length || index > state.maxChapter)
      return;
    state.chapter = index;
    setTarget(targetFor(index));
    save();
    render();
    $("guide").scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }
  function prerequisiteCard() {
    return `<div class="prerequisite-card ready"><b>Optional evidence context:</b> bench records are independent comparisons. Their presence or absence never controls this station or Zone Switchyard.</div>`;
  }

  const templates = [
    () =>
      `<div class="lesson-banner">The lift raises or lowers voltage at named stages. Loudness is not a gain plan.</div><h2>Read the gain route</h2><p>The signal cart passes through a source, a receiver, selector/preamp, then an amplifier input. Each stage gets a voltage, a gain or attenuation, a load, and a usable output limit. A gain plan protects every stage rather than turning each control up until it sounds loud.</p><div class="comparison-grid"><article><h3>Model</h3><p>A teaching value selected for this animation. It predicts this animation only.</p></article><article><h3>Datasheet</h3><p>A value from the exact identified product documentation, with conditions.</p></article><article><h3>Assumed</h3><p>A provisional planning value. It remains visible and cannot become a measurement.</p></article><article><h3>Measured</h3><p>A retained observation with fixture, units, settings, and conditions.</p></article></div><div class="worked-example"><b>Worked route</b><p>A 0.500 Vrms <em>model</em> source enters a 10 kΩ <em>model</em> input through 1 kΩ <em>model</em> source impedance. With two equal zones the parallel model load is 5 kΩ, so the receiver input is 0.500 × 5/(1 + 5) = 0.417 Vrms. This is a model, not a claim about the DJ, streamer, receiver, or PT2314.</p></div><div class="safety-box"><b>Boundary:</b> Gain Lift does not authorise a purchased receiver, PT2314, Fosi amplifier, 48 V supply, speakers, or an unknown input. Its practical activity uses a low-voltage passive load fixture only.</div>`,
    () => {
      const n = modelNumbers();
      return `<div class="lesson-banner">Headroom is the distance between a demanded output and a stated usable limit.</div><h2>Gain, output, and margin</h2><p><b>Voltage gain</b> is Vout/Vin. Gain above 1 raises voltage; attenuation below 1 lowers it. <b>Headroom</b> is the remaining margin before a stage’s stated usable output limit. The limit depends on supply, load, frequency, distortion criterion, and circuit.</p><div class="formula-card"><span class="formula">Vout = Vin × 10^(gain dB / 20)</span><span class="formula">headroom = limit − demanded output</span><span class="formula-note">This station uses 1.000 Vrms as a deliberately simple model limit, not a hardware rating.</span></div><div class="worked-example"><b>Worked example</b><p>0.500 Vrms with +6 dB model gain becomes 0.500 × 1.995 = 0.998 Vrms. With a 1.000 Vrms model limit, headroom is 0.002 Vrms. It fits the calculation but leaves no useful margin.</p></div><div class="interactive-card"><h3>Observe one variable: selector level</h3><p>Hold the other model values fixed. The cart height follows the largest demanded stage output.</p><div class="control-row"><label for="selectorDb">Selector model gain</label><output id="selectorDbValue">${format(state.model.selectorDb, 1)} dB</output><input id="selectorDb" type="range" min="-18" max="12" step="1" value="${state.model.selectorDb}" /></div><div class="metric-grid"><div class="metric"><small>Receiver out</small><strong id="receiverOut">${format(n.receiverOut)} Vrms</strong></div><div class="metric"><small>Selector out</small><strong id="selectorOut">${format(n.selectorOut)} Vrms</strong></div><div class="metric"><small>Headroom</small><strong id="headroom">${format(n.headroom)} Vrms</strong></div></div></div><div class="check-card"><h3>Retrieve it</h3><p>Which planning question protects headroom?</p><div class="answer-list"><label><input type="radio" name="gainAnswer" value="loudness" ${state.retrieval.gain === "loudness" ? "checked" : ""}/> Which knob sounds loudest?</label><label><input type="radio" name="gainAnswer" value="headroom" ${state.retrieval.gain === "headroom" ? "checked" : ""}/> Does every stated stage limit exceed its demanded output with margin?</label><label><input type="radio" name="gainAnswer" value="label" ${state.retrieval.gain === "label" ? "checked" : ""}/> Does the module label include an op amp?</label></div><button id="checkGain" class="action-button" type="button">Check answer</button><p id="gainFeedback" class="feedback" aria-live="polite"></p></div>`;
    },
    () => {
      const n = modelNumbers();
      const right = correctPrediction();
      return `<div class="lesson-banner">dB adds along a chain; voltage ratios multiply. Preserve an explicit limit at every real stage.</div><h2>Follow the cart through the lift</h2><p>For voltage quantities, dB is a logarithmic ratio. Adding +6 dB and −6 dB gives 0 dB overall, close to 1× voltage. A chain calculation starts at the loaded source voltage, then applies each stage ratio in order.</p><div class="formula-card"><span class="formula">gain dB = 20 log10(Vout/Vin)</span><span class="formula">total dB = stage dB values added</span></div><div class="interactive-card"><h3>Commit before the roof opens</h3><p>Change the receiver, selector, or amplifier <em>model</em> gains. The model limit is 1.000 Vrms. The numerical consequence remains sealed until a prediction and a reason are committed.</p><div class="control-row"><label for="receiverDb">Receiver model gain</label><output id="receiverDbValue">${format(state.model.receiverDb, 1)} dB</output><input id="receiverDb" type="range" min="-12" max="12" step="1" value="${state.model.receiverDb}" /></div><div class="control-row"><label for="amplifierDb">Amplifier-input model gain</label><output id="amplifierDbValue">${format(state.model.amplifierDb, 1)} dB</output><input id="amplifierDb" type="range" min="-12" max="18" step="1" value="${state.model.amplifierDb}" /></div><div class="prediction-lock ${state.prediction.revealed ? "revealed" : ""}">${state.prediction.revealed ? `Model ${right === "fits" ? "fits all stated stage limits" : "clips a stated stage"}: amplifier input ${format(n.amplifierIn)} Vrms; limiting headroom ${format(n.headroom)} Vrms.` : "The lift consequence is sealed until you commit a prediction."}</div><div class="answer-list"><label><input type="radio" name="liftPrediction" value="fits" ${state.prediction.answer === "fits" ? "checked" : ""}/> Every stated model stage fits</label><label><input type="radio" name="liftPrediction" value="clips" ${state.prediction.answer === "clips" ? "checked" : ""}/> At least one stated model stage clips</label></div><label class="standalone-field">Why?<textarea id="liftReasoning" rows="2" placeholder="Mention demanded output, a stage limit, headroom, or loading.">${safe(state.prediction.reasoning)}</textarea></label><button id="revealLift" class="action-button" type="button">Commit prediction and reveal</button><p id="liftFeedback" class="feedback" aria-live="polite"></p></div>`;
    },
    () => {
      const n = modelNumbers();
      return `<div class="lesson-banner">Two receiver inputs in parallel load a source more than one input. That is a circuit calculation, not a 10 kΩ rule.</div><h2>Loading changes the voltage that arrives</h2><p><b>Source impedance</b> resists delivery from the source. <b>Input impedance</b> is the load presented by the receiving stage. At line level, a receiver normally bridges a source rather than terminating it for maximum power. The actual target depends on drive capability, noise, coupling capacitors, protection, and frequency response.</p><div class="formula-card"><span class="formula">Zparallel = 1 / (1/Z1 + 1/Z2)</span><span class="formula">Vload = Vs × Zload / (Zsource + Zload)</span></div><div class="worked-example"><b>Worked example</b><p>Two 10 kΩ <em>model</em> loads in parallel are 5 kΩ. A 1 kΩ <em>model</em> source impedance delivers 5/(1+5) = 0.833× of source voltage. This does not identify the actual source or receiver impedance.</p></div><div class="interactive-card"><h3>Observe one variable: number of model zones</h3><div class="control-row"><label for="zones">Equal model zones</label><output id="zonesValue">${state.model.zones}</output><input id="zones" type="range" min="1" max="4" step="1" value="${state.model.zones}" /></div><div class="metric-grid"><div class="metric"><small>Parallel model load</small><strong id="parallelLoad">${format(n.parallelLoad, 0)} Ω</strong></div><div class="metric"><small>Loaded receiver input</small><strong id="loadedInput">${format(n.receiverIn)} Vrms</strong></div><div class="metric"><small>1 µF model corner</small><strong id="corner">${format(n.corner, 1)} Hz</strong></div></div></div><div class="check-card"><h3>Retrieve it</h3><p>Two equal input impedances connected to one source combine how?</p><div class="answer-list"><label><input type="radio" name="loadingAnswer" value="series" ${state.retrieval.loading === "series" ? "checked" : ""}/> In series, so resistance doubles</label><label><input type="radio" name="loadingAnswer" value="parallel" ${state.retrieval.loading === "parallel" ? "checked" : ""}/> In parallel, so the combined impedance is lower</label><label><input type="radio" name="loadingAnswer" value="isolated" ${state.retrieval.loading === "isolated" ? "checked" : ""}/> They cannot affect each other</label></div><button id="checkLoading" class="action-button" type="button">Check answer</button><p id="loadingFeedback" class="feedback" aria-live="polite"></p></div>`;
    },
    () =>
      `<div class="lesson-banner">Attenuating early and adding gain later can make later-stage noise more audible. “More gain” is not a noise remedy.</div><h2>Allocate gain before the noise floor rises</h2><p>Every stage contributes some noise. When a quiet source is strongly attenuated early, later stages need more gain to restore level; their noise is then raised along with the wanted signal. The exact noise result needs stated bandwidth, source impedance, gain, termination, and measurement method.</p><div class="comparison-grid"><article><h3>Early attenuation, late gain</h3><p>0.500 Vrms → −18 dB → +18 dB. The final voltage can match, but noise added after attenuation is amplified.</p></article><article><h3>Moderate staged allocation</h3><p>Keep the wanted signal materially above later-stage noise while preserving every stage’s headroom.</p></article></div><div class="tycoon-tip"><b>What to record:</b> comparison wiring, source state, gain settings, bandwidth, reference level, instrument/probe method, and an observed relative result. Do not call a scope comparison THD+N.</div><div class="check-card"><h3>Retrieve the trade-off</h3><p>Which allocation is usually the better starting hypothesis, subject to measurement?</p><div class="answer-list"><label><input type="radio" name="noiseAnswer" value="early" ${state.retrieval.noise === "early" ? "checked" : ""}/> Preserve sensible early signal level while leaving headroom, rather than throw it away then recover it late</label><label><input type="radio" name="noiseAnswer" value="maximum" ${state.retrieval.noise === "maximum" ? "checked" : ""}/> Maximise every stage gain</label><label><input type="radio" name="noiseAnswer" value="label" ${state.retrieval.noise === "label" ? "checked" : ""}/> Copy the module label’s gain</label></div><button id="checkNoise" class="action-button" type="button">Check answer</button><p id="noiseFeedback" class="feedback" aria-live="polite"></p></div>`,
    renderLab,
  ];

  function renderLab() {
    const lab = state.lab;
    return `<div class="lesson-banner">Make a decision-ready provisional gain plan, then test a harmless passive-load model before selecting a buffer.</div><h2>Gain-plan lab: bounded passive loading</h2>${prerequisiteCard()}<div class="safety-box"><b>Hard boundary:</b> do not connect the DJ booth, streamer, receiver module, PT2314, Fosi amplifier, 48 V supply, or speakers. This lab uses only the verified low-voltage sine source from Signal Dispatch and two measured resistors as a known load fixture. Stop below 1.000 Vrms, on an uncertain return, an unstable waveform, or a result outside the stated correlation rule.</div><div class="lab-card"><h3>1. Gain table with provenance</h3><p>Enter a record reference for each stage and label every number. Assumed is allowed for planning only; it remains assumed and must not be called measured.</p><div class="evidence-grid"><label class="wide">Source identity and maximum-level evidence<input id="sourceEvidence" value="${safe(lab.sourceEvidence)}" placeholder="Exact source/fixture, condition, capture or notebook reference" /></label><label>Source maximum (Vrms)<input id="sourceMax" type="number" min="0" max="1" step="0.001" value="${safe(lab.sourceMax)}" /></label><label>Source classification<select id="sourceClass"><option value="">Choose</option><option value="measured" ${lab.sourceClass === "measured" ? "selected" : ""}>Measured</option><option value="datasheet" ${lab.sourceClass === "datasheet" ? "selected" : ""}>Datasheet</option><option value="assumed" ${lab.sourceClass === "assumed" ? "selected" : ""}>Assumed</option></select></label><label>Receiver evidence/reference<input id="receiverEvidence" value="${safe(lab.receiverEvidence)}" placeholder="Balanced Tunnel record reference" /></label><label>Receiver gain (dB)<input id="receiverGain" type="number" step="0.1" value="${safe(lab.receiverGain)}" /></label><label>Receiver classification<select id="receiverClass"><option value="">Choose</option><option value="measured" ${lab.receiverClass === "measured" ? "selected" : ""}>Measured</option><option value="datasheet" ${lab.receiverClass === "datasheet" ? "selected" : ""}>Datasheet</option><option value="assumed" ${lab.receiverClass === "assumed" ? "selected" : ""}>Assumed</option></select></label><label>Selector/preamp gain (dB)<input id="selectorGain" type="number" step="0.1" value="${safe(lab.selectorGain)}" /></label><label>Selector classification<select id="selectorClass"><option value="">Choose</option><option value="measured" ${lab.selectorClass === "measured" ? "selected" : ""}>Measured</option><option value="datasheet" ${lab.selectorClass === "datasheet" ? "selected" : ""}>Datasheet</option><option value="assumed" ${lab.selectorClass === "assumed" ? "selected" : ""}>Assumed</option></select></label><label>Amplifier-knob reference / input boundary<input id="amplifierReference" value="${safe(lab.amplifierReference)}" placeholder="Fixed-knob setting and evidence reference" /></label><label>Amplifier classification<select id="amplifierClass"><option value="">Choose</option><option value="measured" ${lab.amplifierClass === "measured" ? "selected" : ""}>Measured</option><option value="datasheet" ${lab.amplifierClass === "datasheet" ? "selected" : ""}>Datasheet</option><option value="assumed" ${lab.amplifierClass === "assumed" ? "selected" : ""}>Assumed</option></select></label></div></div><div class="lab-card"><h3>2. Build the known passive-load fixture</h3><pre class="diagram">verified low-voltage source signal ──┬── Rload 1 ── source return / circuit 0 V\n                                      └── Rload 2 ── source return / circuit 0 V\n\nScope ground clip: circuit 0 V only. Measure Vin at source signal, then Vout at the same node with both loads connected.</pre><p>Measure both resistors out of circuit. Record their values and source impedance with a provenance label. The source impedance may be an assumed planning value, but the app will display that distinction and will not call the calculation measured.</p><div class="evidence-grid"><label>Source impedance (Ω)<input id="sourceZ" type="number" min="0" step="1" value="${safe(lab.sourceZ)}" /></label><label>Source-Z classification<select id="sourceZClass"><option value="">Choose</option><option value="measured" ${lab.sourceZClass === "measured" ? "selected" : ""}>Measured</option><option value="datasheet" ${lab.sourceZClass === "datasheet" ? "selected" : ""}>Datasheet</option><option value="assumed" ${lab.sourceZClass === "assumed" ? "selected" : ""}>Assumed</option></select></label><label>Rload 1 measured (Ω)<input id="loadOne" type="number" min="1" step="1" value="${safe(lab.loadOne)}" /></label><label>Rload 2 measured (Ω)<input id="loadTwo" type="number" min="1" step="1" value="${safe(lab.loadTwo)}" /></label><label>Vin observed (Vrms)<input id="vin" type="number" min="0" max="1" step="0.001" value="${safe(lab.vin)}" /></label><label>Vout observed (Vrms)<input id="vout" type="number" min="0" max="1" step="0.001" value="${safe(lab.vout)}" /></label><label>Frequency (Hz)<input id="frequency" type="number" min="1" step="1" value="${safe(lab.frequency)}" /></label><label class="wide">Scope settings / capture reference<input id="capture" value="${safe(lab.capture)}" placeholder="Probe attenuation, coupling, bandwidth, screenshots/notebook page" /></label></div><div id="loadCalculation" class="formula-card"></div></div><div class="lab-card"><h3>3. Compare noise and choose the next action</h3><p>Only compare safe line-level arrangements. Hold source, cabling, reference level, and stated bandwidth as constant as possible. A qualitative scope/listening result can select the next test; it is not THD+N.</p><div class="evidence-grid"><label class="wide">Noise comparison conditions<input id="noiseConditions" value="${safe(lab.noiseConditions)}" placeholder="Wiring, gains, termination, bandwidth, reference level, instrument method" /></label><label class="wide">Observed relative noise result<input id="noiseResult" value="${safe(lab.noiseResult)}" placeholder="Result and retained capture/reference; do not enter THD+N" /></label><label class="wide">Prediction versus observation reflection<textarea id="reflection" rows="3">${safe(lab.reflection)}</textarea></label><label>Passive split decision<select id="decision"><option value="">Choose from evidence</option><option value="passive" ${lab.decision === "passive" ? "selected" : ""}>Keep passive split provisionally</option><option value="buffer" ${lab.decision === "buffer" ? "selected" : ""}>Evaluate a buffer next</option><option value="defer" ${lab.decision === "defer" ? "selected" : ""}>Defer: evidence is incomplete</option></select></label><label class="wide acceptance-check"><input id="acceptDecision" type="checkbox" ${lab.acceptDecision ? "checked" : ""}/><span>I accept this as a preliminary gain/loading decision, not proof of module pinouts, rails, gain, noise, amplifier capability, or final audio quality.</span></label></div><button id="saveGainLab" class="action-button" type="button">Validate and save current evidence</button><p id="gainLabFeedback" class="feedback" aria-live="polite"></p><div id="gainLabCompletion"></div></div>`;
  }

  function render() {
    renderNav();
    renderFooter();
    $("lessonContent").innerHTML = templates[state.chapter]();
    [bindMap, bindHeadroom, bindChain, bindLoading, bindNoise, bindLab][
      state.chapter
    ]();
    updateWorld(true);
  }
  function bindMap() {
    $("cartCargo").textContent = "gain-plan inputs";
    $("worldNarration").textContent =
      "The cart enters the lift with each value tagged as model, datasheet, assumed, or measured.";
  }
  function bindHeadroom() {
    const update = () => {
      state.model.selectorDb = Number($("selectorDb").value);
      const n = modelNumbers();
      $("selectorDbValue").textContent =
        `${format(state.model.selectorDb, 1)} dB`;
      $("receiverOut").textContent = `${format(n.receiverOut)} Vrms`;
      $("selectorOut").textContent = `${format(n.selectorOut)} Vrms`;
      $("headroom").textContent = `${format(n.headroom)} Vrms`;
      $("cartCargo").textContent =
        n.headroom >= 0 ? "model headroom" : "model clipping risk";
      save();
      updateWorld();
    };
    $("selectorDb").addEventListener("input", update);
    document.querySelectorAll('input[name="gainAnswer"]').forEach((el) =>
      el.addEventListener("change", () => {
        state.retrieval.gain = el.value;
        invalidate(1);
      }),
    );
    $("checkGain").addEventListener("click", () => {
      const answer = document.querySelector('input[name="gainAnswer"]:checked');
      if (!answer)
        return setFeedback($("gainFeedback"), "Choose an answer first.", false);
      const correct = answer.value === "headroom";
      setFeedback(
        $("gainFeedback"),
        correct
          ? "Correct. The plan needs a stated limit and a margin at every stage."
          : "A gain plan must compare every demanded output with a stated stage limit.",
        correct,
      );
      if (correct) complete(1);
    });
    update();
  }
  function bindChain() {
    const update = () => {
      state.model.receiverDb = Number($("receiverDb").value);
      state.model.amplifierDb = Number($("amplifierDb").value);
      $("receiverDbValue").textContent =
        `${format(state.model.receiverDb, 1)} dB`;
      $("amplifierDbValue").textContent =
        `${format(state.model.amplifierDb, 1)} dB`;
      if (state.prediction.revealed) {
        state.prediction.revealed = false;
        invalidate(2);
        render();
        return;
      }
      save();
      updateWorld();
    };
    $("receiverDb").addEventListener("input", update);
    $("amplifierDb").addEventListener("input", update);
    document.querySelectorAll('input[name="liftPrediction"]').forEach((el) =>
      el.addEventListener("change", () => {
        state.prediction.answer = el.value;
        invalidate(2);
      }),
    );
    $("liftReasoning").addEventListener("input", (event) => {
      state.prediction.reasoning = event.target.value;
      invalidate(2);
    });
    $("revealLift").addEventListener("click", () => {
      if (
        !state.prediction.answer ||
        state.prediction.reasoning.trim().length < 8
      )
        return setFeedback(
          $("liftFeedback"),
          "Choose an outcome and give a short causal reason before revealing the model.",
          false,
        );
      state.prediction.revealed = true;
      const correct = state.prediction.answer === correctPrediction();
      setFeedback(
        $("liftFeedback"),
        correct
          ? "Prediction recorded. Compare the largest demanded model output with the stated model limit."
          : "Prediction recorded. The model outcome is shown; use the stage outputs and stated limit to diagnose it.",
        correct,
      );
      complete(2);
      render();
    });
  }
  function bindLoading() {
    const update = () => {
      state.model.zones = Number($("zones").value);
      const n = modelNumbers();
      $("zonesValue").textContent = state.model.zones;
      $("parallelLoad").textContent = `${format(n.parallelLoad, 0)} Ω`;
      $("loadedInput").textContent = `${format(n.receiverIn)} Vrms`;
      $("corner").textContent = `${format(n.corner, 1)} Hz`;
      $("cartCargo").textContent =
        `${state.model.zones} model zones · ${format(n.parallelLoad, 0)} Ω`;
      save();
      updateWorld();
    };
    $("zones").addEventListener("input", update);
    document.querySelectorAll('input[name="loadingAnswer"]').forEach((el) =>
      el.addEventListener("change", () => {
        state.retrieval.loading = el.value;
        invalidate(3);
      }),
    );
    $("checkLoading").addEventListener("click", () => {
      const answer = document.querySelector(
        'input[name="loadingAnswer"]:checked',
      );
      if (!answer)
        return setFeedback(
          $("loadingFeedback"),
          "Choose an answer first.",
          false,
        );
      const correct = answer.value === "parallel";
      setFeedback(
        $("loadingFeedback"),
        correct
          ? "Correct. Equal inputs in parallel lower the combined load."
          : "Use the parallel-resistance relationship, not a connector label.",
        correct,
      );
      if (correct) complete(3);
    });
    update();
  }
  function bindNoise() {
    $("cartCargo").textContent = "noise trade-off";
    document.querySelectorAll('input[name="noiseAnswer"]').forEach((el) =>
      el.addEventListener("change", () => {
        state.retrieval.noise = el.value;
        invalidate(4);
      }),
    );
    $("checkNoise").addEventListener("click", () => {
      const answer = document.querySelector(
        'input[name="noiseAnswer"]:checked',
      );
      if (!answer)
        return setFeedback(
          $("noiseFeedback"),
          "Choose an answer first.",
          false,
        );
      const correct = answer.value === "early";
      setFeedback(
        $("noiseFeedback"),
        correct
          ? "Correct. It is a starting hypothesis, then a measured comparison under stated conditions."
          : "Maximising stage gains or copying a label does not allocate noise deliberately.",
        correct,
      );
      if (correct) complete(4);
    });
  }
  function collectLab() {
    document
      .querySelectorAll(
        "#lessonContent input, #lessonContent select, #lessonContent textarea",
      )
      .forEach((field) => {
        if (field.id && Object.hasOwn(state.lab, field.id))
          state.lab[field.id] =
            field.type === "checkbox" ? field.checked : field.value;
      });
  }
  function labNumbers(lab = state.lab) {
    const z1 = Number(lab.loadOne);
    const z2 = Number(lab.loadTwo);
    const zs = Number(lab.sourceZ);
    const vin = Number(lab.vin);
    if (!(z1 > 0 && z2 > 0 && zs >= 0 && vin > 0)) return null;
    const load = 1 / (1 / z1 + 1 / z2);
    return { load, expected: (vin * load) / (zs + load) };
  }
  function renderLabCalculation() {
    collectLab();
    const n = labNumbers();
    const target = $("loadCalculation");
    if (!n) {
      target.innerHTML =
        '<span class="formula-note">Enter positive resistor values, a non-negative source impedance, and Vin to calculate the passive-load model.</span>';
      return;
    }
    const observed = Number(state.lab.vout);
    const difference = Number.isFinite(observed)
      ? Math.abs(observed - n.expected)
      : null;
    target.innerHTML = `<span class="formula">Rparallel = ${format(n.load, 1)} Ω</span><span class="formula">model Vout = ${format(n.expected)} Vrms</span><span class="formula-note">${difference === null ? "Enter observed Vout to compare." : `Observed difference: ${format(difference)} Vrms. Teaching correlation limit: max(5%, 10 mV).`}</span>`;
  }
  function invalidText(value) {
    return (
      !value ||
      /\b(?:tbd|unknown|unresolved|unsupported|unverified|uncertain|ambiguous|assum(?:e|ed|ption)|not\s+(?:yet\s+)?(?:supported|verified|confirmed|measured|identified|documented|known))\b/i.test(
        value,
      )
    );
  }
  function renderLabCompletion() {
    const target = $("gainLabCompletion");
    if (!target) return;
    const messages = {
      complete:
        '<div class="completion-card"><h3>Optional Gain Lift bench badge recorded</h3><p>A provisional gain/loading comparison is current. It does not control Zone Switchyard or authorise a hardware path.</p></div>',
      "needs-investigation":
        '<div class="blocked-box"><b>Evidence retained for investigation:</b> the loading comparison or decision needs work. Course lessons remain available.</div>',
    };
    target.innerHTML =
      messages[state.lab.status] ||
      '<div class="blocked-box"><b>Optional extension ready for preparation:</b> model and fixture evidence can be recorded while physical conditions remain bounded.</div>';
  }
  function bindLab() {
    const inputs = document.querySelectorAll(
      ".lab-card input, .lab-card select, .lab-card textarea",
    );
    inputs.forEach((field) =>
      field.addEventListener("input", () => {
        collectLab();
        state.lab.status = "not-started";
        state.completed[5] = false;
        save();
        renderLabCalculation();
        renderLabCompletion();
        renderFooter();
      }),
    );
    $("saveGainLab").addEventListener("click", () => {
      collectLab();
      const lab = state.lab;
      const feedback = $("gainLabFeedback");
      if (!instructionCurrent())
        return setFeedback(
          feedback,
          "Re-complete the gain/headroom, committed prediction, loading, and noise retrieval gates before saving practical evidence.",
          false,
        );
      const textFields = [
        lab.sourceEvidence,
        lab.receiverEvidence,
        lab.amplifierReference,
        lab.capture,
        lab.noiseConditions,
        lab.noiseResult,
        lab.reflection,
      ];
      if (
        textFields.some(
          (value) => invalidText(value) || value.trim().length < 6,
        )
      )
        return setFeedback(
          feedback,
          "Record current, supported evidence references and conditions. Contradictory or unresolved free text cannot complete the gate.",
          false,
        );
      const classes = [
        lab.sourceClass,
        lab.receiverClass,
        lab.selectorClass,
        lab.amplifierClass,
        lab.sourceZClass,
      ];
      if (
        classes.some(
          (value) => !["measured", "datasheet", "assumed"].includes(value),
        )
      )
        return setFeedback(
          feedback,
          "Classify every gain-table value as measured, datasheet, or assumed.",
          false,
        );
      const numeric = [
        lab.sourceMax,
        lab.receiverGain,
        lab.selectorGain,
        lab.sourceZ,
        lab.loadOne,
        lab.loadTwo,
        lab.vin,
        lab.vout,
        lab.frequency,
      ];
      if (
        numeric.some((value) => value === "" || !Number.isFinite(Number(value)))
      )
        return setFeedback(
          feedback,
          "Complete every numerical field with units shown in the form.",
          false,
        );
      if (!(
        Number(lab.sourceMax) > 0 &&
        Number(lab.sourceMax) <= 1 &&
        Number(lab.sourceZ) >= 0 &&
        Number(lab.loadOne) > 0 &&
        Number(lab.loadTwo) > 0 &&
        Number(lab.vin) > 0 &&
        Number(lab.vin) <= 1 &&
        Number(lab.vout) > 0 &&
        Number(lab.vout) <= 1 &&
        Number(lab.frequency) > 0
      ))
        return setFeedback(
          feedback,
          "The passive fixture record must stay within 0–1.000 Vrms and have positive loads/frequency. Recheck values and units.",
          false,
        );
      const n = labNumbers(lab);
      const difference = Math.abs(Number(lab.vout) - n.expected);
      const allowed = Math.max(0.01, n.expected * 0.05);
      if (difference > allowed) {
        lab.status = "needs-investigation";
        save();
        renderLabCompletion();
        return setFeedback(
          feedback,
          `Evidence retained for investigation. Expected ${format(n.expected)} Vrms from the stated passive-load model; the ${format(difference)} Vrms difference exceeds the ${format(allowed)} Vrms teaching correlation limit. Disable the source and inspect resistor values, returns, probe settings, and source impedance before repeating.`,
          false,
        );
      }
      if (!lab.decision || !lab.acceptDecision || lab.decision === "defer") {
        lab.status = "needs-investigation";
        save();
        renderLabCompletion();
        return setFeedback(
          feedback,
          "A supported passive/buffer next action and explicit acceptance are required for the optional bench badge. Deferral remains useful retained evidence and does not affect station availability.",
          false,
        );
      }
      lab.status = "complete";
      complete(5);
      save();
      renderLabCompletion();
      setFeedback(
        feedback,
        "Current provisional gain/loading evidence accepted. Editing any gated input invalidates completion.",
        true,
      );
    });
    renderLabCalculation();
    renderLabCompletion();
    $("cartCargo").textContent = "gain-plan evidence";
    $("worldNarration").textContent =
      "The cart remains in the low-voltage model bay. Unknown equipment never becomes a load by filling in a form.";
  }
  function updateWorld(force = false) {
    const n = modelNumbers();
    const eased = 1 - (1 - cartTravel) ** 3;
    cartPosition = {
      x: cartFrom.x + (cartTo.x - cartFrom.x) * eased,
      y: cartFrom.y + (cartTo.y - cartFrom.y) * eased,
    };
    $("signalCart").setAttribute(
      "transform",
      `translate(${cartPosition.x.toFixed(1)} ${cartPosition.y.toFixed(1)})`,
    );
    const amplitude = Math.min(15, 5 + n.amplifierIn * 12);
    let path = "";
    for (let x = -23; x <= 23; x += 2)
      path += `${x === -23 ? "M" : "L"}${x},${(-7 - Math.sin((x + 23) * 0.28 + time) * amplitude).toFixed(1)} `;
    $("cartWave").setAttribute("d", path);
    $("crestBarrier").style.opacity = n.headroom < 0 ? "1" : "0.2";
    updateCamera();
    if (force && !reducedMotion) $("signalCart").getBoundingClientRect();
  }
  function animate() {
    if (!paused && !reducedMotion) {
      time += 0.035 * speed;
      cartTravel = Math.min(1, cartTravel + 0.012 * speed);
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
      mobile ? "440 190 590 420" : "0 0 1200 760",
    );
    if (mobile && worldScale !== 1) {
      worldScale = 1;
      updateCamera();
    }
  }
  $("previousLesson").addEventListener("click", () => goTo(state.chapter - 1));
  $("nextLesson").addEventListener("click", () => {
    if (state.chapter === 0) {
      complete(0);
      goTo(1);
    } else if (state.completed[state.chapter] && state.chapter < 5)
      goTo(state.chapter + 1);
  });
  const openDispatch = () => {
    location.href = location.pathname;
  };
  const openBalanced = () => {
    location.search = "?station=balanced";
  };
  const openZone = () => {
    if (!instructionCurrent()) {
      $("worldNarration").textContent =
        "Zone Switchyard needs the Gain Lift simulation, committed prediction, retrieval, and design sequence. Optional bench evidence is not required.";
      return;
    }
    location.search = "?station=zone";
  };
  $("dispatchRoute").addEventListener("click", openDispatch);
  $("dispatchStation").addEventListener("click", openDispatch);
  $("balancedRoute").addEventListener("click", openBalanced);
  $("balancedStation").addEventListener("click", openBalanced);
  $("zoneRoute").addEventListener("click", openZone);
  $("zoneStation").addEventListener("click", openZone);
  $("gainRoute").addEventListener("click", () =>
    goTo(Math.min(state.maxChapter, 2)),
  );
  $("gainStation").addEventListener("click", () =>
    goTo(Math.min(state.maxChapter, 2)),
  );
  [
    [$("dispatchStation"), openDispatch],
    [$("balancedStation"), openBalanced],
    [$("gainStation"), () => goTo(Math.min(state.maxChapter, 2))],
    [$("zoneStation"), openZone],
  ].forEach(([element, action]) =>
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
      }
    }),
  );
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
    time += 0.45;
    cartTravel = Math.min(1, cartTravel + 0.18);
    $("pauseButton").setAttribute("aria-pressed", "true");
    $("pauseButton").querySelector("span").textContent = "▶";
    $("pauseButton").querySelector(".control-label").textContent = "Play";
    updateWorld();
  });
  $("replayButton").addEventListener("click", () => {
    time = 0;
    paused = false;
    setTarget(targetFor(state.chapter), true);
    $("pauseButton").setAttribute("aria-pressed", "false");
    $("pauseButton").querySelector("span").textContent = "Ⅱ";
    $("pauseButton").querySelector(".control-label").textContent = "Pause";
    updateWorld(true);
  });
  $("inspectButton").addEventListener("click", () => {
    const n = modelNumbers();
    const summaries = [
      "Route: each stage keeps its value classification; model values are not hardware measurements.",
      `Headroom model: largest stage demand ${format(Math.max(n.receiverOut, n.selectorOut, n.amplifierIn))} Vrms against a 1.000 Vrms model limit.`,
      state.prediction.revealed
        ? `Prediction revealed: ${correctPrediction() === "fits" ? "fits" : "clips"}; headroom ${format(n.headroom)} Vrms.`
        : "Prediction outcome remains sealed until committed.",
      `Loading model: ${state.model.zones} equal zones create ${format(n.parallelLoad, 0)} Ω and ${format(n.receiverIn)} Vrms loaded input.`,
      "Noise: compare stated gain allocations and conditions; a model is not a noise measurement.",
      `Optional bench badge: ${state.lab.status}. It does not control lesson or station availability.`,
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
    speed = Number(event.target.value);
    $("speedOutput").textContent = `${speed}×`;
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
  $("aboutButton").addEventListener("click", () =>
    $("aboutDialog").showModal(),
  );
  document.querySelectorAll("[data-lock]").forEach((station) => {
    if (station.id === "zoneStation") return;
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
  if (state.lab.status === "complete" && !instructionCurrent(state)) {
    state.lab.status = "evidence-stale";
    state.completed[5] = false;
    save();
  }
  cartFrom = targetFor(state.chapter);
  cartTo = { ...cartFrom };
  cartPosition = { ...cartFrom };
  updateResponsiveView();
  renderMotionControl();
  render();
  animate();
})();
