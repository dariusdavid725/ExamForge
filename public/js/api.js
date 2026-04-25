// Reads SSE stream from a POST request, calls onProgress for each progress event,
// resolves with the final data object on "done", rejects on "error".
export function generatePack(formData, onProgress) {
  return new Promise(async (resolve, reject) => {
    let response;

    try {
      response = await fetch("/api/generate-pack", {
        method: "POST",
        body: formData
      });
    } catch (err) {
      return reject(err);
    }

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      return reject(new Error(data.error || "Network error"));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let currentEvent = "message";

    const processLine = line => {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));

          if (currentEvent === "done") {
            resolve(data);
          } else if (currentEvent === "error") {
            reject(new Error(data.error || "Generation failed."));
          } else if (currentEvent === "progress" && onProgress) {
            onProgress(data.message);
          }
        } catch {
          // ignore malformed lines
        }

        currentEvent = "message";
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true
        });

        const lines = buffer.split("\n");

        buffer = lines.pop();

        for (const line of lines) {
          processLine(line);
        }
      }

      if (buffer) {
        processLine(buffer);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export async function createRoom(pack) {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ pack })
  });

  return {
    response,
    data: await response.json()
  };
}

export async function joinRoom(code, name, userId = null) {
  const response = await fetch(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      userId
    })
  });

  return {
    response,
    data: await response.json()
  };
}

export async function fetchRoom(code) {
  const response = await fetch(`/api/rooms/${code}`);

  return {
    response,
    data: await response.json()
  };
}

export async function startRoom(code) {
  const response = await fetch(`/api/rooms/${code}/start`, {
    method: "POST"
  });

  return {
    response,
    data: await response.json()
  };
}

export async function fetchPack(code) {
  const response = await fetch(`/api/rooms/${code}/pack`);

  return {
    response,
    data: await response.json()
  };
}

export async function submitAnswer(code, playerId, challengeIndex, selectedAnswer, timeLeft) {
  const response = await fetch(`/api/rooms/${code}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      playerId,
      challengeIndex,
      selectedAnswer,
      timeLeft
    })
  });

  return {
    response,
    data: await response.json()
  };
}

export async function nextRoom(code, playerId) {
  const response = await fetch(`/api/rooms/${code}/next`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ playerId })
  });

  return {
    response,
    data: await response.json()
  };
}

export async function fetchLeaderboard(code) {
  const response = await fetch(`/api/rooms/${code}/leaderboard`);

  return {
    response,
    data: await response.json()
  };
}

export async function generateLesson(code, playerId) {
  const response = await fetch(`/api/rooms/${code}/lesson`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ playerId })
  });

  return {
    response,
    data: await response.json()
  };
}