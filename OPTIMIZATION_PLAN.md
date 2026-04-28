# ExamForge Optimization Plan

## Phase 1: CRITICAL (Lansare - 1-2 ore)

### 1. Server Compression (Impact MARE: 60-70% reducere)
```javascript
// app.js - add compression middleware
import compression from 'compression';
app.use(compression());
```
**Beneficiu:** CSS 51KB → ~15KB, JS files reduse cu 70%

### 2. Cache Headers (Impact MARE: 90% reducere loading time pentru returning users)
```javascript
// app.js - cache static assets
app.use('/css', express.static('public/css', {
  maxAge: '7d',
  immutable: true
}));

app.use('/js', express.static('public/js', {
  maxAge: '7d',
  immutable: true
}));
```

### 3. Lazy Load CDNs (Impact MEDIU: ~150KB economisiți la load inițial)
- Supabase: încarcă doar pe pagini cu auth/database
- KaTeX: încarcă doar când sunt formule de randat
- QRCode/Confetti: încarcă doar în arena

### 4. Remove Duplicate CSS (Impact MIC: ~5KB)
- styles.css are multe reguli nefolosite
- Remove unused @media queries
- Combine repeated selectors

---

## Phase 2: IMPORTANT (Post-lansare - 3-4 ore)

### 5. Code Splitting
- Split JS per page (nu încărca lessons.js pe home)
- Dynamic imports pentru features

### 6. CSS Critical Path
- Inline critical CSS în `<head>`
- Defer non-critical CSS

### 7. Image Optimization
- Compress toate imaginile
- Use WebP cu PNG fallback
- Lazy load images below fold

### 8. Database Indexing
```sql
-- Supabase indexes pentru queries frecvente
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room ON players(room_code);
CREATE INDEX idx_learning_units_user ON learning_units(user_id);
```

---

## Phase 3: ADVANCED (Când ai trafic - 1-2 zile)

### 9. Service Worker
- Cache assets offline
- Stale-while-revalidate strategy

### 10. API Caching (Redis)
- Cache room data (5s)
- Cache leaderboards (10s)
- Cache user profiles (5min)

### 11. CDN pentru Assets
- Cloudflare/Vercel pentru static files
- Edge caching

---

## Metrics to Track

**Before:**
- FCP (First Contentful Paint): ~2.5s
- LCP (Largest Contentful Paint): ~4s
- TTI (Time to Interactive): ~5s
- Total page size: ~250KB

**Target After Phase 1:**
- FCP: <1s
- LCP: <2s
- TTI: <2.5s
- Total page size: ~80KB

**Target After Phase 2:**
- FCP: <0.8s
- LCP: <1.5s
- TTI: <2s
- Lighthouse score: >90
