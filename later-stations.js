(() => {
  "use strict";

  const station = new URLSearchParams(location.search).get("station");
  if (['control', 'prototype', 'validation'].includes(station)) {
    runAdvancedStation(station);
    return;
  }
  if (!['zone', 'power'].includes(station)) return;

  const $ = (id) => document.getElementById(id);
  const MOTION_KEY = "audioPark.reducedMotion";
  const config = station === "zone"
    ? {
        key: "audioPark.zoneSwitchyard.v1",
        prerequisiteKey: "audioPark.gainLift.v1",
        title: "Zone Switchyard",
        lead: "Route control commands safely: prove state ownership before either zone can carry the cart.",
        stop: 4,
        route: "zone",
        next: "Power Gorge",
        chapters: ["Switchyard map", "Bus segments", "Safe order", "Observe & predict", "Retrieve & design", "Optional bench extension"],
      }
    : {
        key: "audioPark.powerGorge.v1",
        prerequisiteKey: "audioPark.zoneSwitchyard.v1",
        title: "Power Gorge",
        lead: "Treat 48 V distribution and return paths as measured external subsystems, not headline-watt promises.",
        stop: 5,
        route: "power",
        next: "Control Tower",
        chapters: ["Gorge map", "Power budget", "Return paths", "Observe & predict", "Retrieve & design", "Optional bench extension"],
      };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
  };
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const format = (value, decimals = 2) => Number(value).toFixed(decimals);
  const setFeedback = (element, message, correct) => {
    element.textContent = message;
    element.className = `feedback ${correct ? "correct" : "incorrect"}`;
  };
  const defaults = {
    chapter: 0,
    maxChapter: 0,
    completed: [false, false, false, false, false, false],
    model: station === "zone"
      ? { volume: -24, selectedSegment: "zone1" }
      : { branchB: 1.2, returnRoute: "shared" },
    prediction: { answer: "", reasoning: "", revealed: false },
    retrieval: { first: "", second: "" },
    design: { choice: "", reasoning: "" },
    lab: { status: "not-started", evidence: "", safety: false },
  };
  const load = () => {
    const saved = read(config.key);
    if (!saved) return clone(defaults);
    return {
      ...clone(defaults), ...saved,
      model: { ...defaults.model, ...saved.model },
      prediction: { ...defaults.prediction, ...saved.prediction },
      retrieval: { ...defaults.retrieval, ...saved.retrieval },
      design: { ...defaults.design, ...saved.design },
      lab: { ...defaults.lab, ...saved.lab },
      completed: defaults.completed.map((value, index) => Boolean(saved.completed?.[index] ?? value)),
    };
  };
  const gainCurrent = (candidate) => Boolean(
    candidate?.completed?.slice(1, 5).every(Boolean) && candidate.prediction?.revealed &&
    candidate.retrieval?.gain === "headroom" && candidate.retrieval?.loading === "parallel" && candidate.retrieval?.noise === "early",
  );
  const zoneCurrent = (candidate) => Boolean(
    candidate?.completed?.slice(1, 5).every(Boolean) && candidate.prediction?.revealed &&
    candidate.retrieval?.first === "segments" && candidate.retrieval?.second === "muteFirst" && candidate.design?.choice === "separate",
  );
  const prerequisiteCurrent = () => station === "zone" ? gainCurrent(read(config.prerequisiteKey)) : zoneCurrent(read(config.prerequisiteKey));
  if (!prerequisiteCurrent()) {
    location.href = location.pathname;
    return;
  }
  let state = load();
  let paused = false;
  let reducedMotion = localStorage.getItem(MOTION_KEY) === null
    ? matchMedia("(prefers-reduced-motion: reduce)").matches
    : localStorage.getItem(MOTION_KEY) === "true";
  let time = 0;
  let speed = 1;
  let worldScale = 1;
  let cartTravel = 1;
  const targets = station === "zone"
    ? [{ x: 944, y: 286 }, { x: 960, y: 264 }, { x: 974, y: 245 }, { x: 994, y: 230 }, { x: 1010, y: 242 }, { x: 1023, y: 260 }]
    : [{ x: 918, y: 553 }, { x: 930, y: 533 }, { x: 943, y: 512 }, { x: 955, y: 490 }, { x: 970, y: 478 }, { x: 986, y: 466 }];
  let cartFrom = { ...targets[0] };
  let cartTo = { ...targets[0] };
  let cartPosition = { ...targets[0] };

  document.title = `Audio Park — ${config.title}`;
  document.body.classList.add(`${config.route}-mode`);
  $("stopKicker").textContent = `STOP ${config.stop} OF 11`;
  $("stationTitle").textContent = config.title;
  $("stationLead").textContent = config.lead;
  $("guide").setAttribute("aria-label", `${config.title} lesson guide`);
  $("lessonNav").setAttribute("aria-label", `${config.title} lessons`);
  document.querySelector(".world-hud span:first-child b").textContent = `${config.stop} / 11`;
  ["dispatchRoute", "balancedRoute", "gainRoute"].forEach((id) => { $(id).className = "route-chip released"; $(id).disabled = false; });
  $("zoneRoute").className = `route-chip ${station === "zone" ? "current" : "released"}`;
  $("zoneRoute").disabled = false;
  $("powerRoute").className = `route-chip ${station === "power" ? "current" : "locked"}`;
  $("powerRoute").disabled = station !== "power";
  $("routeStatus").textContent = station === "zone" ? "four stations open" : "five stations open";
  ["dispatchStation", "balancedStation", "gainStation"].forEach((id) => {
    $(id).setAttribute("class", "station completed-station");
    $(id).removeAttribute("data-lock");
    $(id).setAttribute("aria-label", `Open ${$(id).querySelector("text").textContent.replace(/^\d+\.\s*/, "")}`);
  });
  $("zoneStation").setAttribute("class", station === "zone" ? "station active-balanced-station" : "station released-station");
  $("zoneStation").setAttribute("aria-label", "Open Zone Switchyard");
  $("zoneStation").removeAttribute("data-lock");
  $("powerStation").setAttribute("class", station === "power" ? "station active-balanced-station" : "station locked-station");
  $("powerStation").setAttribute("aria-label", station === "power" ? "Open Power Gorge" : "Power Gorge needs the Zone Switchyard instructional sequence");

  function save() { localStorage.setItem(config.key, JSON.stringify(state)); }
  function complete(index) {
    state.completed[index] = true;
    state.maxChapter = Math.max(state.maxChapter, Math.min(index + 1, config.chapters.length - 1));
    save(); renderNav(); renderFooter(); updateNextAccess();
  }
  function instructionCurrent() {
    return state.completed.slice(1, 5).every(Boolean) && state.prediction.revealed &&
      state.retrieval.first === (station === "zone" ? "segments" : "input") &&
      state.retrieval.second === (station === "zone" ? "muteFirst" : "conditional") &&
      state.design.choice === (station === "zone" ? "separate" : "measure");
  }
  function invalidate(index) {
    state.completed[index] = false;
    if (state.lab.status === "recorded") state.lab.status = "evidence-stale";
    save(); renderFooter(); updateNextAccess();
  }
  function updateNextAccess() {
    const ready = instructionCurrent();
    if (station === "zone") {
      $("powerRoute").disabled = !ready;
      $("powerRoute").className = `route-chip ${ready ? "released" : "locked"}`;
      $("powerStation").setAttribute("class", ready ? "station released-station" : "station locked-station");
      $("powerStation").setAttribute("aria-label", ready ? "Open Power Gorge" : "Power Gorge needs the Zone Switchyard instructional sequence");
      $("routeStatus").textContent = ready ? "five stations open" : "four stations open";
    }
  }
  function setTarget(index, replay = false) {
    cartFrom = replay ? { ...targets[Math.max(0, index - 1)] } : { ...cartPosition };
    cartTo = { ...targets[index] };
    cartTravel = reducedMotion ? 1 : 0;
  }
  function goTo(index) {
    if (index < 0 || index >= config.chapters.length || index > state.maxChapter) return;
    state.chapter = index; setTarget(index); save(); render();
    $("guide").scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }
  function renderNav() {
    $("lessonNav").replaceChildren(...config.chapters.map((name, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = `${index + 1} ${name}`; button.disabled = index > state.maxChapter;
      if (index === state.chapter) button.setAttribute("aria-current", "step");
      if (state.completed[index]) button.classList.add("complete");
      button.addEventListener("click", () => goTo(index)); return button;
    }));
    $("lessonCount").textContent = `${state.chapter + 1} / ${config.chapters.length}`;
    $("lessonDots").innerHTML = config.chapters.map((_, index) => `<i class="${index === state.chapter ? "active" : ""}"></i>`).join("");
  }
  function renderFooter() {
    $("previousLesson").disabled = state.chapter === 0;
    const next = $("nextLesson");
    next.disabled = state.chapter > 0 && state.chapter !== 5 && !state.completed[state.chapter];
    next.textContent = state.chapter === 0 ? `Enter ${config.title} →` : state.chapter === 5 ? (state.lab.status === "recorded" ? "Optional lab badge ✓" : "Optional bench extension") : "Continue →";
  }
  function zoneNumbers() {
    const ratio = 10 ** (state.model.volume / 20);
    return { ratio, output: 0.5 * ratio };
  }
  function powerNumbers() {
    const total = 1.2 + state.model.branchB + 0.2;
    return { total, margin: 5 - total, watts: 48 * total };
  }
  function modelNumbers() { return station === "zone" ? zoneNumbers() : powerNumbers(); }
  function correctPrediction() {
    return station === "zone"
      ? state.model.selectedSegment === "none" ? "muted" : "ready"
      : powerNumbers().margin >= 0 ? "within" : "over";
  }
  function renderTemplate() {
    const n = modelNumbers();
    if (state.chapter === 0) return station === "zone"
      ? `<div class="lesson-banner">A switchyard directs control commands, not audio packets. Each zone owns an explicit mute, source, and volume state.</div><h2>Read the two-zone route</h2><p>The signal cart reaches two selector modules through separate control segments. The teaching model does not claim a PT2314 breakout pinout, pull-up voltage, gain, or transition performance.</p><div class="comparison-grid"><article><h3>Desired state</h3><p>The selected source, volume, and mute state the controller intends.</p></article><article><h3>Effective state</h3><p>The state the selected module could apply after a command reaches its segment.</p></article><article><h3>Observed state</h3><p>A bounded measurement with the exact module, fixture, and conditions.</p></article></div><div class="safety-box"><b>Boundary:</b> no controller or multiplexer connection is authorised by this model. A breakout may pull I²C to an unsafe voltage; measure its pull-ups and references first.</div>`
      : `<div class="lesson-banner">Power Gorge models input budget and return paths. It never turns 48 V or a watt label into a safe branch, fuse, connector, or amplifier claim.</div><h2>Read the 48 V crossing</h2><p>The teaching cart crosses a model 48 V bridge. Supply and return topology are product- and measurement-specific.</p><div class="comparison-grid"><article><h3>Input budget</h3><p>48 V × current is supply input power, before conversion and amplifier losses.</p></article><article><h3>Return path</h3><p>Current needs a physical route back to its source; it is not a diagram symbol.</p></article><article><h3>Hum observation</h3><p>A controlled comparison records conditions, not a universal grounding rule.</p></article></div><div class="safety-box"><b>Boundary:</b> no speaker, unknown Class-D output, fuse choice, or 48 V branch is authorised by this model. Never defeat protective earth.</div>`;
    if (state.chapter === 1) return station === "zone"
      ? `<div class="lesson-banner">A fixed I²C address cannot identify two boards on one electrical segment. The switch selects a segment before commands travel.</div><h2>Define bus segments before commands</h2><p>An <b>I²C address</b> identifies a responding device on one active electrical bus. A <b>segment</b> is an electrically separate downstream bus. A TCA9548A is a switch: a channel must be selected before its downstream segment can respond.</p><div class="worked-example"><b>Worked route</b><p>Two model selector boards with the same fixed address cannot be told apart while connected to the same active segment. Select channel 0, send the command, then select channel 1 for the other board. This is a topology model; it does not prove the purchased boards are safe or acknowledge.</p></div><button id="acknowledgeLesson" class="action-button" type="button">Continue to the safe order</button><p id="lessonFeedback" class="feedback" aria-live="polite"></p>`
      : `<div class="lesson-banner">A supply budget is an input-side constraint, not a promise of amplifier output power.</div><h2>Define the power budget</h2><p><b>Voltage</b> is potential difference. <b>Current</b> is charge flow. <b>Input power</b> is voltage × current at the stated supply. <b>Margin</b> is the model supply limit minus the model branch currents.</p><div class="formula-card"><span class="formula">Pinput = Vsupply × Itotal</span><span class="formula">Imargin = Ilimit − Itotal</span><span class="formula-note">Losses, peaks, thermal/protection behaviour, and actual Fosi limits are outside this model.</span></div><div class="worked-example"><b>Worked model</b><p>48 V × 5 A = 240 W input capacity. It cannot be converted directly into two amplifier headline-output claims because supply, load, loss, thermal and protection conditions matter.</p></div><button id="acknowledgeLesson" class="action-button" type="button">Continue to return paths</button><p id="lessonFeedback" class="feedback" aria-live="polite"></p>`;
    if (state.chapter === 2) return station === "zone"
      ? `<div class="lesson-banner">A safe startup leaves the audio state muted until the selected control path is configured.</div><h2>Rule and scope: mute, configure, unmute</h2><p><b>Muted</b> means the commanded output is intentionally silenced. <b>Configure</b> means select a known segment and write the intended source/gain/volume state. <b>Unmute</b> comes only when that state is known in the model.</p><div class="worked-example"><b>Worked order</b><p>1. Start muted. 2. Select Zone 1’s segment. 3. Configure its source and conservative model volume. 4. Unmute. Reversing the last two steps can expose an unknown restored or transition state.</p></div><button id="acknowledgeLesson" class="action-button" type="button">Observe the command route</button><p id="lessonFeedback" class="feedback" aria-live="polite"></p>`
      : `<div class="lesson-banner">Return paths can share impedance and disturbance. A diagrammatic ground symbol does not prove a quiet or safe return arrangement.</div><h2>Rule and scope: controlled comparisons</h2><p>A <b>return path</b> is the physical route current uses back to its source. A <b>shared impedance</b> can turn one branch’s current into a voltage disturbance seen by another circuit. Which path matters depends on cable, chassis, shielding, supply, source, and frequency.</p><div class="worked-example"><b>Worked investigation order</b><p>Hold the documented input termination and stated source condition fixed. Compare one amp, then two amps on the model bridge, then only permitted shield/chassis arrangements. The result is a condition-specific observation, not a universal star-ground rule.</p></div><button id="acknowledgeLesson" class="action-button" type="button">Observe one branch</button><p id="lessonFeedback" class="feedback" aria-live="polite"></p>`;
    if (state.chapter === 3) return station === "zone"
      ? `<div class="lesson-banner">Change one model variable: selected segment. The output state remains hidden until your prediction is committed.</div><h2>Observe the command route</h2><div class="interactive-card"><div class="control-row"><label for="modelControl">Selected model segment</label><output id="modelOutput">${state.model.selectedSegment === "none" ? "no segment" : state.model.selectedSegment}</output><select id="modelControl"><option value="zone1" ${state.model.selectedSegment === "zone1" ? "selected" : ""}>Zone 1 segment</option><option value="zone2" ${state.model.selectedSegment === "zone2" ? "selected" : ""}>Zone 2 segment</option><option value="none" ${state.model.selectedSegment === "none" ? "selected" : ""}>No segment selected</option></select></div><div class="control-row"><label for="volumeControl">Zone 1 model volume</label><output id="volumeOutput">${state.model.volume} dB</output><input id="volumeControl" type="range" min="-60" max="0" step="1" value="${state.model.volume}" /></div><div class="metric-grid"><div class="metric"><small>Model voltage ratio</small><strong id="ratioOutput">${format(n.ratio, 3)}×</strong></div><div class="metric"><small>Model output</small><strong id="signalOutput">${format(n.output, 3)} Vrms</strong></div></div><div class="prediction-lock ${state.prediction.revealed ? "revealed" : ""}">${state.prediction.revealed ? `With ${state.model.selectedSegment === "none" ? "no selected segment, the safe model remains muted" : "a selected segment, configuration can reach the chosen model zone before unmute"}.` : "The command consequence is sealed until you commit a prediction."}</div><div class="answer-list"><label><input type="radio" name="prediction" value="muted" ${state.prediction.answer === "muted" ? "checked" : ""}/> No selected segment: remain muted</label><label><input type="radio" name="prediction" value="ready" ${state.prediction.answer === "ready" ? "checked" : ""}/> A selected segment can receive configuration</label></div><label class="standalone-field">Why?<textarea id="reasoning" rows="2" placeholder="Mention segment selection, mute, or configuration.">${safe(state.prediction.reasoning)}</textarea></label><button id="revealPrediction" class="action-button" type="button">Commit prediction and reveal</button><p id="predictionFeedback" class="feedback" aria-live="polite"></p></div>`
      : `<div class="lesson-banner">Change one model variable: the second amplifier branch current. The result stays a supply-input model until your prediction is committed.</div><h2>Observe one branch</h2><div class="interactive-card"><div class="control-row"><label for="branchControl">Second amplifier model current</label><output id="branchOutput">${format(state.model.branchB, 1)} A</output><input id="branchControl" type="range" min="0" max="5" step="0.1" value="${state.model.branchB}" /></div><div class="metric-grid"><div class="metric"><small>Total model current</small><strong id="totalOutput">${format(n.total, 1)} A</strong></div><div class="metric"><small>5 A model margin</small><strong id="marginOutput">${format(n.margin, 1)} A</strong></div><div class="metric"><small>48 V model input</small><strong id="wattsOutput">${format(n.watts, 0)} W</strong></div></div><div class="prediction-lock ${state.prediction.revealed ? "revealed" : ""}">${state.prediction.revealed ? `The model is ${n.margin >= 0 ? "within" : "over"} its 5 A input limit. This does not establish branch protection, wire, connector, amplifier, or thermal suitability.` : "The budget consequence is sealed until you commit a prediction."}</div><div class="answer-list"><label><input type="radio" name="prediction" value="within" ${state.prediction.answer === "within" ? "checked" : ""}/> The model stays within 5 A</label><label><input type="radio" name="prediction" value="over" ${state.prediction.answer === "over" ? "checked" : ""}/> The model exceeds 5 A</label></div><label class="standalone-field">Why?<textarea id="reasoning" rows="2" placeholder="Mention total current, limit, or input margin.">${safe(state.prediction.reasoning)}</textarea></label><button id="revealPrediction" class="action-button" type="button">Commit prediction and reveal</button><p id="predictionFeedback" class="feedback" aria-live="polite"></p></div>`;
    if (state.chapter === 4) return station === "zone"
      ? `<div class="lesson-banner">Retrieve the model before choosing the two-zone boundary.</div><h2>Retrieve, then choose the design boundary</h2><div class="check-card"><p>What prevents same-address boards responding together?</p><label><input type="radio" name="first" value="segments" ${state.retrieval.first === "segments" ? "checked" : ""}/> Separately selected electrical segments</label><label><input type="radio" name="first" value="labels"/> Labels on the boards</label><p>What is the safe starting order?</p><label><input type="radio" name="second" value="muteFirst" ${state.retrieval.second === "muteFirst" ? "checked" : ""}/> Mute, select, configure, then unmute</label><label><input type="radio" name="second" value="unmuteFirst"/> Unmute, then discover state</label><button id="checkRetrieval" class="action-button" type="button">Check retrieval</button><p>Which non-physical design decision keeps the boards distinguishable?</p><div class="answer-list"><label><input type="radio" name="designChoice" value="separate" ${state.design.choice === "separate" ? "checked" : ""}/> Give each board its own selected I²C segment</label><label><input type="radio" name="designChoice" value="shared" ${state.design.choice === "shared" ? "checked" : ""}/> Put both boards on one segment</label></div><label class="standalone-field">Teach it back<textarea id="designReasoning" rows="2">${safe(state.design.reasoning)}</textarea></label><button id="checkDesign" class="action-button" type="button">Check design decision</button><p id="designFeedback" class="feedback" aria-live="polite"></p></div>`
      : `<div class="lesson-banner">Retrieve the model before choosing the evidence boundary.</div><h2>Retrieve, then choose the evidence boundary</h2><div class="check-card"><p>What does 48 V × 5 A describe?</p><label><input type="radio" name="first" value="input" ${state.retrieval.first === "input" ? "checked" : ""}/> Nominal supply input capacity</label><label><input type="radio" name="first" value="output"/> Guaranteed amplifier output</label><p>What can a controlled hum comparison establish?</p><label><input type="radio" name="second" value="conditional" ${state.retrieval.second === "conditional" ? "checked" : ""}/> A result for its stated conditions</label><label><input type="radio" name="second" value="universal"/> A universal grounding rule</label><button id="checkRetrieval" class="action-button" type="button">Check retrieval</button><p>What is the next design decision before selecting final 48 V hardware?</p><div class="answer-list"><label><input type="radio" name="designChoice" value="measure" ${state.design.choice === "measure" ? "checked" : ""}/> Measure product-specific current, continuity, connector, cable, thermal, and hum conditions</label><label><input type="radio" name="designChoice" value="headline" ${state.design.choice === "headline" ? "checked" : ""}/> Copy headline watts into hardware choices</label></div><label class="standalone-field">Teach it back<textarea id="designReasoning" rows="2">${safe(state.design.reasoning)}</textarea></label><button id="checkDesign" class="action-button" type="button">Check design decision</button><p id="designFeedback" class="feedback" aria-live="polite"></p></div>`;
    return `<div class="lesson-banner">Optional bench extension: retain only current, supported evidence. It never controls lesson or station availability.</div><h2>Optional bench extension: ${station === "zone" ? "control-interface mapping" : "power and return-path planning"}</h2><div class="safety-box"><b>Hard boundary:</b> ${station === "zone" ? "do not connect a controller until the exact board pinout, supply, 0 V, and I²C pull-up voltage are supported. Keep external amplifiers and speakers disconnected." : "do not select fuses, connectors, wire, or speaker tests from this model. Keep unknown Class-D outputs unprobed with ordinary scope grounds and never defeat protective earth."}</div><div class="lab-card"><label class="wide">Current evidence reference<input id="labEvidence" value="${safe(state.lab.evidence)}" placeholder="Manual section, measured map, or notebook reference" /></label><label class="acceptance-check"><input id="labSafety" type="checkbox" ${state.lab.safety ? "checked" : ""}/><span>I have retained only supported evidence and will stop rather than infer a pinout, pull-up, return path, current limit, or output topology.</span></label><button id="saveLab" class="action-button" type="button">Validate optional evidence</button><p id="labFeedback" class="feedback" aria-live="polite"></p><div id="labCompletion"></div></div>`;
  }
  function bind() {
    if (state.chapter === 1 || state.chapter === 2) {
      $("acknowledgeLesson").addEventListener("click", () => {
        complete(state.chapter);
        setFeedback($("lessonFeedback"), "Concept recorded. Observe the model before retrieval.", true);
      });
      return;
    }
    if (state.chapter === 3) {
      const update = () => {
        if (station === "zone") {
          state.model.selectedSegment = $("modelControl").value; state.model.volume = Number($("volumeControl").value); const n = zoneNumbers();
          $("modelOutput").textContent = state.model.selectedSegment === "none" ? "no segment" : state.model.selectedSegment;
          $("volumeOutput").textContent = `${state.model.volume} dB`; $("ratioOutput").textContent = `${format(n.ratio, 3)}×`; $("signalOutput").textContent = `${format(n.output, 3)} Vrms`;
        } else { state.model.branchB = Number($("branchControl").value); const n = powerNumbers(); $("branchOutput").textContent = `${format(n.branchB ?? state.model.branchB, 1)} A`; $("totalOutput").textContent = `${format(n.total, 1)} A`; $("marginOutput").textContent = `${format(n.margin, 1)} A`; $("wattsOutput").textContent = `${format(n.watts, 0)} W`; }
        if (state.prediction.revealed) { state.prediction.revealed = false; invalidate(3); render(); return; }
        save(); updateWorld();
      };
      if (station === "zone") { $("modelControl").addEventListener("change", update); $("volumeControl").addEventListener("input", update); } else $("branchControl").addEventListener("input", update);
      document.querySelectorAll('input[name="prediction"]').forEach((input) => input.addEventListener("change", () => { state.prediction.answer = input.value; state.prediction.revealed = false; invalidate(3); }));
      $("reasoning").addEventListener("input", (event) => { state.prediction.reasoning = event.target.value; state.prediction.revealed = false; invalidate(3); });
      $("revealPrediction").addEventListener("click", () => { if (!state.prediction.answer || state.prediction.reasoning.trim().length < 8) return setFeedback($("predictionFeedback"), "Choose an outcome and give a short causal reason before revealing.", false); state.prediction.revealed = true; const correct = state.prediction.answer === correctPrediction(); setFeedback($("predictionFeedback"), correct ? "Prediction recorded. Inspect the visible model boundary." : "Prediction recorded. The model outcome is shown; compare it with the selected state.", correct); complete(3); render(); });
      return;
    }
    if (state.chapter === 4) {
      $("checkRetrieval").addEventListener("click", () => {
        const first = document.querySelector('input[name="first"]:checked')?.value;
        const second = document.querySelector('input[name="second"]:checked')?.value;
        state.retrieval.first = first || "";
        state.retrieval.second = second || "";
        const correct = first === (station === "zone" ? "segments" : "input") && second === (station === "zone" ? "muteFirst" : "conditional");
        save();
        setFeedback($("designFeedback"), correct ? "Retrieval is correct. Make and explain the design decision." : "Recheck both model relationships before the design decision.", correct);
      });
      document.querySelectorAll('input[name="first"], input[name="second"], input[name="designChoice"]').forEach((input) => input.addEventListener("change", () => { state.retrieval.first = document.querySelector('input[name="first"]:checked')?.value || ""; state.retrieval.second = document.querySelector('input[name="second"]:checked')?.value || ""; invalidate(4); }));
      document.querySelectorAll('input[name="designChoice"]').forEach((input) => input.addEventListener("change", () => { state.design.choice = input.value; save(); }));
      $("designReasoning").addEventListener("input", (event) => { state.design.reasoning = event.target.value; invalidate(4); });
      $("checkDesign").addEventListener("click", () => { const correctValue = station === "zone" ? "separate" : "measure"; const retrievalCurrent = state.retrieval.first === (station === "zone" ? "segments" : "input") && state.retrieval.second === (station === "zone" ? "muteFirst" : "conditional"); const correct = retrievalCurrent && state.design.choice === correctValue && state.design.reasoning.trim().length >= 12; setFeedback($("designFeedback"), correct ? "Correct. This instructional decision opens the next station; no bench record is required." : "Check retrieval, choose the evidence-bounded decision, and give a causal reason.", correct); if (correct) complete(4); });
      return;
    }
    if (state.chapter === 5) {
      $("saveLab").addEventListener("click", () => { state.lab.evidence = $("labEvidence").value.trim(); state.lab.safety = $("labSafety").checked; if (!state.lab.safety || state.lab.evidence.length < 8 || /\b(?:tbd|unknown|unverified|assum(?:e|ed|ption))\b/i.test(state.lab.evidence)) { state.lab.status = "needs-investigation"; save(); $("labCompletion").innerHTML = '<div class="blocked-box"><b>Optional evidence retained for investigation:</b> unsupported or incomplete text cannot earn the badge. Course availability is unchanged.</div>'; return setFeedback($("labFeedback"), "Record a current supported reference and the explicit safety acknowledgement.", false); } state.lab.status = "recorded"; save(); $("labCompletion").innerHTML = '<div class="completion-card"><h3>Optional bench badge recorded</h3><p>The retained evidence can inform later measured-versus-model comparison. It does not control station availability.</p></div>'; setFeedback($("labFeedback"), "Optional evidence recorded. Editing it invalidates only this badge.", true); });
    }
  }
  function render() { renderNav(); renderFooter(); $("lessonContent").innerHTML = renderTemplate(); bind(); updateWorld(true); }
  function updateWorld(force = false) {
    const eased = 1 - (1 - cartTravel) ** 3;
    cartPosition = { x: cartFrom.x + (cartTo.x - cartFrom.x) * eased, y: cartFrom.y + (cartTo.y - cartFrom.y) * eased };
    $("signalCart").setAttribute("transform", `translate(${cartPosition.x.toFixed(1)} ${cartPosition.y.toFixed(1)})`);
    const n = modelNumbers();
    const risk = station === "zone" ? state.model.selectedSegment === "none" : powerNumbers().margin < 0;
    $("cartCargo").textContent = station === "zone" ? (risk ? "muted control state" : "selected zone state") : `${format(n.total, 1)} A model input`;
    $("worldNarration").textContent = station === "zone" ? (risk ? "The selected segment is absent, so the model keeps the cart muted." : "The selected control segment carries a configuration command before the model unmute.") : (risk ? "The model bridge exceeds its stated input-current limit; this is not a branch-hardware decision." : "The model bridge remains within its stated input-current limit; measurement is still required.");
    const wave = $("cartWave"); let path = ""; const amplitude = risk ? 4 : 10;
    for (let x = -23; x <= 23; x += 2) path += `${x === -23 ? "M" : "L"}${x},${(-7 - Math.sin((x + 23) * 0.28 + time) * amplitude).toFixed(1)} `;
    wave.setAttribute("d", path); updateCamera(); if (force && !reducedMotion) $("signalCart").getBoundingClientRect();
  }
  function updateCamera() { const park = $("park"); const follow = $("followToggle")?.checked; park.style.transformOrigin = follow ? `${(cartPosition.x / 1200) * 100}% ${(cartPosition.y / 760) * 100}%` : "50% 50%"; park.style.transform = `scale(${worldScale})`; }
  function animate() { if (!paused && !reducedMotion) { time += 0.035 * speed; cartTravel = Math.min(1, cartTravel + 0.012 * speed); } updateWorld(); requestAnimationFrame(animate); }
  function open(url) { location.search = url; }
  $("previousLesson").addEventListener("click", () => goTo(state.chapter - 1));
  $("nextLesson").addEventListener("click", () => { if (state.chapter === 0) { complete(0); goTo(1); } else if (state.completed[state.chapter] && state.chapter < 5) goTo(state.chapter + 1); });
  const routes = [["dispatchRoute", "dispatchStation", ""], ["balancedRoute", "balancedStation", "?station=balanced"], ["gainRoute", "gainStation", "?station=gain"], ["zoneRoute", "zoneStation", "?station=zone"], ["powerRoute", "powerStation", "?station=power"]];
  routes.forEach(([route, building, url]) => { const action = () => { if (url === "?station=power" && station === "zone" && !instructionCurrent()) { $("worldNarration").textContent = "Power Gorge needs the Zone Switchyard simulation, committed prediction, retrieval, and design decision. Optional bench evidence is not required."; return; } if (url) open(url); else location.href = location.pathname; }; $(route)?.addEventListener("click", action); $(building)?.addEventListener("click", action); $(building)?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); } }); });
  $("pauseButton").addEventListener("click", () => { paused = !paused; $("pauseButton").setAttribute("aria-pressed", String(paused)); $("pauseButton").querySelector("span").textContent = paused ? "▶" : "Ⅱ"; $("pauseButton").querySelector(".control-label").textContent = paused ? "Play" : "Pause"; });
  $("stepButton").addEventListener("click", () => { paused = true; time += 0.45; cartTravel = Math.min(1, cartTravel + 0.18); updateWorld(); });
  $("replayButton").addEventListener("click", () => { time = 0; paused = false; setTarget(state.chapter, true); updateWorld(true); });
  $("inspectButton").addEventListener("click", () => { const n = modelNumbers(); $("worldNarration").textContent = station === "zone" ? `Model segment: ${state.model.selectedSegment}; Zone 1 model voltage: ${format(n.output, 3)} Vrms. Purchased board state remains unmeasured.` : `Model total: ${format(n.total, 1)} A; input margin: ${format(n.margin, 1)} A. Hardware limits remain unmeasured.`; });
  $("motionButton").addEventListener("click", () => { reducedMotion = !reducedMotion; localStorage.setItem(MOTION_KEY, String(reducedMotion)); if (reducedMotion) cartTravel = 1; $("motionButton").setAttribute("aria-pressed", String(reducedMotion)); $("motionButton").setAttribute("aria-label", reducedMotion ? "Disable reduced motion" : "Enable reduced motion"); $("motionButton").classList.toggle("active", reducedMotion); updateWorld(true); });
  $("speedControl").addEventListener("input", (event) => { speed = Number(event.target.value); $("speedOutput").textContent = `${speed}×`; });
  $("signToggle").addEventListener("change", (event) => $("world").classList.toggle("no-signs", !event.target.checked));
  $("followToggle").addEventListener("change", updateCamera); $("zoomIn").addEventListener("click", () => { worldScale = Math.min(1.5, worldScale + 0.1); updateCamera(); }); $("zoomOut").addEventListener("click", () => { worldScale = Math.max(0.75, worldScale - 0.1); updateCamera(); }); $("fitWorld").addEventListener("click", () => { worldScale = 1; updateCamera(); });
  $("guideToggle").addEventListener("click", () => { const hidden = document.body.classList.toggle("guide-hidden"); $("guideToggle").textContent = hidden ? "Show guide" : "Hide guide"; $("guideToggle").setAttribute("aria-expanded", String(!hidden)); }); $("aboutButton").addEventListener("click", () => $("aboutDialog").showModal());
  addEventListener("resize", () => { if (matchMedia("(max-width: 640px)").matches && worldScale !== 1) { worldScale = 1; updateCamera(); } });
  cartFrom = { ...targets[state.chapter] }; cartTo = { ...cartFrom }; cartPosition = { ...cartFrom };
  $("motionButton").setAttribute("aria-pressed", String(reducedMotion)); $("motionButton").setAttribute("aria-label", reducedMotion ? "Disable reduced motion" : "Enable reduced motion"); $("motionButton").classList.toggle("active", reducedMotion);
  updateNextAccess(); render(); animate();

  function runAdvancedStation(kind) {
    const $ = (id) => document.getElementById(id);
    const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const profile = {
      control: { key: "audioPark.controlTower.v1", prerequisite: "audioPark.powerGorge.v1", stop: 6, title: "Control Tower", lead: "Keep local authority usable when remote control is unavailable or wrong.", chapters: ["Authority map", "State contract", "Failure rule", "Observe & predict", "Retrieve & decide", "Optional bench extension"], first: "local", second: "recover", design: "authoritative", target: { x: 640, y: 573 }, next: "Prototype Workshop" },
      prototype: { key: "audioPark.prototypeWorkshop.v1", prerequisite: "audioPark.controlTower.v1", stop: 7, title: "Prototype Workshop", lead: "Turn a bounded requirement into a model decision without selecting an unproven circuit.", chapters: ["Workbench map", "Requirement boundary", "Model scope", "Observe & predict", "Retrieve & decide", "Optional bench extension"], first: "requirement", second: "connectorise", design: "boundary", target: { x: 232, y: 578 }, next: "Validation Observatory" },
      validation: { key: "audioPark.validationObservatory.v1", prerequisite: "audioPark.prototypeWorkshop.v1", stop: 8, title: "Validation Observatory", lead: "Choose the first adequate check and preserve its assumptions and blind spots.", chapters: ["Lens map", "Validation tiers", "Scope rule", "Observe & predict", "Retrieve & decide", "Optional bench extension"], first: "tiered", second: "limits", design: "matrix", target: { x: 1064, y: 134 }, next: "Interference Canyon" },
    }[kind];
    const powerCurrent = (value) => Boolean(value?.completed?.slice(1, 5).every(Boolean) && value.prediction?.revealed && value.retrieval?.first === "input" && value.retrieval?.second === "conditional" && value.design?.choice === "measure");
    const controlCurrent = (value) => Boolean(value?.completed?.slice(1, 5).every(Boolean) && value.prediction?.revealed && value.retrieval?.first === "local" && value.retrieval?.second === "recover" && value.design?.choice === "authoritative");
    const prototypeCurrent = (value) => Boolean(value?.completed?.slice(1, 5).every(Boolean) && value.prediction?.revealed && value.retrieval?.first === "requirement" && value.retrieval?.second === "connectorise" && value.design?.choice === "boundary");
    const defaults = { chapter: 0, maxChapter: 0, completed: [false, false, false, false, false, false], model: { value: kind === "control" ? "offline" : kind === "prototype" ? "unknown" : "geometry" }, prediction: { answer: "", reasoning: "", revealed: false }, retrieval: { first: "", second: "" }, design: { choice: "", reasoning: "" }, lab: { status: "not-started", evidence: "", safety: false } };
    let state = (() => { const saved = read(profile.key); return saved ? { ...clone(defaults), ...saved, model: { ...defaults.model, ...saved.model }, prediction: { ...defaults.prediction, ...saved.prediction }, retrieval: { ...defaults.retrieval, ...saved.retrieval }, design: { ...defaults.design, ...saved.design }, lab: { ...defaults.lab, ...saved.lab }, completed: defaults.completed.map((v, i) => Boolean(saved.completed?.[i] ?? v)) } : clone(defaults); })();
    let paused = false; let reduced = localStorage.getItem("audioPark.reducedMotion") === "true"; let time = 0; let scale = 1;
    const save = () => localStorage.setItem(profile.key, JSON.stringify(state));
    const current = () => state.completed.slice(1, 5).every(Boolean) && state.prediction.revealed && state.retrieval.first === profile.first && state.retrieval.second === profile.second && state.design.choice === profile.design;
    const complete = (index) => { state.completed[index] = true; state.maxChapter = Math.max(state.maxChapter, Math.min(index + 1, 5)); save(); renderNav(); renderFooter(); updateRoutes(); };
    const invalidate = (index) => { state.completed[index] = false; if (state.lab.status === "recorded") state.lab.status = "evidence-stale"; save(); renderFooter(); updateRoutes(); };
    const correctPrediction = () => kind === "control" ? (state.model.value === "offline" ? "local" : "remote") : kind === "prototype" ? (state.model.value === "unknown" ? "external" : "model") : (state.model.value === "geometry" ? "review" : "simulate");
    const label = (value) => ({ offline: "remote unavailable", online: "remote available", unknown: "unknown module boundary", supported: "supported model boundary", geometry: "routing/clearance risk", circuit: "circuit behaviour risk" })[value];
    document.title = `Audio Park — ${profile.title}`; document.body.classList.add(`${kind}-mode`); $("stopKicker").textContent = `STOP ${profile.stop} OF 11`; $("stationTitle").textContent = profile.title; $("stationLead").textContent = profile.lead; $("guide").setAttribute("aria-label", `${profile.title} lesson guide`); $("lessonNav").setAttribute("aria-label", `${profile.title} lessons`); document.querySelector(".world-hud span:first-child b").textContent = `${profile.stop} / 11`;
    const all = [["dispatch", "dispatchRoute", "dispatchStation", ""], ["balanced", "balancedRoute", "balancedStation", "?station=balanced"], ["gain", "gainRoute", "gainStation", "?station=gain"], ["zone", "zoneRoute", "zoneStation", "?station=zone"], ["power", "powerRoute", "powerStation", "?station=power"], ["control", "controlRoute", "controlStation", "?station=control"], ["prototype", "prototypeRoute", "prototypeStation", "?station=prototype"], ["validation", "validationRoute", "validationStation", "?station=validation"]];
    function setAccess(route, building, ready, active, title) { $(route).disabled = !ready; $(route).className = `route-chip ${active ? "current" : ready ? "released" : "locked"}`; $(building).setAttribute("class", building === "dispatchStation" ? "station active-station" : active ? "station active-balanced-station" : ready ? "station released-station" : "station locked-station"); $(building).setAttribute("aria-label", ready ? `Open ${title}` : `${title} needs the preceding instructional sequence`); if (ready) $(building).removeAttribute("data-lock"); }
    function updateRoutes() { all.forEach(([, route, building, url], index) => { const ready = index <= 7; setAccess(route, building, ready, url === `?station=${kind}`, $(building).querySelector("text").textContent.replace(/^\d+\.\s*/, "")); }); $("routeStatus").textContent = "8 stations open"; }
    function renderNav() { $("lessonNav").replaceChildren(...profile.chapters.map((name, i) => { const b = document.createElement("button"); b.type = "button"; b.textContent = `${i + 1} ${name}`; b.disabled = i > state.maxChapter; if (i === state.chapter) b.setAttribute("aria-current", "step"); if (state.completed[i]) b.classList.add("complete"); b.addEventListener("click", () => go(i)); return b; })); $("lessonCount").textContent = `${state.chapter + 1} / 6`; $("lessonDots").innerHTML = profile.chapters.map((_, i) => `<i class="${i === state.chapter ? "active" : ""}"></i>`).join(""); }
    function renderFooter() { $("previousLesson").disabled = state.chapter === 0; $("nextLesson").disabled = state.chapter > 0 && state.chapter < 5 && !state.completed[state.chapter]; $("nextLesson").textContent = state.chapter === 0 ? `Enter ${profile.title} →` : state.chapter === 5 ? "Optional bench extension" : "Continue →"; }
    function template() { const common = kind === "control" ? { why: "A remote command is an input to the control system, not the authority that makes audio safe or usable.", terms: "Desired state is what a command requests. Effective state is the locally applied mute, source, and volume state. Acknowledgement is a topology-specific report, not proof of audio behaviour.", rule: "Local controls remain authoritative. On startup, reset, or remote loss, the model keeps a known muted/configured state until a local action or documented restore rule applies.", worked: "Model: remote becomes unavailable while Zone 1 is audible. The local controller retains the last known safe state; it does not wait for a network round trip.", firstQ: "Which authority keeps the system usable when remote control is unavailable?", firstGood: "Local control state", firstBad: "The unavailable network", secondQ: "What must recovery describe?", secondGood: "A documented safe restore rule", secondBad: "An assumed module default", designQ: "Which design decision preserves local authority?", designGood: "Keep remote commands as requests to a local state owner", designBad: "Let wireless control directly own analog settings", designText: "authority" } : kind === "prototype" ? { why: "A custom block exists to satisfy a bounded requirement, not to make an unknown breakout look integrated.", terms: "A requirement names source, load, gain, headroom, response, DC, control, and measurement conditions. A model predicts only its selected parts and assumptions.", rule: "Unknown pinouts, limits, and topology remain connectorised. A model parameter is labelled model, datasheet, assumed, or measured before it can inform a design decision.", worked: "Model: an input boundary is unknown. Rather than select an op amp or PCB circuit, keep the module connectorised and write the missing source/load and DC evidence.", firstQ: "What starts a custom-block decision?", firstGood: "A bounded requirement", firstBad: "A module label", secondQ: "What happens to an unknown module boundary?", secondGood: "It stays connectorised", secondBad: "It is copied into PCB copper", designQ: "Which decision preserves the evidence boundary?", designGood: "Keep the uncertain function external until evidence supports it", designBad: "Select a circuit from an assumed topology", designText: "boundary" } : { why: "A validation result is useful only when the check is adequate for the failure mode and its blind spots remain visible.", terms: "A requirement states a target and conditions. A validation tier is the first adequate check. A blind spot is a risk that the selected check cannot answer.", rule: "Use deterministic connectivity/geometry checks first, then circuit models, targeted parasitics, release review, and bench correlation only when their inputs and risk justify them.", worked: "Model: a routing/clearance risk begins with board rules and review. A passing DRC cannot prove thermal behaviour, model correctness, or audio noise.", firstQ: "How should validation start?", firstGood: "With the first adequate tier", firstBad: "With the most complex solver", secondQ: "What must every result retain?", secondGood: "Its assumptions and limits", secondBad: "A claim that the product is proven", designQ: "Which decision makes validation traceable?", designGood: "Use a matrix linking requirement, check, limitation, and later correlation", designBad: "Treat a passing DRC as a release decision", designText: "matrix" };
      if (state.chapter === 0) return `<div class="lesson-banner">${common.why}</div><h2>Read the ${profile.title} map</h2><p>${common.terms}</p><div class="comparison-grid"><article><h3>Model</h3><p>A teaching state with visible limits.</p></article><article><h3>Datasheet</h3><p>An exact documented input with conditions.</p></article><article><h3>Assumed</h3><p>An unverified placeholder. It cannot justify a topology, PCB capture, or hardware claim.</p></article><article><h3>Measured</h3><p>An observation with setup and limitations.</p></article></div><div class="safety-box"><b>Boundary:</b> ${kind === "control" ? "wireless hardware, endpoint behaviour, and reset defaults are not assumed." : kind === "prototype" ? "no custom circuit, topology, pinout, or performance is selected by this station." : "KiCad version, fabricator rules, models, limits, and thermal inputs remain explicit project inputs."}</div>`;
      if (state.chapter === 1) return `<div class="lesson-banner">${common.terms}</div><h2>Define the decision objects</h2><div class="worked-example"><b>Worked example</b><p>${common.worked}</p></div><button id="acknowledge" class="action-button" type="button">Continue to the rule</button><p id="feedback" class="feedback" aria-live="polite"></p>`;
      if (state.chapter === 2) return `<div class="lesson-banner">${common.rule}</div><h2>Rule and scope</h2><p>The rule is a project model. It must be checked against exact hardware, documentation, and future evidence before a physical decision.</p><button id="acknowledge" class="action-button" type="button">Observe one model variable</button><p id="feedback" class="feedback" aria-live="polite"></p>`;
      if (state.chapter === 3) return `<div class="lesson-banner">Change one model boundary. The consequence stays sealed until the prediction is committed.</div><h2>Observe the ${profile.title} consequence</h2><div class="interactive-card"><label for="modelControl">Model condition</label><select id="modelControl"><option value="${kind === "control" ? "offline" : kind === "prototype" ? "unknown" : "geometry"}">${label(kind === "control" ? "offline" : kind === "prototype" ? "unknown" : "geometry")}</option><option value="${kind === "control" ? "online" : kind === "prototype" ? "supported" : "circuit"}">${label(kind === "control" ? "online" : kind === "prototype" ? "supported" : "circuit")}</option></select><div class="prediction-lock ${state.prediction.revealed ? "revealed" : ""}">${state.prediction.revealed ? `Model consequence: ${correctPrediction()}. This is not a hardware result.` : "Commit a prediction to reveal the model consequence."}</div><div class="answer-list"><label><input type="radio" name="prediction" value="${kind === "control" ? "local" : kind === "prototype" ? "external" : "review"}" ${state.prediction.answer === (kind === "control" ? "local" : kind === "prototype" ? "external" : "review") ? "checked" : ""}/> ${kind === "control" ? "Local state remains safe" : kind === "prototype" ? "Keep the boundary external" : "Start with rule/review evidence"}</label><label><input type="radio" name="prediction" value="${kind === "control" ? "remote" : kind === "prototype" ? "model" : "simulate"}"/> ${kind === "control" ? "Remote remains authoritative" : kind === "prototype" ? "The model selects a circuit" : "A circuit simulation alone decides it"}</label></div><label class="standalone-field">Why?<textarea id="reasoning" rows="2">${safe(state.prediction.reasoning)}</textarea></label><button id="reveal" class="action-button" type="button">Commit prediction and reveal</button><p id="feedback" class="feedback" aria-live="polite"></p></div>`;
      if (state.chapter === 4) return `<div class="lesson-banner">Retrieve the model, then make the non-physical decision.</div><h2>Retrieve and decide</h2><div class="check-card"><p>${common.firstQ}</p><label><input type="radio" name="first" value="${profile.first}" ${state.retrieval.first === profile.first ? "checked" : ""}/> ${common.firstGood}</label><label><input type="radio" name="first" value="wrong"/> ${common.firstBad}</label><p>${common.secondQ}</p><label><input type="radio" name="second" value="${profile.second}" ${state.retrieval.second === profile.second ? "checked" : ""}/> ${common.secondGood}</label><label><input type="radio" name="second" value="wrong"/> ${common.secondBad}</label><button id="checkRetrieval" class="action-button" type="button">Check retrieval</button><p>${common.designQ}</p><label><input type="radio" name="design" value="${profile.design}" ${state.design.choice === profile.design ? "checked" : ""}/> ${common.designGood}</label><label><input type="radio" name="design" value="wrong"/> ${common.designBad}</label><label class="standalone-field">Teach it back<textarea id="designReason" rows="2">${safe(state.design.reasoning)}</textarea></label><button id="checkDesign" class="action-button" type="button">Check design decision</button><p id="feedback" class="feedback" aria-live="polite"></p></div>`;
      return `<div class="lesson-banner">Optional bench extension: evidence can add a badge but never controls course access.</div><h2>Optional bench extension</h2><div class="safety-box"><b>Hard boundary:</b> ${kind === "control" ? "retain an exact topology/state-contract reference; do not infer wireless endpoint, reset, or audio behaviour." : kind === "prototype" ? "retain only a bounded requirement and safe fixture plan; do not build from an unknown topology." : "retain current tool, model, fabricator, and target inputs; do not call an unrun or unpinned check a release result."}</div><label class="wide">Current evidence reference<input id="labEvidence" value="${safe(state.lab.evidence)}" /></label><label class="acceptance-check"><input id="labSafety" type="checkbox" ${state.lab.safety ? "checked" : ""}/><span>I have retained supported current inputs and will stop rather than infer missing hardware, topology, limits, models, or results.</span></label><button id="saveLab" class="action-button" type="button">Validate optional evidence</button><p id="feedback" class="feedback" aria-live="polite"></p>`;
    }
    function bind() { if (state.chapter === 1 || state.chapter === 2) { $("acknowledge").addEventListener("click", () => { complete(state.chapter); $("feedback").textContent = "Concept recorded. Continue through the model."; }); return; } if (state.chapter === 3) { $("modelControl").value = state.model.value; $("modelControl").addEventListener("change", (e) => { state.model.value = e.target.value; state.prediction.revealed = false; invalidate(3); render(); }); document.querySelectorAll('input[name="prediction"]').forEach((input) => input.addEventListener("change", () => { state.prediction.answer = input.value; state.prediction.revealed = false; invalidate(3); })); $("reasoning").addEventListener("input", (e) => { state.prediction.reasoning = e.target.value; state.prediction.revealed = false; invalidate(3); }); $("reveal").addEventListener("click", () => { if (!state.prediction.answer || state.prediction.reasoning.trim().length < 8) { $("feedback").textContent = "Choose an outcome and explain its cause before revealing."; return; } state.prediction.revealed = true; complete(3); render(); }); return; } if (state.chapter === 4) { document.querySelectorAll('input[name="first"],input[name="second"],input[name="design"]').forEach((input) => input.addEventListener("change", () => { state.retrieval.first = document.querySelector('input[name="first"]:checked')?.value || ""; state.retrieval.second = document.querySelector('input[name="second"]:checked')?.value || ""; state.design.choice = document.querySelector('input[name="design"]:checked')?.value || ""; invalidate(4); })); $("designReason").addEventListener("input", (e) => { state.design.reasoning = e.target.value; invalidate(4); }); $("checkRetrieval").addEventListener("click", () => { $("feedback").textContent = state.retrieval.first === profile.first && state.retrieval.second === profile.second ? "Retrieval is correct. Make the design decision." : "Recheck both relationships."; }); $("checkDesign").addEventListener("click", () => { const correct = state.retrieval.first === profile.first && state.retrieval.second === profile.second && state.design.choice === profile.design && state.design.reasoning.trim().length >= 12; if (correct) { complete(4); $("feedback").textContent = "Instructional decision recorded; optional evidence is not required."; } else $("feedback").textContent = "Use the correct retrieval and decision with a causal explanation."; }); return; } if (state.chapter === 5) $("saveLab").addEventListener("click", () => { state.lab.evidence = $("labEvidence").value.trim(); state.lab.safety = $("labSafety").checked; state.lab.status = state.lab.safety && state.lab.evidence.length >= 8 && !/\b(?:tbd|unknown|unverified|assum(?:e|ed|ption))\b/i.test(state.lab.evidence) ? "recorded" : "needs-investigation"; save(); $("feedback").textContent = state.lab.status === "recorded" ? "Optional badge recorded. Course access is unchanged." : "Evidence retained for investigation; course access is unchanged."; }); }
    function go(index) { if (index < 0 || index > state.maxChapter || index > 5) return; state.chapter = index; save(); render(); $("guide").scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }
    function render() { renderNav(); renderFooter(); $("lessonContent").innerHTML = template(); bind(); updateWorld(); }
    function updateWorld() { const cart = $("signalCart"); cart.setAttribute("transform", `translate(${profile.target.x} ${profile.target.y})`); $("cartCargo").textContent = `${profile.title} model`; $("worldNarration").textContent = state.prediction.revealed ? `${profile.title}: ${correctPrediction()} is the visible model consequence.` : `${profile.title}: ${label(state.model.value)} remains a model condition.`; }
    $("previousLesson").addEventListener("click", () => go(state.chapter - 1)); $("nextLesson").addEventListener("click", () => { if (state.chapter === 0) { complete(0); go(1); } else if (state.completed[state.chapter] && state.chapter < 5) go(state.chapter + 1); });
    all.forEach(([, route, building, url]) => { const open = () => { if (!url) location.href = location.pathname; else location.search = url; }; $(route).addEventListener("click", open); $(building).addEventListener("click", open); $(building).addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }); });
    $("pauseButton").addEventListener("click", () => { paused = !paused; $("pauseButton").setAttribute("aria-pressed", String(paused)); $("pauseButton").querySelector(".control-label").textContent = paused ? "Play" : "Pause"; }); $("stepButton").addEventListener("click", () => { paused = true; time += 1; updateWorld(); }); $("replayButton").addEventListener("click", () => { time = 0; paused = false; updateWorld(); }); $("inspectButton").addEventListener("click", updateWorld); $("motionButton").addEventListener("click", () => { reduced = !reduced; localStorage.setItem("audioPark.reducedMotion", String(reduced)); $("motionButton").setAttribute("aria-pressed", String(reduced)); }); $("signToggle").addEventListener("change", (e) => $("world").classList.toggle("no-signs", !e.target.checked)); $("zoomIn").addEventListener("click", () => { scale = Math.min(1.5, scale + .1); $("park").style.transform = `scale(${scale})`; }); $("zoomOut").addEventListener("click", () => { scale = Math.max(.75, scale - .1); $("park").style.transform = `scale(${scale})`; }); $("fitWorld").addEventListener("click", () => { scale = 1; $("park").style.transform = "scale(1)"; }); $("guideToggle").addEventListener("click", () => document.body.classList.toggle("guide-hidden")); $("aboutButton").addEventListener("click", () => $("aboutDialog").showModal());
    $("motionButton").setAttribute("aria-pressed", String(reduced)); updateRoutes(); render();
  }
})();
