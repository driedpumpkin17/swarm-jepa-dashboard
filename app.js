"use strict";

const $ = (selector) => document.querySelector(selector);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
};
const pct = (value, digits = 1) => value == null ? "—" : `${(Number(value) * 100).toFixed(digits)}%`;
const num = (value, digits = 3) => value == null ? "—" : Number(value).toFixed(digits);
const dateLabel = (value) => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)) : "—";

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function renderClock(data) {
  const sprint = data.sprint;
  setText("#project-status", `${data.project.status} · ${data.project.phase}`);
  setText("#headline", data.project.headline);
  setText("#sprint-day", `${sprint.day} / ${sprint.total_days}`);
  setText("#queue-ratio", `${data.queue.completed} / ${data.queue.total}`);
  setText("#test-ratio", data.tests.total ? `${data.tests.passed} / ${data.tests.total}` : "—");
  setText("#updated-at", dateLabel(data.generated_at));
  setText("#footer-updated", `데이터 ${dateLabel(data.generated_at)}`);
  const track = $(".progress-track");
  const bar = $("#sprint-progress");
  const update = () => {
    const now = Date.now();
    const start = new Date(sprint.start).getTime();
    const deadline = new Date(sprint.deadline).getTime();
    const remaining = Math.max(0, deadline - now);
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    setText("#countdown", `${hours}h ${String(minutes).padStart(2, "0")}m`);
    const progress = Math.min(1, Math.max(0, (now - start) / (deadline - start)));
    bar.style.width = `${progress * 100}%`;
    track.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  };
  update();
  window.setInterval(update, 60_000);
}

function renderProgress(data) {
  const cards = [
    ["COMPLETED RUNS", data.experiments.completed_count, "레지스트리의 완료 블록"],
    ["QUEUE PROGRESS", pct(data.queue.completion_fraction), `${data.queue.total}개 자동화 작업`],
    ["ACTIVE MILESTONE", `DAY ${data.sprint.day}`, "감사 루프 및 capability gate"],
    ["REPLICATION RESERVE", "15%", "최종 검증을 위해 보존"],
  ];
  const root = $("#progress-metrics");
  cards.forEach(([label, value, description]) => {
    const card = node("article", "metric-card");
    card.append(node("span", "", label), node("strong", "", value), node("p", "", description));
    root.append(card);
  });
  setText("#queue-summary", `${data.queue.completed}/${data.queue.total} COMPLETE`);
  data.queue.jobs.forEach((job, index) => {
    const row = node("div", "job");
    row.append(node("span", "job-index", String(index + 1).padStart(2, "0")));
    const center = node("div");
    center.append(node("strong", "", job.id), node("small", "", `${job.track || "—"} · S${job.stage ?? "—"} · ${job.objective_id || job.kind || "—"}`));
    row.append(center, node("span", `status ${job.status}`, job.status.toUpperCase()));
    $("#job-list").append(row);
  });
  data.milestones.items.forEach((item) => {
    const li = node("li", `milestone ${item.state}`);
    li.append(node("span", "day-node", `D${item.day}`));
    const content = node("div");
    content.append(node("strong", "", item.name.replaceAll("_", " ")), node("small", "", item.gate.replaceAll("_", " ")));
    li.append(content, node("span", `status ${item.state}`, item.state.toUpperCase()));
    $("#milestone-list").append(li);
  });
}

function svgBarChart(series, options = {}) {
  const width = 620, height = 280;
  const margin = { top: 28, right: 18, bottom: 58, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = options.max || Math.max(...series.flatMap(group => group.values.map(v => v.value)), 1);
  const colors = options.colors || ["#7df0bd", "#f0ba66"];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + plotHeight - (i / 4) * plotHeight;
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", margin.left); line.setAttribute("x2", width - margin.right);
    line.setAttribute("y1", y); line.setAttribute("y2", y); line.setAttribute("stroke", "#23372f");
    svg.append(line);
    const label = document.createElementNS(svg.namespaceURI, "text");
    label.setAttribute("x", margin.left - 8); label.setAttribute("y", y + 4); label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "#6f8179"); label.setAttribute("font-size", "10");
    label.textContent = ((i / 4) * max).toFixed(options.axisDigits ?? 1);
    svg.append(label);
  }
  const groupWidth = plotWidth / series.length;
  series.forEach((group, groupIndex) => {
    const available = groupWidth * .7;
    const barWidth = Math.min(48, available / group.values.length - 6);
    group.values.forEach((entry, valueIndex) => {
      const value = Math.max(0, Number(entry.value || 0));
      const barHeight = (value / max) * plotHeight;
      const groupCenter = margin.left + groupWidth * (groupIndex + .5);
      const x = groupCenter - (barWidth * group.values.length + 6 * (group.values.length - 1)) / 2 + valueIndex * (barWidth + 6);
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.setAttribute("x", x); rect.setAttribute("y", margin.top + plotHeight - barHeight);
      rect.setAttribute("width", Math.max(1, barWidth)); rect.setAttribute("height", Math.max(value ? 2 : 1, barHeight));
      rect.setAttribute("rx", "3"); rect.setAttribute("fill", colors[valueIndex % colors.length]);
      svg.append(rect);
      const valueText = document.createElementNS(svg.namespaceURI, "text");
      valueText.setAttribute("x", x + barWidth / 2); valueText.setAttribute("y", Math.max(14, margin.top + plotHeight - barHeight - 7));
      valueText.setAttribute("text-anchor", "middle"); valueText.setAttribute("fill", "#e9f2ed"); valueText.setAttribute("font-size", "10");
      valueText.textContent = value.toFixed(options.valueDigits ?? 3);
      svg.append(valueText);
    });
    const label = document.createElementNS(svg.namespaceURI, "text");
    label.setAttribute("x", margin.left + groupWidth * (groupIndex + .5)); label.setAttribute("y", height - 25);
    label.setAttribute("text-anchor", "middle"); label.setAttribute("fill", "#9dada6"); label.setAttribute("font-size", "11");
    label.textContent = group.label;
    svg.append(label);
  });
  const legend = document.createElementNS(svg.namespaceURI, "g");
  (options.legend || []).forEach((labelText, index) => {
    const x = margin.left + index * 115;
    const dot = document.createElementNS(svg.namespaceURI, "rect");
    dot.setAttribute("x", x); dot.setAttribute("y", 2); dot.setAttribute("width", 9); dot.setAttribute("height", 9); dot.setAttribute("rx", 2); dot.setAttribute("fill", colors[index]);
    const text = document.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", x + 14); text.setAttribute("y", 10); text.setAttribute("fill", "#9dada6"); text.setAttribute("font-size", "10"); text.textContent = labelText;
    legend.append(dot, text);
  });
  svg.append(legend);
  return svg;
}

