export const RoomStatus = {
  LOBBY: "lobby",
  STARTED: "started",
  FINISHED: "finished",
  CLOSED: "closed"
};

export function makeRoom({ code, pack, questionTime = 20 }) {
  return {
    code,
    pack,
    status: RoomStatus.LOBBY,
    question_time: questionTime,
    started_at: null,
    ends_at: null,
    created_at: Date.now()
  };
}
