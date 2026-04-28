/**
 * Lazy load external CDN scripts only when needed
 * Reduces initial page load by ~150KB
 */

const loadedScripts = new Set();

export async function loadSupabase() {
  if (typeof supabase !== 'undefined' || loadedScripts.has('supabase')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = () => {
      loadedScripts.add('supabase');
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadKaTeX() {
  if (typeof katex !== 'undefined' || loadedScripts.has('katex')) {
    return Promise.resolve();
  }

  loadedScripts.add('katex');

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
  document.head.appendChild(link);

  // Load main script
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // Load auto-render extension
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadQRCode() {
  if (typeof QRCode !== 'undefined' || loadedScripts.has('qrcode')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js';
    script.onload = () => {
      loadedScripts.add('qrcode');
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadConfetti() {
  if (typeof confetti !== 'undefined' || loadedScripts.has('confetti')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
    script.onload = () => {
      loadedScripts.add('confetti');
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
