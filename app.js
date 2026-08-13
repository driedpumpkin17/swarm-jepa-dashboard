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

const availabilityCopy = {
  completed: ["아티팩트 완료", ""],
  active: ["실행 중", ""],
  ready: ["실행 가능", "ready"],
  waiting_dependencies: ["선행 작업 대기", "waiting"],
  blocked_dependency: ["선행 실패로 차단", "blocked"],
  blocked_unsupported: ["큐 pending · 현재 runner 미지원", "blocked"],
  blocked: ["큐에서 차단", "blocked"],
  failed: ["실패 · 재개 판단 필요", "failed"],
  cancelled: ["취소됨", "blocked"],
  unsupported: ["미지원", "blocked"],
  unknown: ["상태 불명", "blocked"],
};

function renderActiveWork(queue) {
  const root = $("#active-work");
  const activeJobs = queue.active_jobs || [];
  if (!activeJobs.length) {
    const idle = node("div", "idle-card");
    const pending = queue.jobs.filter(job => job.status === "pending");
    const ready = pending.filter(job => job.availability === "ready").length;
    const blocked = pending.filter(job => job.availability.startsWith("blocked")).length;
    idle.append(
      node("span", "kicker", "NO ACTIVE WRITER"),
      node("h4", "", "현재 실행 중인 큐 작업 없음"),
      node("p", "", "pending " + pending.length + "개 · 즉시 실행 가능 " + ready + "개 · 실행 차단 " + blocked + "개")
    );
    root.append(idle);
    return;
  }
  activeJobs.forEach(job => {
    const card = node("article", "active-card");
    const head = node("div", "active-card-head");
    const title = node("div");
    title.append(node("span", "kicker", "ACTIVE JOB"), node("h4", "", job.id));
    head.append(title, node("span", "status running", "RUNNING"));
    card.append(head);
    card.append(node("p", "active-card-meta", (job.track || "—") + " · Stage " + (job.stage ?? "—") + " · claimed " + dateLabel(job.claimed_at)));
    const progress = job.partial_progress || { available: false };
    if (progress.available && progress.planned_runs != null) {
      const planLabel = progress.plan_basis === "condition_x_seed"
        ? progress.condition_count + " conditions × " + progress.seed_count + " seeds"
        : progress.planned_runs + " manifest runs";
      const label = node("div", "active-progress-label");
      label.append(
        node("span", "", "완료 run_key · " + planLabel),
        node("strong", "", progress.completed_runs + " / " + progress.planned_runs)
      );
      const bar = node("div", "run-progress");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", job.id + " 완료 run 진행률");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(progress.planned_runs));
      bar.setAttribute("aria-valuenow", String(progress.completed_runs));
      const fill = node("span");
      fill.style.width = (progress.completion_fraction * 100) + "%";
      bar.append(fill);
      card.append(label, bar);
    } else {
      card.append(node("p", "active-card-meta", "부분 진행 분모를 안전하게 산출할 수 있어야 수치를 공개합니다."));
    }
    root.append(card);
  });
}

const workstreamStateCopy = {
  active: "ACTIVE",
  blocked: "BLOCKED",
  pending: "PENDING",
  completed: "COMPLETE",
};

function renderWorkstreams(workstreams) {
  setText(
    "#workstream-total",
    workstreams.completed_criteria + " / " + workstreams.total_criteria
  );
  const overall = $(".workstream-overall");
  overall.setAttribute("aria-valuemax", String(workstreams.total_criteria));
  overall.setAttribute("aria-valuenow", String(workstreams.completed_criteria));
  $("#workstream-overall-fill").style.width =
    (workstreams.progress_fraction * 100) + "%";
  workstreams.items.forEach(stream => {
    const card = node("article", "workstream-card " + stream.state);
    const head = node("div", "workstream-card-head");
    const title = node("div");
    title.append(
      node("span", "kicker", stream.id.replaceAll("_", " ")),
      node("h4", "", stream.title)
    );
    head.append(
      title,
      node(
        "span",
        "workstream-state " + stream.state,
        workstreamStateCopy[stream.state] || stream.state.toUpperCase()
      )
    );
    card.append(head, node("p", "workstream-objective", stream.objective));

    const progressLabel = node("div", "workstream-progress-label");
    progressLabel.append(
      node("span", "", "선별 체크리스트"),
      node(
        "strong",
        "",
        stream.completed_count + " / " + stream.total_count
      )
    );
    const progress = node("div", "workstream-progress");
    progress.setAttribute("role", "progressbar");
    progress.setAttribute(
      "aria-label",
      stream.title + " curated criterion 집계"
    );
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(stream.total_count));
    progress.setAttribute("aria-valuenow", String(stream.completed_count));
    const fill = node("span");
    fill.style.width = (stream.progress_fraction * 100) + "%";
    progress.append(fill);
    card.append(progressLabel, progress);

    if (stream.next_criterion) {
      const next = node("p", "workstream-next");
      next.append(
        node("strong", "", "NEXT CRITERION"),
        document.createTextNode(stream.next_criterion)
      );
      card.append(next);
    }
    stream.blockers.forEach(blocker => {
      const block = node("p", "workstream-blocker");
      block.append(
        node("strong", "", "BLOCKER"),
        document.createTextNode(blocker)
      );
      card.append(block);
    });

    const details = node("details", "workstream-checklist");
    details.append(
      node(
        "summary",
        "",
        "전체 checklist · " + stream.completed_count + "/" + stream.total_count
      )
    );
    const list = node("ol");
    stream.checklist.forEach(check => {
      list.append(
        node("li", check.complete ? "done" : "", check.criterion)
      );
    });
    details.append(list);
    card.append(details);
    $("#workstream-grid").append(card);
  });
}

