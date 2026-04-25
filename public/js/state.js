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

  // Synced game loop
  answeredCurrentChallenge: false,
  lastSubmitResult: null,
  syncLoop: null,

  // Guard flags
  packLoading: false,

  // Interval handles
  lobbyPoll: null,
  arenaEndWatcher: null,
  waitingResultsTimer: null,
  timer: null
};
