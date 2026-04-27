import * as dom from "./dom.js";
import { state } from "../shared/state.js";

export function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function formatChallengeType(type) {
  const labels = {
    multiple_choice: "Quiz",
    true_false: "True / False",
    fill_blank: "Fill Blank",
    order_steps: "Order Steps",
    spot_mistake: "Spot Mistake",
    matching: "Matching",
    multiple_select: "Multi Select"
  };
  return labels[type] || type;
}

// Format prompt text: detect ```code``` blocks and $math$
function formatPromptHTML(text) {
  let html = escapeHTML(text || "");

  // Code blocks ```...```
  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre class="code-block"><code>${code.trim()}</code></pre>`
  );

  // Inline code `...`
  html = html.replace(/`([^`]+)`/g, (_, code) =>
    `<code class="inline-code">${code}</code>`
  );

  // Math $...$
  html = html.replace(/\$([^$]+)\$/g, (_, math) =>
    `<span class="math-inline">${math}</span>`
  );

  return html;
}

export function showScreen(screen, pushToHistory = true) {
  Object.values(dom.screens).forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
  const screenName = Object.keys(dom.screens).find(k => dom.screens[k] === screen) || "home";
  if (pushToHistory && history.state?.screen !== screenName) {
    history.pushState({ screen: screenName }, "", window.location.href);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function updateTimerUI() {
  dom.timerText.textContent = state.timeLeft;
  const percent = Math.max(0, (state.timeLeft / state.questionTime) * 100);
  dom.timerRing.style.setProperty("--timer", `${percent}%`);
  
  if (state.timeLeft <= 5 && state.timeLeft > 0) {
    dom.timerRing.setAttribute("data-warning", "true");
  } else {
    dom.timerRing.removeAttribute("data-warning");
  }
}

export function renderPlayerList(players) {
  dom.playersList.innerHTML = "";
  dom.playerCountText.textContent = `${players.length} joined`;
  players.forEach((player, i) => {
    const div = document.createElement("div");
    div.className = "player-card";
    div.innerHTML = `<div><strong>${i + 1}. ${escapeHTML(player.name)}</strong><p class="muted" style="font-size:13px;">${player.finished ? "Finished" : "Waiting"}</p></div><strong>${player.score}</strong>`;
    dom.playersList.appendChild(div);
  });
}

export function renderConceptPills(concepts) {
  dom.conceptsList.innerHTML = "";
  (concepts || []).slice(0, 6).forEach(concept => {
    const span = document.createElement("span");
    span.className = "pill"; span.textContent = concept;
    dom.conceptsList.appendChild(span);
  });
}

export function renderChallenge(onSubmitAnswer) {
  state.selectedAnswer = null;
  state.currentOrderSelection = [];

  dom.feedbackBox.classList.add("hidden");
  dom.submitAnswerBtn.classList.remove("hidden");
  dom.submitAnswerBtn.disabled = false;
  dom.mistakeBox.classList.add("hidden");
  dom.answerBox.innerHTML = "";

  const challenge = state.currentPack.challenges[state.currentChallengeIndex];

  dom.typeTag.textContent       = formatChallengeType(challenge.type);
  dom.conceptTag.textContent    = challenge.concept || "Concept";
  dom.difficultyTag.textContent = challenge.difficulty || "medium";
  dom.challengeNumberText.textContent = state.currentChallengeIndex + 1;

  // Render prompt with code/math formatting
if (challenge.type === "fill_blank") {
  const blankSpan = `<span class="blank-token">____</span>`;

  dom.challengePromptText.innerHTML = formatPromptHTML(challenge.prompt || "")
    .replace(/_{2,}/g, "____")
    .replace("____", blankSpan);
} else {
  dom.challengePromptText.innerHTML = formatPromptHTML(challenge.prompt || "");
}

  const progress = Math.round((state.currentChallengeIndex / state.currentPack.challenges.length) * 100);
  dom.progressText.textContent = `${progress}%`;
  dom.progressBar.style.width  = `${progress}%`;
  dom.scoreText.textContent    = state.localScore;

  if (challenge.type === "multiple_choice" || challenge.type === "true_false") {
    renderOptionButtons(challenge.options);
  }
  if (challenge.type === "spot_mistake") {
    dom.mistakeBox.classList.remove("hidden");
    dom.mistakeText.innerHTML = formatPromptHTML(challenge.mistakeText || "");
    renderOptionButtons(challenge.options);
  }
  if (challenge.type === "fill_blank")   renderFillBlank(onSubmitAnswer);
  if (challenge.type === "order_steps")  renderOrderSteps(challenge.steps);
  if (challenge.type === "matching")     renderMatching(challenge);
  if (challenge.type === "multiple_select") renderMultipleSelect(challenge.options);
}

export function renderOptionButtons(options) {
  options.forEach(option => {
    const button = document.createElement("button");
    button.className  = "option";
    button.innerHTML  = formatPromptHTML(option);
    button.dataset.raw = option;
    button.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach(b => b.classList.remove("selected"));
      state.selectedAnswer = option;
      button.classList.add("selected");
    });
    dom.answerBox.appendChild(button);
  });
}

export function renderFillBlank(onEnterKey) {
  const wrapper = document.createElement("div");
  wrapper.className = "flat-card";
  wrapper.innerHTML = `<div class="eyebrow">Write the missing answer</div><input id="fillBlankInput" class="input" style="margin-top:16px;" placeholder="Type your answer..." />`;
  dom.answerBox.appendChild(wrapper);
  const input = document.getElementById("fillBlankInput");
  input.focus();
  input.addEventListener("input", () => { state.selectedAnswer = input.value.trim(); });
  if (onEnterKey) {
    input.addEventListener("keydown", e => { if (e.key === "Enter") onEnterKey(); });
  }
}

export function renderOrderSteps(steps) {
  const info = document.createElement("div");
  info.className = "flat-card";
  info.innerHTML = `<div class="eyebrow">Build the correct order</div><p class="muted" style="margin-top:12px;">Click steps in the correct sequence. Click a selected step to remove it.</p>`;
  const availableBox = document.createElement("div");
  availableBox.style.cssText = "display:grid;gap:12px;margin-top:18px;";
  const selectedBox = document.createElement("div");
  selectedBox.className = "flat-card";
  selectedBox.style.marginTop = "18px";
  selectedBox.innerHTML = `<div class="eyebrow">Your order</div><div id="chosenStepsBox" style="display:grid;gap:12px;margin-top:16px;"></div>`;
  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn-secondary"; resetBtn.type = "button";
  resetBtn.style.marginTop = "16px"; resetBtn.textContent = "Reset order";
  dom.answerBox.appendChild(info);
  dom.answerBox.appendChild(availableBox);
  dom.answerBox.appendChild(selectedBox);
  dom.answerBox.appendChild(resetBtn);

  function refreshSteps() {
    availableBox.innerHTML = "";
    document.getElementById("chosenStepsBox").innerHTML = "";
    steps.filter(s => !state.currentOrderSelection.includes(s)).forEach(step => {
      const btn = document.createElement("button");
      btn.className = "step-option"; btn.innerHTML = formatPromptHTML(step);
      btn.addEventListener("click", () => {
        state.currentOrderSelection.push(step);
        state.selectedAnswer = [...state.currentOrderSelection];
        refreshSteps();
      });
      availableBox.appendChild(btn);
    });
    state.currentOrderSelection.forEach((step, i) => {
      const btn = document.createElement("button");
      btn.className = "chosen-step"; btn.innerHTML = `${i + 1}. ${formatPromptHTML(step)}`;
      btn.addEventListener("click", () => {
        state.currentOrderSelection = state.currentOrderSelection.filter(s => s !== step);
        state.selectedAnswer = [...state.currentOrderSelection];
        refreshSteps();
      });
      document.getElementById("chosenStepsBox").appendChild(btn);
    });
    state.selectedAnswer = [...state.currentOrderSelection];
  }
  resetBtn.addEventListener("click", () => { state.currentOrderSelection = []; state.selectedAnswer = []; refreshSteps(); });
  refreshSteps();
}

export function renderMatching(challenge) {
  const leftItems  = challenge.pairs.map(p => p.left);
  const rightItems = challenge.shuffledRight || challenge.pairs.map(p => p.right);

  const info = document.createElement("div");
  info.className = "flat-card";
  info.innerHTML = `<div class="eyebrow">Match each item</div><p class="muted" style="margin-top:10px;">Click a left item, then click its matching right item.</p>`;
  dom.answerBox.appendChild(info);

  const grid = document.createElement("div");
  grid.className = "matching-grid";
  dom.answerBox.appendChild(grid);

  const matchedBox = document.createElement("div");
  matchedBox.id = "matchedPairs";
  matchedBox.className = "matched-pairs-box";
  dom.answerBox.appendChild(matchedBox);

  let selectedLeft = null;
  let matched = {}; // left → right

  function refresh() {
    grid.innerHTML = "";

    const leftCol  = document.createElement("div"); leftCol.className  = "matching-col";
    const rightCol = document.createElement("div"); rightCol.className = "matching-col";

    leftItems.filter(l => !matched[l]).forEach(l => {
      const btn = document.createElement("button");
      btn.className = `option matching-item ${selectedLeft === l ? "selected" : ""}`;
      btn.innerHTML = formatPromptHTML(l);
      btn.addEventListener("click", () => { selectedLeft = l; refresh(); });
      leftCol.appendChild(btn);
    });

    rightItems.filter(r => !Object.values(matched).includes(r)).forEach(r => {
      const btn = document.createElement("button");
      btn.className = "option matching-item";
      btn.innerHTML = formatPromptHTML(r);
      btn.addEventListener("click", () => {
        if (selectedLeft) {
          matched[selectedLeft] = r;
          selectedLeft = null;
          updateSelectedAnswer();
          refresh();
        }
      });
      rightCol.appendChild(btn);
    });

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);

    // Matched pairs
    matchedBox.innerHTML = Object.entries(matched).length
      ? `<div class="eyebrow" style="margin-bottom:10px;">Your matches</div>`
      : "";
    Object.entries(matched).forEach(([l, r]) => {
      const row = document.createElement("div");
      row.className = "matched-row";
      row.innerHTML = `<span>${escapeHTML(l)}</span><span class="match-arrow">→</span><span>${escapeHTML(r)}</span>
        <button class="match-remove" data-left="${escapeHTML(l)}">✕</button>`;
      row.querySelector(".match-remove").addEventListener("click", () => {
        delete matched[l]; updateSelectedAnswer(); refresh();
      });
      matchedBox.appendChild(row);
    });
  }

  function updateSelectedAnswer() {
    state.selectedAnswer = Object.entries(matched).map(([left, right]) => ({ left, right }));
  }

  refresh();
}

