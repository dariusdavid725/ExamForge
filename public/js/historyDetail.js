export async function showHistoryDetailModal(sessionId, supabase) {
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    alert("Could not load session details.");
    return;
  }

  const { data: results } = await supabase
    .from("game_results")
    .select("*")
    .eq("session_id", sessionId)
    .order("rank", {
      ascending: true
    });

  const pack = session.pack || {};
  const challenges = Array.isArray(pack.challenges) ? pack.challenges : [];
  const sortedResults = results || [];

  injectHistoryDetailStyles();

  const overlay = document.createElement("div");
  overlay.className = "ef-history-overlay";

  overlay.innerHTML = `
    <div class="ef-history-modal card">
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <p class="eyebrow">Match details</p>

          <h2 style="margin-top:14px;">
            ${escapeHTML(session.title || "Quiz")}
          </h2>

          <p class="muted" style="margin-top:8px;">
            ${escapeHTML(session.category || "Quiz")}
            · ${session.player_count || 0} players
            · ${formatDateTime(session.played_at)}
          </p>

          <p class="muted">
            Document: ${escapeHTML(session.document_name || "document")}
          </p>
        </div>

        <button id="closeHistoryModal" class="btn btn-secondary" type="button">
          ✕
        </button>
      </div>

      <div class="dash-stats-row" style="margin-top:22px;">
        <div class="dash-stat">
          <div class="dash-stat-val">${session.challenge_count || challenges.length || 0}</div>
          <div class="dash-stat-label">Challenges</div>
        </div>

        <div class="dash-stat">
          <div class="dash-stat-val">${session.player_count || sortedResults.length || 0}</div>
          <div class="dash-stat-label">Players</div>
        </div>

        <div class="dash-stat">
          <div class="dash-stat-val" style="font-size:20px;">
            ${escapeHTML(session.room_code || "-")}
          </div>
          <div class="dash-stat-label">Room code</div>
        </div>
      </div>

      <section class="ef-history-section">
        <h3>Leaderboard</h3>
        <div class="ef-history-list">
          ${renderResults(sortedResults)}
        </div>
      </section>

      <section class="ef-history-section">
        <h3>Questions</h3>
        <div class="ef-history-list">
          ${renderQuestions(challenges)}
        </div>
      </section>

      <section class="ef-history-section">
        <h3>Player answers</h3>
        <div class="ef-history-list">
          ${renderPlayerAnswers(sortedResults, challenges)}
        </div>
      </section>

      <section class="ef-history-section">
        <h3>Document</h3>

        ${
          session.document_preview || session.document_text
            ? `
              <div class="ef-document-box">
                ${escapeHTML(session.document_preview || session.document_text)}
              </div>

              <div class="row" style="margin-top:12px;">
                <button id="copyDocumentBtn" class="btn btn-secondary" type="button">
                  Copy text
                </button>

                <button id="downloadDocumentBtn" class="btn" type="button">
                  Download .txt
                </button>
              </div>
            `
            : `
              <p class="muted">No document text saved for this match.</p>
            `
        }
      </section>

      ${
        session.conspect
          ? `
            <section class="ef-history-section">
              <h3>Study notes</h3>
              <div class="ef-document-box">
                ${escapeHTML(formatConspect(session.conspect))}
              </div>
            </section>
          `
          : ""
      }
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#closeHistoryModal")?.addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  overlay.querySelector("#copyDocumentBtn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(
        session.document_text || session.document_preview || ""
      );

      alert("Document copied.");
    } catch {
      alert("Could not copy.");
    }
  });

  overlay.querySelector("#downloadDocumentBtn")?.addEventListener("click", () => {
    const text = session.document_text || session.document_preview || "";

    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${safeFileName(session.document_name || session.title || "document")}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  });
}

function renderResults(results) {
  if (!results.length) {
    return `<p class="muted">No saved results.</p>`;
  }

  return results
    .map(result => {
      return `
        <div class="dash-session-row" style="cursor:default;">
          <div class="row" style="gap:12px; min-width:0;">
            <span class="rank">#${result.rank}</span>

            <div style="min-width:0;">
              <strong>${escapeHTML(result.player_name || "Player")}</strong>

              <p class="muted">
                ${result.correct_count || 0}/${result.total_answered || 0} correct
                ${
                  Array.isArray(result.weak_concepts) && result.weak_concepts.length
                    ? `· Weak: ${escapeHTML(result.weak_concepts.join(", "))}`
                    : ""
                }
              </p>
            </div>
          </div>

          <strong>${result.score || 0} pts</strong>
        </div>
      `;
    })
    .join("");
}

function renderQuestions(challenges) {
  if (!challenges.length) {
    return `<p class="muted">No pack saved.</p>`;
  }

  return challenges
    .map((challenge, index) => {
      return `
        <details class="ef-history-details-card">
          <summary>
            <strong>Q${index + 1}. ${escapeHTML(challenge.concept || challenge.type || "Challenge")}</strong>
            <span>${escapeHTML(challenge.type || "")}</span>
          </summary>

          <div class="ef-history-detail-body">
            <p><strong>Prompt:</strong> ${escapeHTML(challenge.prompt || "")}</p>

            ${
              challenge.mistakeText
                ? `<p><strong>Mistake:</strong> ${escapeHTML(challenge.mistakeText)}</p>`
                : ""
            }

            ${renderCorrectAnswer(challenge)}

            ${
              Array.isArray(challenge.options) && challenge.options.length
                ? `
                  <p><strong>Options:</strong></p>
                  <ul>
                    ${challenge.options
                      .map(option => `<li>${escapeHTML(option)}</li>`)
                      .join("")}
                  </ul>
                `
                : ""
            }

            ${
              Array.isArray(challenge.pairs) && challenge.pairs.length
                ? `
                  <p><strong>Pairs:</strong></p>
                  <ul>
                    ${challenge.pairs
                      .map(pair => {
                        return `<li>${escapeHTML(pair.left)} → ${escapeHTML(pair.right)}</li>`;
                      })
                      .join("")}
                  </ul>
                `
                : ""
            }

            <p><strong>Explanation:</strong> ${escapeHTML(challenge.explanation || "")}</p>
            <p class="muted"><strong>Source:</strong> ${escapeHTML(challenge.sourceSnippet || "")}</p>
          </div>
        </details>
      `;
    })
    .join("");
}

function renderCorrectAnswer(challenge) {
  if (challenge.type === "multiple_select") {
    return `
      <p>
        <strong>Correct answers:</strong>
        ${escapeHTML((challenge.correctAnswers || []).join(", "))}
      </p>
    `;
  }

  if (challenge.type === "order_steps") {
    return `
      <p>
        <strong>Correct order:</strong>
        ${escapeHTML((challenge.correctOrder || []).join(" → "))}
      </p>
    `;
  }

  if (challenge.type === "matching") {
    return `
      <p>
        <strong>Correct pairs:</strong>
        ${escapeHTML(
          (challenge.pairs || [])
            .map(pair => `${pair.left} → ${pair.right}`)
            .join(", ")
        )}
      </p>
    `;
  }

  return `
    <p>
      <strong>Correct answer:</strong>
      ${escapeHTML(challenge.correctAnswer || "")}
    </p>
  `;
}

function renderPlayerAnswers(results, challenges) {
  const withAnswers = results.filter(result => {
    return Array.isArray(result.answers) && result.answers.length > 0;
  });

  if (!withAnswers.length) {
    return `<p class="muted">No detailed answers saved for this match.</p>`;
  }

  return withAnswers
    .map(result => {
      return `
        <details class="ef-history-details-card">
          <summary>
            <strong>${escapeHTML(result.player_name || "Player")}</strong>
            <span>${result.score || 0} pts</span>
          </summary>

          <div class="ef-history-detail-body">
            ${result.answers
              .map(answer => {
                const challenge = challenges[answer.challengeIndex] || {};

                return `
                  <div class="ef-answer-review ${answer.isCorrect ? "ef-answer-ok" : answer.isPartial ? "ef-answer-partial" : "ef-answer-bad"}">
                    <p>
                      <strong>Q${Number(answer.challengeIndex) + 1}:</strong>
                      ${escapeHTML(challenge.prompt || "")}
                    </p>

                    <p>
                      <strong>Selected:</strong>
                      ${escapeHTML(formatSelectedAnswer(answer.selectedAnswer))}
                    </p>

                    <p>
                      <strong>Correct:</strong>
                      ${escapeHTML(answer.correctAnswer || "")}
                    </p>

                    <p class="muted">
                      ${answer.isCorrect ? "Correct" : answer.isPartial ? "Partial" : "Wrong"}
                      · ${answer.points || 0} pts
                    </p>
                  </div>
                `;
              })
              .join("")}
          </div>
        </details>
      `;
    })
    .join("");
}

function formatSelectedAnswer(value) {
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object") {
      return value
        .map(item => `${item.left || ""} → ${item.right || ""}`)
        .join(", ");
    }

    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value ?? "");
}

function formatConspect(conspect) {
  if (typeof conspect === "string") return conspect;

  try {
    return JSON.stringify(conspect, null, 2);
  } catch {
    return String(conspect || "");
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function safeFileName(value) {
  return String(value || "document")
    .replace(/[^\w\d-_]+/g, "_")
    .slice(0, 80);
}

function injectHistoryDetailStyles() {
  if (document.getElementById("ef-history-detail-styles")) return;

  const style = document.createElement("style");
  style.id = "ef-history-detail-styles";

  style.textContent = `
    .ef-history-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.55);
      padding: 28px;
      overflow: auto;
    }

    .ef-history-modal {
      max-width: 1050px;
      width: min(1050px, calc(100vw - 56px));
      margin: 0 auto;
      max-height: calc(100vh - 56px);
      overflow: auto;
    }

    .ef-history-section {
      margin-top: 26px;
    }

    .ef-history-list {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }

    .ef-history-details-card {
      border: 3px solid var(--text, #111);
      border-radius: 14px;
      padding: 14px;
      background: var(--paper, #fffaf0);
      box-shadow: 4px 4px 0 var(--text, #111);
    }

    .ef-history-details-card summary {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-weight: 900;
    }

    .ef-history-detail-body {
      margin-top: 14px;
      display: grid;
      gap: 10px;
    }

    .ef-document-box {
      margin-top: 12px;
      max-height: 260px;
      overflow: auto;
      white-space: pre-wrap;
      border: 3px solid var(--text, #111);
      border-radius: 14px;
      padding: 14px;
      background: white;
      font-size: 0.92rem;
      line-height: 1.5;
      font-weight: 700;
    }

    .ef-answer-review {
      border: 3px solid var(--text, #111);
      border-radius: 14px;
      padding: 12px;
      background: white;
      display: grid;
      gap: 6px;
    }

    .ef-answer-ok {
      background: #ecfff4;
    }

    .ef-answer-partial {
      background: #fff8db;
    }

    .ef-answer-bad {
      background: #fff0f0;
    }

    @media (max-width: 720px) {
      .ef-history-overlay {
        padding: 14px;
      }

      .ef-history-modal {
        width: calc(100vw - 28px);
        max-height: calc(100vh - 28px);
      }
    }
  `;

  document.head.appendChild(style);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}