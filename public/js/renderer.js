import * as dom from "./dom.js";
import { state } from "./state.js";

export function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatChallengeType(type) {
  const labels = {
    multiple_choice: "Quiz",
    true_false: "True / False",
    fill_blank: "Fill Blank",
    order_steps: "Order Steps",
    spot_mistake: "Spot Mistake"
  };
  return labels[type] || type;
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
}

export function renderPlayerList(players) {
  dom.playersList.innerHTML = "";
  dom.playerCountText.textContent = `${players.length} joined`;

  players.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "player-card";
    div.innerHTML = `
      <div>
        <strong>${index + 1}. ${escapeHTML(player.name)}</strong>
        <p class="muted" style="font-size: 13px;">${player.finished ? "Finished" : "Waiting"}</p>
      </div>
      <strong>${player.score}</strong>
    `;
    dom.playersList.appendChild(div);
  });
}

export function renderConceptPills(concepts) {
  dom.conceptsList.innerHTML = "";
  (concepts || []).slice(0, 6).forEach(concept => {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = concept;
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

  dom.typeTag.textContent = formatChallengeType(challenge.type);
  dom.conceptTag.textContent = challenge.concept || "Concept";
  dom.difficultyTag.textContent = challenge.difficulty || "medium";
  dom.challengeNumberText.textContent = state.currentChallengeIndex + 1;

  if (challenge.type === "fill_blank") {
    const blanks = "_".repeat(challenge.correctAnswer.length);
    const blankSpan = `<span style="letter-spacing:2px;border-bottom:4px solid var(--text);padding-bottom:2px;">${blanks}</span>`;
    // Replace only the first occurrence — prompts should have exactly one blank
    dom.challengePromptText.innerHTML = escapeHTML(challenge.prompt || "").replace("____", blankSpan);
  } else {
    dom.challengePromptText.textContent = challenge.prompt || "";
  }

  const progress = Math.round(
    (state.currentChallengeIndex / state.currentPack.challenges.length) * 100
  );
  dom.progressText.textContent = `${progress}%`;
  dom.progressBar.style.width = `${progress}%`;
  dom.scoreText.textContent = state.localScore;

  if (challenge.type === "multiple_choice" || challenge.type === "true_false") {
    renderOptionButtons(challenge.options);
  }

  if (challenge.type === "spot_mistake") {
    dom.mistakeBox.classList.remove("hidden");
    dom.mistakeText.textContent = challenge.mistakeText || "";
    renderOptionButtons(challenge.options);
  }

  if (challenge.type === "fill_blank") {
    renderFillBlank(onSubmitAnswer);
  }

  if (challenge.type === "order_steps") {
    renderOrderSteps(challenge.steps);
  }
}

export function renderOptionButtons(options) {
  options.forEach(option => {
    const button = document.createElement("button");
    button.className = "option";
    button.textContent = option;

    button.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach(btn => btn.classList.remove("selected"));
      state.selectedAnswer = option;
      button.classList.add("selected");
    });

    dom.answerBox.appendChild(button);
  });
}

export function renderFillBlank(onEnterKey) {
  const wrapper = document.createElement("div");
  wrapper.className = "flat-card";
  wrapper.innerHTML = `
    <div class="eyebrow">Write the missing answer</div>
    <input id="fillBlankInput" class="input" style="margin-top: 16px;" placeholder="Type your answer..." />
  `;

  dom.answerBox.appendChild(wrapper);

  const input = document.getElementById("fillBlankInput");
  input.focus();

  input.addEventListener("input", () => {
    state.selectedAnswer = input.value.trim();
  });

  if (onEnterKey) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") onEnterKey();
    });
  }
}