function renderAutomationRoadmap(milestones) {
  const roadmap = milestones.automation_roadmap;
  if (!roadmap || !roadmap.prerequisites || !roadmap.scientific_run) {
    throw new Error("CEF 공개 로드맵이 누락되었습니다.");
  }
  const prerequisites = roadmap.prerequisites;
  setText(
    "#cef-prerequisite-total",
    prerequisites.completed + " / " + prerequisites.total
  );
  setText("#cef-roadmap-state", roadmap.state.replaceAll("_", " "));
  setText("#cef-roadmap-report", roadmap.report);
  const progress = $(".roadmap-progress");
  progress.setAttribute("aria-valuemax", String(prerequisites.total));
  progress.setAttribute("aria-valuenow", String(prerequisites.completed));
  $("#roadmap-progress-fill").style.width =
    (prerequisites.progress_fraction * 100) + "%";

  const nextTask = prerequisites.next_task;
  setText("#cef-next-task", nextTask ? nextTask.id : "PREREQUISITES COMPLETE");
  setText(
    "#cef-next-action",
    nextTask ? nextTask.action.replaceAll("_", " ") : "CEF-10 unlock 조건 충족"
  );
  const scheduleGate = $("#cef-schedule-gate");
  scheduleGate.textContent = roadmap.schedule_record_gate_ready
    ? "SCHEDULE GATE TRUE"
    : "SCHEDULE GATE FALSE";
  scheduleGate.className = "gate-flag " + (roadmap.schedule_record_gate_ready ? "open" : "closed");
  const jepaGate = $("#cef-jepa-gate");
  jepaGate.textContent = roadmap.jepa_matrix_allowed
    ? "JEPA MATRIX TRUE"
    : "JEPA MATRIX FALSE";
  jepaGate.className = "gate-flag " + (roadmap.jepa_matrix_allowed ? "open" : "closed");

  const analysis = roadmap.analysis;
  const analysisFields = [
    "status_interpretation",
    "claim_boundary",
    "next_decision",
  ];
  if (!analysis || analysisFields.some(field => typeof analysis[field] !== "string")) {
    throw new Error("CEF 파생 분석이 누락되었거나 잘못되었습니다.");
  }
  setText("#cef-status-interpretation", analysis.status_interpretation);
  setText("#cef-claim-boundary", analysis.claim_boundary);
  setText("#cef-next-decision", analysis.next_decision);

  prerequisites.tasks.forEach(task => {
    const li = node("li", "cef-task " + task.state);
    li.append(node("span", "cef-task-id", task.id));
    const body = node("div");
    body.append(node("strong", "", task.action.replaceAll("_", " ")));
    const dependency = task.depends_on.length
      ? "depends on " + task.depends_on.join(", ")
      : "root prerequisite";
    body.append(node("small", "", dependency));
    if (task.evidence_sha256) {
      body.append(node("code", "cef-evidence-sha", "sha256 " + task.evidence_sha256));
    }
    li.append(
      body,
      node("span", "status " + task.state, task.state.replaceAll("_", " ").toUpperCase())
    );
    $("#cef-prerequisite-list").append(li);
  });

  const scientificRun = roadmap.scientific_run;
  setText("#cef-run-id", scientificRun.id);
  setText("#cef-run-action", scientificRun.action.replaceAll("_", " "));
  setText(
    "#cef-run-dependency",
    "depends on " + scientificRun.depends_on.join(", ")
  );
  const runState = $("#cef-run-state");
  runState.textContent = scientificRun.state.toUpperCase();
  runState.className = "status " + scientificRun.state;
}

