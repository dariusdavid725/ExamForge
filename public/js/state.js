export const state = {
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

  // Synced loop
  answeredCurrentChallenge: false,
  lastSubmitResult: null,
  cachedLeaderboard: null,
  syncLoop: null,

  // Guard
  packLoading: false,

  // Intervals
  lobbyPoll: null,
  arenaEndWatcher: null,
  waitingResultsTimer: null,
  timer: null
};