export function renderOrderSteps(steps) {
  const info = document.createElement("div");
  info.className = "flat-card";
  info.innerHTML = `
    <div class="eyebrow">Build the correct order</div>
    <p class="muted" style="margin-top: 12px;">Click the steps in the correct sequence. Click a selected step to remove it.</p>
  `;

  const availableBox = document.createElement("div");
  availableBox.style.display = "grid";
  availableBox.style.gap = "12px";
  availableBox.style.marginTop = "18px";

  const selectedBox = document.createElement("div");
  selectedBox.className = "flat-card";
  selectedBox.style.marginTop = "18px";
  selectedBox.innerHTML = `
    <div class="eyebrow">Your order</div>
    <div id="chosenStepsBox" style="display: grid; gap: 12px; margin-top: 16px;"></div>
  `;

  const resetButton = document.createElement("button");
  resetButton.className = "btn btn-secondary";
  resetButton.type = "button";
  resetButton.style.marginTop = "16px";
  resetButton.textContent = "Reset order";

  dom.answerBox.appendChild(info);
  dom.answerBox.appendChild(availableBox);
  dom.answerBox.appendChild(selectedBox);
  dom.answerBox.appendChild(resetButton);

  function refreshSteps() {
    availableBox.innerHTML = "";
    document.getElementById("chosenStepsBox").innerHTML = "";

    steps
      .filter(step => !state.currentOrderSelection.includes(step))
      .forEach(step => {
        const button = document.createElement("button");
        button.className = "step-option";
        button.textContent = step;

        button.addEventListener("click", () => {
          state.currentOrderSelection.push(step);
          state.selectedAnswer = [...state.currentOrderSelection];
          refreshSteps();
        });

        availableBox.appendChild(button);
      });

    state.currentOrderSelection.forEach((step, index) => {
      const button = document.createElement("button");
      button.className = "chosen-step";
      button.textContent = `${index + 1}. ${step}`;

      button.addEventListener("click", () => {
        state.currentOrderSelection = state.currentOrderSelection.filter(s => s !== step);
        state.selectedAnswer = [...state.currentOrderSelection];
        refreshSteps();
      });

      document.getElementById("chosenStepsBox").appendChild(button);
    });

    state.selectedAnswer = [...state.currentOrderSelection];
  }

  resetButton.addEventListener("click", () => {
    state.currentOrderSelection = [];
    state.selectedAnswer = [];
    refreshSteps();
  });

  refreshSteps();
}

export function renderResultPhase(challenge, submitResult) {
  // Clear the answer area and show full-screen result card
  dom.answerBox.innerHTML = "";
  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.add("hidden");
  dom.mistakeBox.classList.add("hidden");

  const isCorrect = submitResult?.isCorrect ?? false;
  const points    = submitResult?.points    ?? 0;

  const correctDisplay = challenge.type === "order_steps"
    ? challenge.correctOrder.join(" → ")
    : challenge.correctAnswer;

  const card = document.createElement("div");
  card.className = `result-phase-card ${isCorrect ? "result-correct" : "result-wrong"}`;
  card.innerHTML = `
    <div class="result-icon">${isCorrect ? "✅" : "❌"}</div>
    <h2 class="result-label">${isCorrect ? `+${points} points!` : "Wrong answer!"}</h2>
    <p class="result-answer">Correct answer: <strong>${escapeHTML(correctDisplay)}</strong></p>
    <p class="result-explanation muted">${escapeHTML(challenge.explanation || "")}</p>
  `;
  dom.answerBox.appendChild(card);
}

export function renderMiniLeaderboard(data, currentPack, isLast) {
  dom.answerBox.innerHTML = "";
  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.add("hidden");

  const total = currentPack ? currentPack.challenges.length : 8;
  const players = data?.leaderboard || [];

  const container = document.createElement("div");
  container.className = "mini-lb";

  const title = document.createElement("div");
  title.className = "mini-lb-title";
  title.innerHTML = `<span class="eyebrow">${isLast ? "🏁 Final standings" : "📊 Standings"}</span>
    <span id="lbCountdownText" class="mini-lb-countdown"></span>`;
  container.appendChild(title);

  players.slice(0, 8).forEach((p, i) => {
    const row = document.createElement("div");
    row.className = `mini-lb-row ${i === 0 ? "mini-lb-first" : ""}`;
    row.style.animationDelay = `${i * 0.05}s`;
    row.innerHTML = `
      <span class="mini-lb-rank">${p.rank}</span>
      <span class="mini-lb-name">${escapeHTML(p.name)}</span>
      <span class="mini-lb-score">${p.score}</span>
    `;
    container.appendChild(row);
  });

  dom.answerBox.appendChild(container);

  // Expose countdown element globally so loop can update it
  window.lbCountdownText = document.getElementById("lbCountdownText");
}

export function renderAnswerFeedback(data, isLastChallenge) {
  document.querySelectorAll(".option").forEach(button => {
    button.disabled = true;

    if (button.textContent === data.correctAnswer) {
      button.classList.add("correct");
    }

    if (button.textContent === state.selectedAnswer && !data.isCorrect) {
      button.classList.add("wrong");
    }
  });

  document.querySelectorAll(".step-option, .chosen-step").forEach(button => {
    button.disabled = true;
  });

  const fillInput = document.getElementById("fillBlankInput");
  if (fillInput) fillInput.disabled = true;

  dom.feedbackTitle.textContent = data.isCorrect ? `Correct +${data.points}` : "Review this";
  dom.feedbackTitle.style.color = data.isCorrect ? "var(--green)" : "var(--red)";

  dom.correctAnswerText.textContent = `Correct answer: ${data.correctAnswer}`;
  dom.explanationText.textContent = data.explanation || "";
  dom.sourceSnippet.textContent = data.sourceSnippet || "No source snippet available.";

  dom.submitAnswerBtn.classList.add("hidden");
  dom.feedbackBox.classList.remove("hidden");

  dom.nextChallengeBtn.textContent = isLastChallenge
    ? "Finish and wait for leaderboard"
    : "Next challenge";
}