function renderProgress(data) {
  const executionBlocked = Object.entries(data.queue.availability_counts || {})
    .filter(([state]) => state.startsWith("blocked") || state === "failed")
    .reduce((total, [, count]) => total + count, 0);
  const cards = [
    ["COMPLETED BLOCKS", data.experiments.completed_count, "무결성 확인된 실험 블록"],
    ["QUEUE PROGRESS", pct(data.queue.completion_fraction), data.queue.total + "개 자동화 작업"],
    ["ACTIVE JOBS", data.queue.active_jobs.length, data.queue.active_jobs.length ? "현재 실행 중" : "writer idle"],
    ["EXECUTION BLOCKED", executionBlocked, "pending 상태의 runner 미지원 포함"],
  ];
  const root = $("#progress-metrics");
  cards.forEach(([label, value, description]) => {
    const card = node("article", "metric-card");
    card.append(node("span", "", label), node("strong", "", value), node("p", "", description));
    root.append(card);
  });
  setText("#queue-summary", `${data.queue.completed}/${data.queue.total} COMPLETE`);
  renderWorkstreams(data.workstreams);
  renderAutomationRoadmap(data.milestones);
  renderActiveWork(data.queue);
  data.queue.jobs.forEach((job, index) => {
    const row = node("div", "job");
    row.append(node("span", "job-index", String(index + 1).padStart(2, "0")));
    const center = node("div");
    center.append(node("strong", "", job.id));
    const availability = availabilityCopy[job.availability] || availabilityCopy.unknown;
    center.append(
      node(
        "small",
        "execution-note " + availability[1],
        (job.track || "—") + " · S" + (job.stage ?? "—") + " · " + (job.objective_id || job.kind || "—") + " · " + availability[0]
      )
    );
    row.append(center, node("span", "status " + job.status, job.status.toUpperCase()));
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
  const rawValues = series.flatMap(group =>
    group.values.map(entry => Number(entry.value))
  );
  if (!rawValues.length || rawValues.some(value => !Number.isFinite(value))) {
    throw new Error("차트 evidence 값이 유한하지 않습니다.");
  }
  const max = options.max ?? Math.max(...rawValues, 1);
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
      const rawValue = Number(entry.value);
      if (!Number.isFinite(rawValue)) {
        throw new Error("차트 evidence 값이 누락되었습니다.");
      }
      const value = Math.max(0, rawValue);
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

  if (audit.available) {
    setText(
      "#immobility-change",
      pct(audit.v1.immobility_rate) + " → " + pct(audit.v2.immobility_rate)
    );
    $("#physics-chart").append(svgBarChart([
      {
        label: "정지율",
        values: [
          { value: audit.v1.immobility_rate },
          { value: audit.v2.immobility_rate },
        ],
      },
      {
        label: "이동 엔트로피",
        values: [
          { value: audit.v1.movement_entropy_agent_0 },
          { value: audit.v2.movement_entropy_agent_0 },
        ],
      },
    ], { max: 1, legend: ["v1", "v2"], valueDigits: 3 }));
    setText(
      "#physics-note",
      audit.interpretation
        + " 최대 에너지 회계 오차 v2: "
        + audit.v2.max_energy_accounting_error
        + "."
    );
  } else {
    setText("#immobility-change", "—");
    setText(
      "#physics-note",
      "필수 exact 완료 아티팩트가 없어 물리 evidence를 공개하지 않습니다."
    );
  }

  if (!positive.available) {
    setText("#v3-rate", "—");
    setText(
      "#share-note",
      "필수 exact 완료 아티팩트가 없어 양성대조 evidence를 공개하지 않습니다."
    );
    setText("#v1-audit-copy", "검증 가능한 evidence 없음");
    return;
  }

  const v3 = positive.v3_positive_control;
  setText("#v3-rate", pct(v3.positive_share.pooled_observational_rate));
  const bySeed = new Map();
  v3.rows.forEach(row => {
    if (!bySeed.has(row.seed)) bySeed.set(row.seed, {});
    bySeed.get(row.seed)[row.condition] = row.need_share_rate;
  });
  const groups = [...bySeed.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([seed, values]) => {
      const positiveRate = values["POSITIVE-SHARE"];
      const controlRate = values["CTRL-NONE"];
      if (
        !Number.isFinite(positiveRate)
        || !Number.isFinite(controlRate)
      ) {
        throw new Error("seed별 양성대조 evidence가 불완전합니다.");
      }
      return {
        label: "seed " + seed,
        values: [
          { value: positiveRate },
          { value: controlRate },
        ],
      };
    });
  $("#share-chart").append(svgBarChart(groups, {
    max: 1,
    legend: ["직접 공유 보상", "CTRL-NONE"],
    valueDigits: 3,
  }));
  setText(
    "#share-note",
    "직접 보상: "
      + v3.positive_share.events.toLocaleString()
      + " events / "
      + v3.positive_share.opportunities.toLocaleString()
      + " opportunities. 대조군: "
      + v3.control_none.events.toLocaleString()
      + " / "
      + v3.control_none.opportunities.toLocaleString()
      + ". 인과 추정량 없음."
  );
  const v1 = positive.v1_checkpoint_audit;
  setText("#v1-audit-copy", v1.interpretation);
  v1.rows.forEach(row => {
    const item = node("div");
    item.append(
      node("strong", "", pct(row.need_share_rate)),
      node(
        "span",
        "",
        row.condition + " · n=" + row.need_opportunities
      )
    );
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
