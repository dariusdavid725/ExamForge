/**
 * Add preload/prefetch hints for critical resources
 * Improves perceived performance
 */

export function addPreloadHints() {
  // Preload critical CSS
  const cssPreload = document.createElement('link');
  cssPreload.rel = 'preload';
  cssPreload.as = 'style';
  cssPreload.href = '/css/styles.css';
  document.head.appendChild(cssPreload);

  // DNS prefetch for CDNs
  const cdnHosts = [
    'https://cdn.jsdelivr.net',
    'https://fonts.googleapis.com'
  ];

  cdnHosts.forEach(host => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = host;
    document.head.appendChild(link);
  });
}

export function prefetchNextPage(url) {
  if (!url) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

// Auto-prefetch likely next pages based on current page
export function setupSmartPrefetch() {
  const currentPath = window.location.pathname;
  
  const prefetchMap = {
    '/': ['/login', '/pricing'],
    '/login': ['/dashboard'],
    '/dashboard': ['/create', '/lessons', '/arena'],
    '/create': ['/arena'],
    '/lessons': ['/create']
  };

  const nextPages = prefetchMap[currentPath];
  if (nextPages) {
    // Prefetch after 2 seconds of idle
    setTimeout(() => {
      nextPages.forEach(page => prefetchNextPage(page));
    }, 2000);
  }
}