export function renderMultipleSelect(options) {
  const info = document.createElement("div");
  info.className = "flat-card";
  info.innerHTML = `<div class="eyebrow">Select ALL that apply</div><p class="muted" style="margin-top:10px;">Choose every correct answer, then lock your selection.</p>`;
  dom.answerBox.appendChild(info);

  const selected = new Set();

  options.forEach(option => {
    const button = document.createElement("button");
    button.className   = "option multi-select-option";
    button.innerHTML   = formatPromptHTML(option);
    button.dataset.raw = option;
    button.addEventListener("click", () => {
      if (selected.has(option)) { selected.delete(option); button.classList.remove("selected"); }
      else { selected.add(option); button.classList.add("selected"); }
      state.selectedAnswer = [...selected];
    });
    dom.answerBox.appendChild(button);
  });

  state.selectedAnswer = [];
}

export function renderLockedState() {
  document.querySelectorAll(".option, .step-option, .chosen-step, .matching-item").forEach(btn => {
    btn.disabled = true;
    if (!btn.classList.contains("selected")) btn.style.opacity = "0.45";
  });
  const fillInput = document.getElementById("fillBlankInput");
  if (fillInput) fillInput.disabled = true;

  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.add("hidden");

  if (!document.getElementById("waitingBadge")) {
    const badge = document.createElement("div");
    badge.id = "waitingBadge"; badge.className = "waiting-badge";
    badge.innerHTML = `<span class="waiting-dot"></span> Answer locked — waiting for others...`;
    dom.answerBox.appendChild(badge);
  }
}

