# 🚀 ExamForge — Launch Checklist

**Status:** Ready for launch after completing Priority 1 & 2

---

## ⚡ PRIORITY 1 — Must Have (2-3h total)

### 1.1 Legal Pages (1h)
**Why:** Required by law (GDPR, consumer protection)

- [ ] `/privacy` — Privacy Policy
- [ ] `/terms` — Terms of Service  
- [ ] Add footer links to all pages

**Quick win:** Use [GetTerms.io](https://getterms.io) generator → customize company name

---

### 1.2 Security (30min)
**Why:** Prevent abuse, protect API costs

- [ ] Rate limiting on API routes
  ```bash
  npm install express-rate-limit
  ```
  ```js
  // app.js
  import rateLimit from 'express-rate-limit';
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, try again later'
  });
  
  app.use('/api/', limiter);
  ```

---

### 1.3 Error Monitoring (30min)
**Why:** Know when users hit bugs in production

- [ ] [Sentry.io](https://sentry.io) account (free tier)
- [ ] Add to `app.js`:
  ```js
  import * as Sentry from "@sentry/node";
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production'
  });
  
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
  ```

---

### 1.4 Basic SEO (30min)
**Why:** Google needs to know what your site does

- [ ] Add meta tags to all pages (use snippet below)
- [ ] Create `robots.txt` in `/public`
- [ ] Create `sitemap.xml` in `/public`

**Meta tags template:**
```html
<meta name="description" content="Create AI-powered study quizzes and compete with friends in real-time">
<meta property="og:title" content="ExamForge — Multiplayer Study Challenges">
<meta property="og:description" content="Turn any topic into engaging quizzes with AI">
<meta property="og:image" content="https://yoursite.com/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
```

---

### 1.5 Branding Assets (20min)
**Why:** Professional appearance in browser tabs, bookmarks, phones

- [ ] Favicon (16x16, 32x32, 180x180)
- [ ] Apple touch icon (180x180)
- [ ] Add to `<head>`:
  ```html
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  ```

**Quick win:** Use [Favicon.io](https://favicon.io) generator with letter "E"

---

## 🔥 PRIORITY 2 — Should Have (3-4h total)

### 2.1 Error Pages (30min)
**Why:** Better UX when things go wrong

- [ ] Create `/public/pages/404.html`
- [ ] Create `/public/pages/500.html`
- [ ] Add fallback route in `app.js`:
  ```js
  app.use((req, res) => {
    res.status(404).sendFile(pub('404.html'));
  });
  ```

---

### 2.2 Analytics (20min)
**Why:** Track growth, user behavior, conversions

- [ ] [Plausible Analytics](https://plausible.io) (privacy-friendly, GDPR compliant)
  ```html
  <script defer data-domain="yoursite.com" 
    src="https://plausible.io/js/script.js"></script>
  ```
- [ ] Track key events:
  - Sign ups
  - Quiz creations
  - Premium upgrades

---

### 2.3 Email System (1-2h)
**Why:** Welcome users, recover passwords, send invoices

- [ ] [Resend.com](https://resend.com) account (3000 free emails/month)
- [ ] Create email templates:
  - Welcome email (after sign up)
  - Password reset
  - Premium upgrade confirmation
- [ ] Test all emails

---

### 2.4 Database Optimization (30min)
**Why:** Queries will slow down as users grow

Run in Supabase SQL Editor:
```sql
-- Rooms by status
CREATE INDEX idx_rooms_status_created ON rooms(status, created_at DESC);

-- Players lookup
CREATE INDEX idx_players_user_id ON players(user_id) 
WHERE user_id IS NOT NULL;

-- Learning paths
CREATE INDEX idx_learning_units_user_path ON learning_units(user_id, path_id);

-- Progress tracking
CREATE INDEX idx_user_progress_user_concept ON user_progress(user_id, concept_id);

-- Quiz history
CREATE INDEX idx_product_events_user_created ON product_events(user_id, created_at DESC);
```

---

### 2.5 Loading States (1h)
**Why:** Users need feedback that something is happening

- [ ] All buttons show loading spinner when clicked
- [ ] Empty states with helpful CTAs:
  - "No quizzes yet → Create your first quiz"
  - "No friends yet → Invite friends"
- [ ] Skeleton loaders on dashboard/lessons (replace spinners)

---

### 2.6 Form Validation (30min)
**Why:** Prevent errors before submission

- [ ] All forms show inline errors
- [ ] Required fields marked with *
- [ ] Email format validation
- [ ] Password strength indicator
- [ ] Disable submit until valid

---

## 💡 PRIORITY 3 — Nice to Have (Post-launch)

### 3.1 Onboarding (2h)
- [ ] Welcome modal for new users
- [ ] Interactive tutorial (create first quiz)
- [ ] Feature highlights (tooltips)

### 3.2 Mobile PWA (2h)
- [ ] Add `manifest.json`
- [ ] Service worker for offline
- [ ] "Add to Home Screen" prompt

### 3.3 Advanced Features
- [ ] Export quiz results (PDF/CSV)
- [ ] Share quiz on social media
- [ ] Referral system (invite = free premium days)
- [ ] Keyboard shortcuts

### 3.4 Marketing Setup
- [ ] Landing page A/B test
- [ ] Drip email campaign
- [ ] Blog for SEO
- [ ] YouTube demo video

---

## ✅ Pre-Launch Testing (1h)

**Test these flows end-to-end:**

- [ ] Sign up → verify email → login
- [ ] Create quiz (PDF) → start arena
- [ ] Join arena with code → complete quiz
- [ ] Upgrade to premium → verify Stripe charge
- [ ] Cancel subscription → verify downgrade
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)
- [ ] Desktop (Chrome, Firefox, Safari)
- [ ] Slow 3G connection (throttle in DevTools)

**Check visuals:**
- [ ] All pages look good on 375px (iPhone SE)
- [ ] All pages look good on 1920px (desktop)
- [ ] Dark/light theme toggle works everywhere
- [ ] No console errors on any page

---

## 📊 Launch Day (Launch morning)

- [ ] Deploy to Railway in production mode
- [ ] Stripe in live mode (not test)
- [ ] Database backup taken
- [ ] Monitoring dashboard open
- [ ] Have rollback plan ready
- [ ] Monitor first 10 sign-ups closely
- [ ] Announce on social media
- [ ] Email beta testers (if any)

---

## 🎯 Success Metrics (Track weekly)

**Growth:**
- Sign ups (target: 10/day → 50/day in 30 days)
- Active users (DAU/MAU)
- Conversion rate (free → paid, target: 2-5%)

**Engagement:**
- Quizzes created/user
- Quiz completion rate
- Average session duration

**Revenue:**
- MRR (Monthly Recurring Revenue)
- Churn rate (target: <5%/month)
- LTV (Lifetime Value)

---

## 🚨 Already Completed ✅

- [x] Server compression (70% size reduction)
- [x] Cache headers (7 days for static assets)
- [x] Lobby UI polished
- [x] Host verification bug fixed
- [x] Payment integration (Stripe)
- [x] Core features (quizzes, learning paths, arena)

---

## ⏱️ Time Estimate

- **Priority 1:** 2-3 hours → **Launch ready**
- **Priority 2:** 3-4 hours → **Polished launch**
- **Priority 3:** Ongoing → **Growth phase**

**Recommended:** Complete Priority 1 today, Priority 2 this week, Priority 3 over next month.

---

## 📞 Support Channels (Set up before launch)

- [ ] Email: support@examforge.com
- [ ] Feedback widget in app ([Canny](https://canny.io))
- [ ] FAQ page with common questions
- [ ] Discord community (optional)
