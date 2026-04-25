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
  arenaEndsAt: null,
  selectedGameMode: "arena_mix",

  // Guard flags
  packLoading: false,

  // Interval handles
  timer: null,
  lobbyPoll: null,
  arenaEndWatcher: null,
  waitingResultsTimer: null
};