export function renderResultPhase(challenge, submitResult) {
  dom.answerBox.innerHTML = "";
  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.add("hidden");
  dom.mistakeBox.classList.add("hidden");

  const isCorrect = submitResult?.isCorrect ?? false;
  const isPartial = submitResult?.isPartial ?? false;
  const points    = submitResult?.points    ?? 0;

  const correctDisplay = challenge.type === "order_steps"
    ? challenge.correctOrder.join(" → ")
    : challenge.type === "multiple_select"
      ? challenge.correctAnswers.join(", ")
      : challenge.type === "matching"
        ? challenge.pairs.map(p => `${p.left} → ${p.right}`).join(" | ")
        : challenge.correctAnswer;

  let cls = "result-wrong";
  let label = "Wrong answer!";
  if (isCorrect) { cls = "result-correct"; label = `+${points} points!`; }
  else if (isPartial) { cls = "result-partial"; label = `Partial — +${points} points`; }

  const card = document.createElement("div");
  card.className = `result-phase-card ${cls}`;
  card.innerHTML = `
    <div class="result-icon">${isCorrect ? "✅" : isPartial ? "🟡" : "❌"}</div>
    <h2 class="result-label">${label}</h2>
    <p class="result-answer">Correct: <strong>${escapeHTML(correctDisplay)}</strong></p>
    <p class="result-explanation muted">${escapeHTML(challenge.explanation || "")}</p>
  `;
  dom.answerBox.appendChild(card);
}