function renderEvidence(data) {
  const audit = data.evidence.environment_audit;
  const positive = data.evidence.positive_control;
  setText("#immobility-change", `${pct(audit.v1.immobility_rate)} → ${pct(audit.v2.immobility_rate)}`);
  const v3 = positive.v3_positive_control;
  setText("#v3-rate", pct(v3.positive_share.pooled_observational_rate));
  $("#physics-chart").append(svgBarChart([
    { label: "정지율", values: [{ value: audit.v1.immobility_rate }, { value: audit.v2.immobility_rate }] },
    { label: "이동 엔트로피", values: [{ value: audit.v1.movement_entropy_agent_0 }, { value: audit.v2.movement_entropy_agent_0 }] },
  ], { max: 1, legend: ["v1", "v2"], valueDigits: 3 }));
  setText("#physics-note", `${audit.interpretation} 최대 에너지 회계 오차 v2: ${audit.v2.max_energy_accounting_error}.`);
  const bySeed = new Map();
  v3.rows.forEach(row => {
    if (!bySeed.has(row.seed)) bySeed.set(row.seed, {});
    bySeed.get(row.seed)[row.condition] = row.need_share_rate;
  });
  const groups = [...bySeed.entries()].sort((a,b) => Number(a[0]) - Number(b[0])).map(([seed, values]) => ({
    label: `seed ${seed}`,
    values: [{ value: values["POSITIVE-SHARE"] || 0 }, { value: values["CTRL-NONE"] || 0 }],
  }));
  $("#share-chart").append(svgBarChart(groups, { max: 1, legend: ["직접 공유 보상", "CTRL-NONE"], valueDigits: 3 }));
  setText("#share-note", `직접 보상: ${v3.positive_share.events.toLocaleString()} events / ${v3.positive_share.opportunities.toLocaleString()} opportunities. 대조군: ${v3.control_none.events.toLocaleString()} / ${v3.control_none.opportunities.toLocaleString()}. 인과 추정량 없음.`);
  const v1 = positive.v1_checkpoint_audit;
  setText("#v1-audit-copy", v1.interpretation);
  v1.rows.forEach(row => {
    const item = node("div");
    item.append(node("strong", "", pct(row.need_share_rate)), node("span", "", `${row.condition} · n=${row.need_opportunities}`));
    $("#v1-audit-values").append(item);
  });
}

function renderExperiments(data) {
  data.experiments.rows.slice().reverse().forEach(row => {
    const tr = node("tr");
    const values = [
      dateLabel(row.completed_at),
      row.experiment_id,
      `${row.track} / S${row.stage}`,
      row.objective_id,
      row.seeds.join(", "),
      row.decision,
    ];
    values.forEach((value, index) => {
      const td = node("td");
      if (index === 1) td.append(node("code", "", value));
      else if (index === 5) td.append(node("span", "decision", value));
      else td.textContent = value || "—";
      tr.append(td);
    });
    $("#experiment-rows").append(tr);
  });
}

function listInto(selector, values) {
  values.forEach(value => $(selector).append(node("li", "", value)));
}

function renderAnalysis(data) {
  listInto("#supported-list", data.analysis.claim_boundary.supported);
  listInto("#unsupported-list", data.analysis.claim_boundary.not_supported);
  listInto("#limitations-list", data.analysis.limitations);
  const sections = data.analysis.curated_report_sections;
  Object.entries(sections).slice(0, 4).forEach(([title, copy]) => {
    const block = node("div", "analysis-block");
    block.append(node("strong", "", title), node("p", "", copy));
    $("#curated-analysis").append(block);
  });
  setText("#provenance-warning", data.provenance.warning);
  data.methodology.principles.forEach((principle, index) => {
    const item = node("div", "method-item");
    item.append(node("span", "", String(index + 1).padStart(2, "0")), node("p", "", principle));
    $("#method-list").append(item);
  });
  const banner = $("#test-banner");
  banner.querySelector("strong").textContent = data.tests.total ? `${data.tests.passed} / ${data.tests.total} PASS` : "UNKNOWN";
  banner.querySelector("small").textContent = `${data.tests.note || ""} · ${dateLabel(data.tests.checked_at)}`;
}

async function start() {
  try {
    const response = await fetch("data/dashboard.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== 1) throw new Error("지원하지 않는 데이터 스키마");
    renderClock(data);
    renderProgress(data);
    renderEvidence(data);
    renderExperiments(data);
    renderAnalysis(data);
  } catch (error) {
    setText("#project-status", "DASHBOARD DATA ERROR");
    const message = node("p", "load-error", `공개 연구 데이터를 불러오지 못했습니다: ${error.message}`);
    $(".hero").append(message);
  }
}

start();
