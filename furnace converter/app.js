/* Tube Furnace Profile Converter - static browser application */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FurnaceApp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_SEGMENTS = 16;
  const MAX_MINUTES = 99 * 60 + 59;
  const END_BEHAVIOR = {
    "0": "Stop the program and switch heater output off",
    "1": "Hold at the final target indefinitely",
    "2": "Repeat the program continuously",
    "3": "Revert to the local setpoint"
  };

  function fail(message) { throw new Error(message); }
  function number(value, message) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) fail(message);
    return parsed;
  }
  function temperatureText(value) { return Number(value.toFixed(2)).toString(); }
  function controllerTime(minutes) {
    if (minutes < 1 || minutes > MAX_MINUTES) fail("Each segment must be between 1 minute and 99 h 59 min.");
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  function humanTime(minutes) {
    const hours = Math.floor(minutes / 60), remainder = minutes % 60;
    return `${hours ? `${hours} h` : ""}${hours && remainder ? " " : ""}${remainder || !hours ? `${remainder} min` : ""}`;
  }

  function convertProfile(input) {
    const operator = String(input.operator_name || "").trim();
    const runDate = String(input.date || "").trim();
    if (!operator) fail("Enter the operator's name.");
    if (!runDate) fail("Enter the run date.");

    const start = number(input.start_temperature, "Starting temperature must be a number.");
    if (start < 0 || start > 1100) fail("Starting temperature must be between 0 and 1100°C.");
    if (!Array.isArray(input.stages) || !input.stages.length) fail("Add at least one profile stage.");
    if (input.stages.length > MAX_SEGMENTS) fail(`The UP150 supports at most ${MAX_SEGMENTS} timed segments.`);

    let current = start;
    const stages = input.stages.map((raw, position) => {
      const index = position + 1;
      const kind = String(raw.kind || "").toLowerCase();
      if (!["ramp", "hold", "cool"].includes(kind)) fail(`Stage ${index}: select a valid stage type.`);

      const target = kind === "hold" ? current : number(raw.target_temperature, `Stage ${index}: enter a target temperature.`);
      if (target < 0 || target > 1100) fail(`Stage ${index}: target must be between 0 and 1100°C.`);
      if (kind === "ramp" && target <= current) fail(`Stage ${index}: heating target must be above ${temperatureText(current)}°C.`);
      if (kind === "cool" && target >= current) fail(`Stage ${index}: cooling target must be below ${temperatureText(current)}°C.`);

      const durationValue = String(raw.duration_minutes || "").trim();
      const rateValue = String(raw.rate_c_per_min || "").trim();
      let duration;
      if (durationValue) duration = Math.round(number(durationValue, `Stage ${index}: duration must be a number.`));
      else if (kind !== "hold" && rateValue) {
        const rate = number(rateValue, `Stage ${index}: ramp rate must be a number.`);
        if (rate <= 0) fail(`Stage ${index}: ramp rate must be greater than zero.`);
        duration = Math.round(Math.abs(target - current) / rate);
      } else fail(`Stage ${index}: enter ${kind === "hold" ? "a duration" : "a duration or ramp rate"}.`);
      if (duration < 1 || duration > MAX_MINUTES) fail(`Stage ${index}: duration must be between 1 minute and 99 h 59 min.`);

      const previous = current;
      current = target;
      const rate = kind === "hold" ? null : Math.abs(target - previous) / duration;
      const verb = kind === "ramp" ? "Heat" : "Cool";
      const description = kind === "hold"
        ? `Hold at ${temperatureText(target)}°C for ${humanTime(duration)}`
        : `${verb} from ${temperatureText(previous)}°C to ${temperatureText(target)}°C in ${humanTime(duration)} (~${rate.toFixed(2)}°C/min)`;
      return { name: String(raw.name || `Stage ${index}`).trim(), kind, target, duration, note: String(raw.note || "").trim(), description };
    });

    const endCode = String(input.end_behavior ?? "0");
    if (!END_BEHAVIOR[endCode]) fail("Select a valid end behavior.");

    const parameters = [["SSP", temperatureText(start), "Starting setpoint"], ["StC", "1", "Start from measured furnace temperature"]];
    stages.forEach((stage, i) => parameters.push([`SP${i + 1}`, temperatureText(stage.target), stage.name], [`tM${i + 1}`, controllerTime(stage.duration), `Duration of ${stage.name}`]));
    if (stages.length < MAX_SEGMENTS) parameters.push([`SP${stages.length + 1}`, temperatureText(stages.at(-1).target), "Final target retained"], [`tM${stages.length + 1}`, "OFF", "Ends setpoint/time entry"]);

    const highest = Math.max(start, ...stages.map(stage => stage.target));
    parameters.push(["A1", temperatureText(highest + 10), "High alarm: 10°C above highest target"], ["JC", endCode, END_BEHAVIOR[endCode]]);

    const sum = kind => stages.filter(stage => stage.kind === kind).reduce((total, stage) => total + stage.duration, 0);
    const ramp = sum("ramp"), hold = sum("hold"), cooling = sum("cool"), total = ramp + hold + cooling;
    return {
      operator_name: operator, sample_name: String(input.sample_name || "").trim(), date: runDate,
      start_temperature: temperatureText(start), stages, parameters,
      unchanged: [["EV1", "0"], ["AL1", "9"], ["HY1", "1"], ["EV2", "0"], ["AL2", "OFF"], ["A2", "0"], ["HY2", "1"], ["WTZ", "OFF"]],
      totals: { ramp: humanTime(ramp), hold: humanTime(hold), cooling: humanTime(cooling), total: humanTime(total), days: (total / 1440).toFixed(2), minutes: total },
      end_behavior: END_BEHAVIOR[endCode]
    };
  }

  function annealingExample() {
    return [
      ["Heating 1", "ramp", 150, 63, "~2°C/min"], ["Annealing 1", "hold", "", 300, "In melting and wetting stage"],
      ["Heating 2", "ramp", 625, 238, "~2°C/min"], ["Annealing 2", "hold", "", 300, "In-Sb interaction and diffusion"],
      ["Heating 3", "ramp", 900, 138, "~2°C/min"], ["Annealing 3", "hold", "", 720, "Intermetallic formation and homogenization"],
      ["Cooling", "cool", 25, 480, "Controlled cooling"]
    ];
  }

  return { convertProfile, annealingExample, controllerTime, humanTime };
});

