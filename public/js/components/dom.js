export const screens = {
  auth:        document.getElementById("authScreen"),
  dashboard:   document.getElementById("dashboardScreen"),
  history:     document.getElementById("historyScreen"),
  home:        document.getElementById("homeScreen"),
  lobby:       document.getElementById("lobbyScreen"),
  challenge:   document.getElementById("challengeScreen"),
  waiting:     document.getElementById("waitingResultsScreen"),
  leaderboard: document.getElementById("leaderboardScreen")
};

// Auth
export const authTabLogin    = document.getElementById("authTabLogin");
export const authTabRegister = document.getElementById("authTabRegister");
export const loginForm       = document.getElementById("loginForm");
export const registerForm    = document.getElementById("registerForm");
export const loginEmail      = document.getElementById("loginEmail");
export const loginPassword   = document.getElementById("loginPassword");
export const loginBtn        = document.getElementById("loginBtn");
export const loginError      = document.getElementById("loginError");
export const registerEmail   = document.getElementById("registerEmail");
export const registerPassword = document.getElementById("registerPassword");
export const registerUsername = document.getElementById("registerUsername");
export const registerBtn     = document.getElementById("registerBtn");
export const registerError   = document.getElementById("registerError");

// Dashboard
export const dashboardContent  = document.getElementById("dashboardContent");
export const headerUserArea    = document.getElementById("headerUserArea");
export const headerBell        = document.getElementById("headerBell");
export const bellBadge         = document.getElementById("bellBadge");
export const headerStreak      = document.getElementById("headerStreak");

// Home screen
export const hostNameInput   = document.getElementById("hostNameInput");
export const fileInput       = document.getElementById("fileInput");
export const dropZone        = document.getElementById("dropZone");
export const fileName        = document.getElementById("fileName");
export const createArenaBtn  = document.getElementById("createArenaBtn");
export const hostStatusText  = document.getElementById("hostStatusText");
export const joinCodeInput   = document.getElementById("joinCodeInput");
export const joinNameInput   = document.getElementById("joinNameInput");
export const joinArenaBtn    = document.getElementById("joinArenaBtn");
export const joinStatusText  = document.getElementById("joinStatusText");

// Lobby
export const roomCodeText    = document.getElementById("roomCodeText");
export const roomTitleText   = document.getElementById("roomTitleText");
export const roomSummaryText = document.getElementById("roomSummaryText");
export const conceptsList    = document.getElementById("conceptsList");
export const startArenaBtn   = document.getElementById("startArenaBtn");
export const copyLinkBtn     = document.getElementById("copyLinkBtn");
export const lobbyStatusText = document.getElementById("lobbyStatusText");
export const qrCanvas        = document.getElementById("qrCanvas");
export const joinLinkText    = document.getElementById("joinLinkText");
export const playersList     = document.getElementById("playersList");
export const playerCountText = document.getElementById("playerCountText");

// Challenge
export const playerNameText     = document.getElementById("playerNameText");
export const progressText       = document.getElementById("progressText");
export const progressBar        = document.getElementById("progressBar");
export const scoreText          = document.getElementById("scoreText");
export const challengeNumberText = document.getElementById("challengeNumberText");
export const viewLeaderboardBtn  = document.getElementById("viewLeaderboardBtn");
export const typeTag             = document.getElementById("typeTag");
export const conceptTag          = document.getElementById("conceptTag");
export const difficultyTag       = document.getElementById("difficultyTag");
export const timerRing           = document.getElementById("timerRing");
export const timerText           = document.getElementById("timerText");
export const mistakeBox          = document.getElementById("mistakeBox");
export const mistakeText         = document.getElementById("mistakeText");
export const challengePromptText = document.getElementById("challengePromptText");
export const answerBox           = document.getElementById("answerBox");
export const submitAnswerBtn     = document.getElementById("submitAnswerBtn");
export const feedbackBox         = document.getElementById("feedbackBox");
export const feedbackTitle       = document.getElementById("feedbackTitle");
export const correctAnswerText   = document.getElementById("correctAnswerText");
export const explanationText     = document.getElementById("explanationText");
export const sourceSnippet       = document.getElementById("sourceSnippet");
export const nextChallengeBtn    = document.getElementById("nextChallengeBtn");

// Waiting
export const waitingSecondsText = document.getElementById("waitingSecondsText");

// Leaderboard
export const leaderboardList    = document.getElementById("leaderboardList");
export const groupWeakConcepts  = document.getElementById("groupWeakConcepts");
export const generateLessonBtn  = document.getElementById("generateLessonBtn");
export const lessonBox          = document.getElementById("lessonBox");
