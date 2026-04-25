export const state = {
  // Auth
  currentUser:    null,
  userProfile:    null,

  // Game
  isHost: false,
  currentRoomCode: "",
  currentPlayerId: "",
  currentPlayerName: "",
  currentPack: null,
  currentChallengeIndex: 0,
  selectedAnswer: null,
  currentOrderSelection: [],
  localScore: 0,
  timeLeft: 20,
  questionTime: 20,
  startedAt: null,
  arenaEndsAt: null,
  selectedGameMode: "arena_mix",
  documentName: "",
  documentText: "",

  // Synced loop
  answeredCurrentChallenge: false,
  lastSubmitResult: null,
  cachedLeaderboard: null,
  earlyResult: false,
  lastPollTime: 0,
  syncLoop: null,

  // Guards
  packLoading: false,

  // Intervals
  lobbyPoll: null,
  arenaEndWatcher: null,
  timer: null
};