export function renderMiniLeaderboard(data, currentPack, isLast) {
  dom.answerBox.innerHTML = "";
  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.add("hidden");

  const players = data?.leaderboard || [];

  const container = document.createElement("div");
  container.className = "mini-lb";

  const title = document.createElement("div");
  title.className = "mini-lb-title";
  title.innerHTML = `<span class="eyebrow">${isLast ? "🏁 Final standings" : "📊 Standings"}</span><span id="lbCountdown" class="mini-lb-countdown"></span>`;
  container.appendChild(title);

  players.slice(0, 8).forEach((p, i) => {
    const row = document.createElement("div");
    row.className = `mini-lb-row ${i === 0 ? "mini-lb-first" : ""}`;
    row.style.animationDelay = `${i * 0.05}s`;
    row.innerHTML = `<span class="mini-lb-rank">${p.rank}</span><span class="mini-lb-name">${escapeHTML(p.name)}</span><span class="mini-lb-score">${p.score}</span>`;
    container.appendChild(row);
  });

  dom.answerBox.appendChild(container);
}

export function renderAnswerFeedback(data, isLastChallenge) {
  document.querySelectorAll(".option").forEach(button => {
    button.disabled = true;
    const raw = button.dataset.raw || button.textContent;
    if (raw === data.correctAnswer) button.classList.add("correct");
    if (raw === state.selectedAnswer && !data.isCorrect) button.classList.add("wrong");
  });
  document.querySelectorAll(".step-option, .chosen-step").forEach(b => { b.disabled = true; });
  const fillInput = document.getElementById("fillBlankInput");
  if (fillInput) fillInput.disabled = true;

  const isPartial = data.isPartial;
  dom.feedbackTitle.textContent = data.isCorrect
    ? `Correct +${data.points}`
    : isPartial
      ? `Partial +${data.points}`
      : "Review this";
  dom.feedbackTitle.style.color = data.isCorrect
    ? "var(--green)" : isPartial ? "var(--orange)" : "var(--red)";

  dom.correctAnswerText.textContent = `Correct answer: ${data.correctAnswer}`;
  dom.explanationText.textContent   = data.explanation || "";
  dom.sourceSnippet.textContent     = data.sourceSnippet || "No source snippet available.";

  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.remove("hidden");
  dom.nextChallengeBtn.classList.add("hidden");
}