// Browser interface
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const fields = { operator: $("#operator"), sample: $("#sample"), date: $("#date"), start: $("#start"), end: $("#end") };
  const stages = $("#stages"), template = $("#stage-template"), result = $("#result"), error = $("#error");

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function today() { const now = new Date(); return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function renumber() { [...stages.children].forEach((stage, index) => stage.querySelector(".stage-number").textContent = `Stage ${index + 1}`); }
  function adapt(stage) {
    const kind = stage.querySelector(".kind").value;
    const hold = kind === "hold";

    stage.querySelector(".target-wrap").hidden = hold;
    stage.querySelector(".rate-wrap").hidden = hold;

    if (hold) {
      stage.querySelector(".target").value = "";
    }
  }
  function addStage(data = {}) {
    const stage = template.content.firstElementChild.cloneNode(true);
    ["name", "kind", "target", "duration", "rate", "note"].forEach(key => { if (data[key] !== undefined) stage.querySelector(`.${key}`).value = data[key]; });
    stage.querySelector(".kind").addEventListener("change", () => adapt(stage));
    stage.querySelector(".remove").addEventListener("click", () => { stage.remove(); renumber(); });
    stages.append(stage); adapt(stage); renumber();
  }
  function readInput() {
    return {
      operator_name: fields.operator.value, sample_name: fields.sample.value, date: fields.date.value,
      start_temperature: fields.start.value, end_behavior: fields.end.value,
      stages: [...stages.children].map(stage => ({
        name: stage.querySelector(".name").value, kind: stage.querySelector(".kind").value,
        target_temperature: stage.querySelector(".target").value, duration_minutes: stage.querySelector(".duration").value,
        rate_c_per_min: stage.querySelector(".rate").value, note: stage.querySelector(".note").value
      }))
    };
  }
  function render(data) {
    const profileRows = data.stages.map(stage => `<tr><td>${escapeHtml(stage.name)}</td><td>${escapeHtml(stage.description)}${stage.note ? `<small>${escapeHtml(stage.note)}</small>` : ""}</td></tr>`).join("");
    const programRows = data.parameters.map(([parameter, value, meaning], index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(parameter)}</b></td><td><b>${escapeHtml(value)}</b></td><td>${escapeHtml(meaning)}</td></tr>`).join("");
    result.innerHTML = `
      <div class="report-head"><div><span>UP150 PROGRAM REPORT</span><h2>Tube Furnace Heating Profile</h2></div><div class="report-mark">TF</div></div>
      <div class="meta"><div><span>Operator</span><b>${escapeHtml(data.operator_name)}</b></div><div><span>Sample / run</span><b>${escapeHtml(data.sample_name || "Not specified")}</b></div><div><span>Date</span><b>${escapeHtml(data.date)}</b></div><div><span>Starting temperature</span><b>${escapeHtml(data.start_temperature)}°C</b></div></div>
      <h3>Temperature profile</h3><div class="table-wrap"><table><thead><tr><th>Stage</th><th>Description</th></tr></thead><tbody>${profileRows}</tbody></table></div>
      <h3>Controller values - enter in this order</h3><div class="table-wrap"><table><thead><tr><th>No.</th><th>Parameter</th><th>Value</th><th>Meaning</th></tr></thead><tbody>${programRows}</tbody></table></div>
      <div class="notice"><b>Leave these parameters unchanged</b><p>${data.unchanged.map(([key, value]) => `${escapeHtml(key)} = ${escapeHtml(value)}`).join(", ")}.</p></div>
      <h3>Duration summary</h3><div class="totals"><div><span>Heating ramps</span><b>${data.totals.ramp}</b></div><div><span>Holding</span><b>${data.totals.hold}</b></div><div><span>Cooling</span><b>${data.totals.cooling}</b></div><div class="grand"><span>Total</span><b>${data.totals.total}</b><small>~${data.totals.days} days</small></div></div>
      <p class="end"><b>End behavior:</b> ${escapeHtml(data.end_behavior)}</p>
      <p class="warning"><b>Operator verification required.</b> Confirm all values against the applicable furnace manual, laboratory SOP and process limits before starting. Only trained, authorized personnel should operate the furnace.</p>
      <div class="report-actions"><button id="print" type="button">Print / Save report as PDF</button><button id="edit" class="secondary" type="button">Return to profile</button></div>`;
    result.hidden = false; $("#print").onclick = () => window.print(); $("#edit").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function convert() { error.textContent = ""; try { render(window.FurnaceApp.convertProfile(readInput())); } catch (problem) { result.hidden = true; error.textContent = problem.message; error.scrollIntoView({ behavior: "smooth" }); } }
  function loadExample() {
    stages.replaceChildren(); fields.operator.value = fields.operator.value || "Example Operator"; fields.sample.value = "NS5 & NS6 Annealing 1"; fields.start.value = "25"; fields.end.value = "0";
    window.FurnaceApp.annealingExample().forEach(([name, kind, target, duration, note]) => addStage({ name, kind, target, duration, note })); convert();
  }
  function clearProfile() { stages.replaceChildren(); fields.sample.value = ""; fields.start.value = "25"; fields.end.value = "0"; result.hidden = true; error.textContent = ""; addStage(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  fields.date.value = today(); $("#add").onclick = () => addStage(); $("#convert").onclick = convert; $("#example").onclick = loadExample; $("#clear").onclick = clearProfile; addStage();
});