export function renderPodium(data, currentPack) {
  dom.leaderboardList.innerHTML = "";

  const total = currentPack
    ? currentPack.challenges.length
    : data.totalChallenges || 8;

  const players = data.leaderboard;

  // ── Podium (top 3) ──
  if (players.length >= 2) {
    const podiumEl = document.createElement("div");
    podiumEl.className = "podium-container";

    // Order on podium: 2nd | 1st | 3rd  (visual layout)
    const podiumOrder = [
      players[1] ? { player: players[1], cls: "second", medal: "🥈", height: 110 } : null,
      players[0] ? { player: players[0], cls: "first",  medal: "🥇", height: 160 } : null,
      players[2] ? { player: players[2], cls: "third",  medal: "🥉", height: 70  } : null
    ].filter(Boolean);

    podiumOrder.forEach(({ player, cls, medal, height }) => {
      const place = document.createElement("div");
      place.className = `podium-place ${cls}`;
      place.innerHTML = `
        <div class="podium-avatar">${escapeHTML(player.name[0].toUpperCase())}</div>
        <div class="podium-name">${escapeHTML(player.name)}</div>
        <div class="podium-score">${player.score} pts</div>
        <div class="podium-block" style="height:${height}px">${medal}</div>
      `;
      podiumEl.appendChild(place);
    });

    dom.leaderboardList.appendChild(podiumEl);
  }

  // ── Full ranked list ──
  const listTitle = document.createElement("div");
  listTitle.className = "eyebrow";
  listTitle.style.marginBottom = "14px";
  listTitle.textContent = "Full standings";
  dom.leaderboardList.appendChild(listTitle);

  players.forEach(player => {
    const row = document.createElement("div");
    row.className = `leader-row ${player.rank === 1 ? "first" : ""}`;
    row.innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;">
        <div class="rank">${player.rank}</div>
        <div>
          <strong style="font-size:18px;">${escapeHTML(player.name)}</strong>
          <p class="muted" style="font-size:13px;">${player.correct}/${total} correct</p>
        </div>
      </div>
      <strong style="font-size:26px;">${player.score}</strong>
    `;
    dom.leaderboardList.appendChild(row);
  });

  // ── Weak concepts ──
  dom.groupWeakConcepts.innerHTML = "";
  if (!data.weakConcepts || data.weakConcepts.length === 0) {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = "No weak concepts detected";
    dom.groupWeakConcepts.appendChild(span);
  } else {
    data.weakConcepts.forEach(item => {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = `${item.concept} × ${item.count}`;
      dom.groupWeakConcepts.appendChild(span);
    });
  }
}

export function renderRecoveryLesson(lesson) {
  dom.lessonBox.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = lesson.title;
  dom.lessonBox.appendChild(title);

  const summary = document.createElement("p");
  summary.className = "muted";
  summary.textContent = lesson.summary;
  dom.lessonBox.appendChild(summary);

  if (!lesson.sections || lesson.sections.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pill";
    empty.textContent = "No missed concepts. Nice run.";
    dom.lessonBox.appendChild(empty);
    return;
  }

  lesson.sections.forEach(section => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.boxShadow = "5px 5px 0 var(--text)";
    card.style.marginTop = "8px";

    card.innerHTML = `
      <div class="eyebrow">${escapeHTML(section.concept)}</div>

      <h3 style="margin-top: 14px;">What went wrong</h3>
      <p class="muted" style="margin-top: 8px;">${escapeHTML(section.whatWentWrong)}</p>

      <h3 style="margin-top: 18px;">Mini lesson</h3>
      <p class="muted" style="margin-top: 8px;">${escapeHTML(section.miniLesson)}</p>

      <h3 style="margin-top: 18px;">Memory hook</h3>
      <p class="muted" style="margin-top: 8px;">${escapeHTML(section.memoryHook)}</p>

      <h3 style="margin-top: 18px;">Retry challenge</h3>
      <p style="margin-top: 8px; font-weight: 900;">${escapeHTML(section.retryChallenge)}</p>
    `;

    dom.lessonBox.appendChild(card);
  });
}
