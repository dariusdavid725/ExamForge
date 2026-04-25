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
  earlyResult: false,          // all players answered before timer
  lastPollTime: 0,
  syncLoop: null,

  packLoading: false,
  lobbyPoll: null,
  arenaEndWatcher: null,
  timer: null
};
