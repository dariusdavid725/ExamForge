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
    .order("rank", { ascending: true });

  const pack = session.pack || {};
  const challenges = Array.isArray(pack.challenges) ? pack.challenges : [];
  const sortedResults = results || [];

  const overlay = document.createElement("div");
  overlay.className = "history-modal-overlay";

  overlay.innerHTML = `
    <div class="history-modal">
      <div class="history-modal-header">
        <div>
          <p class="eyebrow">Match details</p>
          <h2>${escapeHTML(session.title || "Quiz")}</h2>
          <p class="muted">
            ${escapeHTML(session.category || "Quiz")}
            · ${session.player_count || 0} players
            · ${new Date(session.played_at).toLocaleString()}
          </p>
        </div>

        <button id="closeHistoryModal" class="btn btn-secondary" type="button">
          ✕
        </button>
      </div>

      <div class="history-detail-grid">
        <div class="stat-card">
          <strong>${session.challenge_count || challenges.length || 0}</strong>
          <span>Challenges</span>
        </div>

        <div class="stat-card">
          <strong>${session.player_count || sortedResults.length || 0}</strong>
          <span>Players</span>
        </div>

        <div class="stat-card">
          <strong>${escapeHTML(session.room_code || "-")}</strong>
          <span>Room code</span>
        </div>
      </div>

      <div class="history-section">
        <h3>Leaderboard</h3>
        <div class="history-list">
          ${renderResults(sortedResults)}
        </div>
      </div>

      <div class="history-section">
        <h3>Questions</h3>
        <div class="history-list">
          ${renderQuestions(challenges)}
        </div>
      </div>

      <div class="history-section">
        <h3>Player answers</h3>
        <div class="history-list">
          ${renderPlayerAnswers(sortedResults, challenges)}
        </div>
      </div>

      <div class="history-section">
        <h3>Document</h3>

        <p class="muted">
          ${escapeHTML(session.document_name || "document")}
        </p>

        ${
          session.document_preview || session.document_text
            ? `
              <div class="document-box">
                ${escapeHTML(session.document_preview || session.document_text)}
              </div>

              <div class="row" style="margin-top:12px;">
                <button id="copyDocumentBtn" class="btn btn-secondary" type="button">
                  Copy document text
                </button>

                <button id="downloadDocumentBtn" class="btn" type="button">
                  Download .txt
                </button>
              </div>
            `
            : `<p class="muted">No document text saved for this match.</p>`
        }
      </div>

      ${
        session.conspect
          ? `
            <div class="history-section">
              <h3>Study notes</h3>
              <div class="document-box">
                ${escapeHTML(formatConspect(session.conspect))}
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;

  document.body.appendChild(overlay);
  injectHistoryModalStyles();

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
      await navigator.clipboard.writeText(session.document_text || session.document_preview || "");
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
        <div class="history-row">
          <span class="rank">#${result.rank}</span>

          <div>
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
        <details class="history-details-card">
          <summary>
            <strong>Q${index + 1}. ${escapeHTML(challenge.concept || challenge.type || "Challenge")}</strong>
            <span>${escapeHTML(challenge.type || "")}</span>
          </summary>

          <div class="history-detail-body">
            <p><strong>Prompt:</strong> ${escapeHTML(challenge.prompt || "")}</p>

            ${
              challenge.mistakeText
                ? `<p><strong>Mistake:</strong> ${escapeHTML(challenge.mistakeText)}</p>`
                : ""
            }

            ${renderChallengeCorrectAnswer(challenge)}

            ${
              Array.isArray(challenge.options) && challenge.options.length
                ? `
                  <p><strong>Options:</strong></p>
                  <ul>
                    ${challenge.options.map(option => `<li>${escapeHTML(option)}</li>`).join("")}
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
                      .map(pair => `<li>${escapeHTML(pair.left)} → ${escapeHTML(pair.right)}</li>`)
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

function renderChallengeCorrectAnswer(challenge) {
  if (challenge.type === "multiple_select") {
    return `<p><strong>Correct answers:</strong> ${escapeHTML((challenge.correctAnswers || []).join(", "))}</p>`;
  }

  if (challenge.type === "order_steps") {
    return `<p><strong>Correct order:</strong> ${escapeHTML((challenge.correctOrder || []).join(" → "))}</p>`;
  }

  if (challenge.type === "matching") {
    return `<p><strong>Correct pairs:</strong> ${escapeHTML((challenge.pairs || []).map(pair => `${pair.left} → ${pair.right}`).join(", "))}</p>`;
  }

  return `<p><strong>Correct answer:</strong> ${escapeHTML(challenge.correctAnswer || "")}</p>`;
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
        <details class="history-details-card">
          <summary>
            <strong>${escapeHTML(result.player_name || "Player")}</strong>
            <span>${result.score || 0} pts</span>
          </summary>

          <div class="history-detail-body">
            ${result.answers
              .map(answer => {
                const challenge = challenges[answer.challengeIndex] || {};

                return `
                  <div class="answer-review ${answer.isCorrect ? "answer-ok" : answer.isPartial ? "answer-partial" : "answer-bad"}">
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

function safeFileName(value) {
  return String(value || "document")
    .replace(/[^\w\d-_]+/g, "_")
    .slice(0, 80);
}

function injectHistoryModalStyles() {
  if (document.getElementById("history-modal-styles")) return;

  const style = document.createElement("style");
  style.id = "history-modal-styles";

  style.textContent = `
    .history-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 9999;
      padding: 32px;
      overflow: auto;
    }

    .history-modal {
      max-width: 1050px;
      margin: 0 auto;
      background: var(--surface, #fff);
      color: var(--text, #111);
      border: 3px solid var(--text, #111);
      border-radius: 22px;
      box-shadow: 10px 10px 0 var(--text, #111);
      padding: 28px;
    }

    .history-modal-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .history-detail-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 22px;
    }

    .history-section {
      margin-top: 28px;
    }

    .history-list {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }

    .history-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 14px;
      align-items: center;
      border: 2px solid var(--text, #111);
      border-radius: 16px;
      padding: 14px;
      background: #fff;
    }

    .history-details-card {
      border: 2px solid var(--text, #111);
      border-radius: 16px;
      padding: 14px;
      background: #fff;
    }

    .history-details-card summary {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      gap: 14px;
    }

    .history-detail-body {
      margin-top: 14px;
      display: grid;
      gap: 10px;
    }

    .document-box {
      margin-top: 12px;
      max-height: 260px;
      overflow: auto;
      white-space: pre-wrap;
      border: 2px solid var(--text, #111);
      border-radius: 16px;
      padding: 14px;
      background: #f8f8f8;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .answer-review {
      border: 2px solid var(--text, #111);
      border-radius: 14px;
      padding: 12px;
      background: #fff;
      display: grid;
      gap: 6px;
    }

    .answer-ok {
      background: #ecfff4;
    }

    .answer-partial {
      background: #fff8db;
    }

    .answer-bad {
      background: #fff0f0;
    }

    @media (max-width: 720px) {
      .history-modal-overlay {
        padding: 14px;
      }

      .history-detail-grid {
        grid-template-columns: 1fr;
      }

      .history-modal-header {
        flex-direction: column;
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