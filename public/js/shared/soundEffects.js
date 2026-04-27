// Sound effects for arena experience
// Toggle with localStorage preference

const SOUNDS = {
  correct: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBg4aJjI+Sk5WXmZqbm5uampmXlZOSj4yJhoOBfnx5d3RyZGRkYGBcWFdUUk9NS0lGREI/PTs5NzQyMC4sKignJSQiIR8eHRwbGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQAA",
  wrong: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAAB/fXt5d3VzcW9ta2llY2FfXVtZV1VTUVBOTEpJR0ZFREJBP0A+PTw7OTk4Nzc2NTU0NDMzMzMzMzIzMzMzNDQ1NTY3Nzg5OTo7PD0+P0BBQkNERkdISkxOUFJUVlhbXV9hY2VnaWttb3FzdXd5e32A",
  timer: "data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YUAAAAB/gIGDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8Q=",
  finish: "data:audio/wav;base64,UklGRtADAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YawDAACAgYKDhYaHiImKi4yOj5CRkpOVlpeYmZqbnJ2en6ChoqOkpqeoqaqrrK2ur7CxsrO0tbe4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAA=="
};

let audioCache = {};
let soundEnabled = localStorage.getItem("ef_sound") !== "false";

function loadSound(key) {
  if (audioCache[key]) return audioCache[key];
  const audio = new Audio(SOUNDS[key]);
  audio.volume = 0.3;
  audioCache[key] = audio;
  return audio;
}

export function playSound(key) {
  if (!soundEnabled || !SOUNDS[key]) return;
  try {
    const audio = loadSound(key);
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("ef_sound", soundEnabled ? "true" : "false");
  return soundEnabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}