export function renderPodium(data, currentPack) {
  dom.leaderboardList.innerHTML = "";
  const total   = currentPack ? currentPack.challenges.length : data.totalChallenges || 8;
  const players = data.leaderboard;

  if (typeof confetti === "function") {
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 250);
      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);
    }, 300);
  }

  if (players.length >= 2) {
    const podiumEl = document.createElement("div");
    podiumEl.className = "podium-container";
    const order = [
      players[1] ? { player: players[1], cls: "second", medal: "🥈", height: 110 } : null,
      players[0] ? { player: players[0], cls: "first",  medal: "🥇", height: 160 } : null,
      players[2] ? { player: players[2], cls: "third",  medal: "🥉", height: 70  } : null
    ].filter(Boolean);
    order.forEach(({ player, cls, medal, height }) => {
      const place = document.createElement("div");
      place.className = `podium-place ${cls}`;
      place.innerHTML = `<div class="podium-avatar">${escapeHTML(player.name[0].toUpperCase())}</div><div class="podium-name">${escapeHTML(player.name)}</div><div class="podium-score">${player.score} pts</div><div class="podium-block" style="height:${height}px">${medal}</div>`;
      podiumEl.appendChild(place);
    });
    dom.leaderboardList.appendChild(podiumEl);
  }

  const listTitle = document.createElement("div");
  listTitle.className = "eyebrow"; listTitle.style.marginBottom = "14px";
  listTitle.textContent = "Full standings";
  dom.leaderboardList.appendChild(listTitle);

  players.forEach(player => {
    const row = document.createElement("div");
    row.className = `leader-row ${player.rank === 1 ? "first" : ""}`;
    row.innerHTML = `<div style="display:flex;gap:14px;align-items:center;"><div class="rank">${player.rank}</div><div><strong style="font-size:18px;">${escapeHTML(player.name)}</strong><p class="muted" style="font-size:13px;">${player.correct}/${total} correct</p></div></div><strong style="font-size:26px;">${player.score}</strong>`;
    dom.leaderboardList.appendChild(row);
  });

  dom.groupWeakConcepts.innerHTML = "";
  if (!data.weakConcepts || data.weakConcepts.length === 0) {
    const span = document.createElement("span"); span.className = "pill";
    span.textContent = "No weak concepts detected";
    dom.groupWeakConcepts.appendChild(span);
  } else {
    data.weakConcepts.forEach(item => {
      const span = document.createElement("span"); span.className = "pill";
      span.textContent = `${item.concept} × ${item.count}`;
      dom.groupWeakConcepts.appendChild(span);
    });
  }
}

export function renderRecoveryLesson(lesson) {
  dom.lessonBox.innerHTML = "";
  const title = document.createElement("h2"); title.textContent = lesson.title;
  dom.lessonBox.appendChild(title);
  const summary = document.createElement("p"); summary.className = "muted"; summary.textContent = lesson.summary;
  dom.lessonBox.appendChild(summary);
  if (!lesson.sections || lesson.sections.length === 0) {
    const empty = document.createElement("div"); empty.className = "pill"; empty.textContent = "No missed concepts. Nice run.";
    dom.lessonBox.appendChild(empty); return;
  }
  lesson.sections.forEach(section => {
    const card = document.createElement("div"); card.className = "card";
    card.style.cssText = "box-shadow:5px 5px 0 var(--text);margin-top:8px;";
    card.innerHTML = `<div class="eyebrow">${escapeHTML(section.concept)}</div><h3 style="margin-top:14px;">What went wrong</h3><p class="muted" style="margin-top:8px;">${escapeHTML(section.whatWentWrong)}</p><h3 style="margin-top:18px;">Mini lesson</h3><p class="muted" style="margin-top:8px;">${escapeHTML(section.miniLesson)}</p><h3 style="margin-top:18px;">Memory hook</h3><p class="muted" style="margin-top:8px;">${escapeHTML(section.memoryHook)}</p><h3 style="margin-top:18px;">Retry challenge</h3><p style="margin-top:8px;font-weight:900;">${escapeHTML(section.retryChallenge)}</p>`;
    dom.lessonBox.appendChild(card);
  });
}
