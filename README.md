# Structura proiectului — ExamForge AI

## Ce este proiectul?

**ExamForge AI** este o platformă de studiu cu AI care permite:
- Generarea automată de quiz-uri și lecții din orice document PDF sau subiect scris
- Arena multiplayer în timp real — mai mulți utilizatori se înfruntă pe același quiz
- Sistem de prieteni, leaderboard, streak-uri
- Abonament Free / Premium prin Stripe

---

## Tehnologii folosite

| Tehnologie | Rol |
|---|---|
| **Node.js + Express** | Server web, procesează cererile |
| **Supabase** | Baza de date (PostgreSQL) + autentificare utilizatori |
| **OpenAI GPT-4.1-mini** | Generează quiz-uri, lecții, rapoarte AI |
| **Stripe** | Procesare plăți, abonamente |
| **Railway** | Hosting (serverul rulează aici) |
| **HTML + CSS + JS** | Interfața vizuală (frontend) |

---

## Structura folderelor

```
examforge-ai/
│
├── app.js                        ← Punctul de intrare al serverului
├── package.json                  ← Lista de pachete/librării folosite
├── .env                          ← Cheile secrete (API keys) — nu e pe GitHub
├── supabase-migration.sql        ← Comenzi SQL pentru crearea tabelelor în baza de date
├── vercel.json                   ← Configurație pentru deployment alternativ (Vercel)
│
├── src/                          ← Codul serverului (backend)
│   ├── routes/                   ← Definesc ce se întâmplă la fiecare URL
│   ├── services/                 ← Logica principală (AI, camere, documente)
│   ├── repositories/             ← Comunicarea cu baza de date
│   ├── middleware/               ← Verificări intermediare (planuri, upload fișiere)
│   ├── domain/                   ← Structura obiectelor principale (Room, Player)
│   ├── config/                   ← Constante și setări
│   ├── utils/                    ← Funcții ajutătoare
│   └── validators/               ← Validare date primite
│
└── public/                       ← Tot ce vede utilizatorul (frontend)
    ├── css/styles.css            ← Stilizarea vizuală a întregului site
    ├── pages/                    ← Paginile HTML
    └── js/                       ← Codul JavaScript al paginilor
        ├── pages/                ← Logica fiecărei pagini
        ├── features/             ← Funcționalități complexe (dashboard)
        ├── components/           ← Componente reutilizabile (renderer, prieteni)
        └── shared/               ← Utilitare comune tuturor paginilor
```

---

## `app.js` — Inima serverului

Este fișierul care pornește tot. Face trei lucruri:
1. **Definește rutele paginilor** (la `/dashboard` → trimite `dashboard.html`)
2. **Înregistrează rutele API** (la `POST /api/rooms` → creează o cameră)
3. **Pornește serverul** pe portul 3000

> Important: rutele Stripe sunt înregistrate ÎNAINTE de `express.json()` pentru că webhook-ul Stripe are nevoie de corpul raw al cererii, neprocesat.

---

## `src/routes/` — Rutele API

Fiecare fișier gestionează un grup de endpoint-uri (URL-uri la care frontendul face cereri).

### `authRoutes.js`
- `POST /api/auth/register` — Creează un cont nou
- Verifică unicitatea username-ului, creează userul în Supabase Auth, creează profilul

### `roomRoutes.js`
- `POST /api/rooms` — Creează o cameră nouă (arena)
- `GET /api/rooms/:code` — Returnează statusul camerei și jucătorii
- `POST /api/rooms/:code/join` — Un jucător intră în cameră
- `POST /api/rooms/:code/start` — Hostul pornește arena
- `POST /api/rooms/:code/submit` — Un jucător trimite un răspuns
- `GET /api/rooms/:code/leaderboard` — Clasamentul final
- `POST /api/rooms/:code/close` — Hostul închide arena
- `POST /api/rooms/:code/lesson` — Generează o lecție de recuperare după arenă
- `POST /api/rooms/:code/react` — Trimite o reacție emoji în timp real

### `lessonRoutes.js`
- `POST /api/lessons/generate` — Generează o lecție din document/subiect (verifică limita Free)
- `POST /api/lessons/quiz` — Generează quiz din lecție (doar Premium)
- `POST /api/lessons/report` — Generează raportul de performanță AI (doar Premium)

### `userLessonRoutes.js`
- `GET /api/user-lessons?userId=...` — Returnează toate lecțiile salvate ale userului
- `POST /api/user-lessons` — Salvează o lecție nouă în baza de date
- `PATCH /api/user-lessons/:id` — Actualizează scorul quiz-ului pe o lecție
- `DELETE /api/user-lessons/:id` — Șterge o lecție

### `generateRoutes.js`
- `POST /api/generate-pack` — Generează un pack de provocări din document/subiect
- Returnează date prin **SSE (Server-Sent Events)** — adică streamează progresul în timp real

### `stripeRoutes.js`
- `POST /api/stripe/webhook` — Primește notificări de la Stripe (plată reușită, abonament anulat)
- `POST /api/stripe/create-checkout-session` — Creează sesiunea de plată Stripe
- `GET /api/stripe/plan-status?userId=...` — Returnează planul și utilizarea săptămânală
- `POST /api/stripe/portal-session` — Deschide portalul Stripe pentru gestionarea abonamentului

### `sessionRoutes.js`
- `POST /api/sessions/save` — Salvează rezultatele finale ale unei arene în baza de date

### `roomInviteRoutes.js`
- `POST /api/room-invites` — Trimite o invitație la arenă unui prieten
- `GET /api/room-invites/:userId` — Returnează invitațiile primite
- `POST /api/room-invites/:inviteId/respond` — Acceptă sau refuză o invitație

### `configRoutes.js`
- `GET /api/config` — Returnează URL-ul și cheia publică Supabase către frontend (nu expune secretele)

### `conspectRoutes.js`
- `POST /api/conspect` — Generează un ghid de studiu (conspect) dintr-un document

---

## `src/services/` — Logica principală

### `aiService.js`
Toate apelurile către OpenAI sunt centralizate aici. Include:
- Logică de retry (dacă AI-ul returnează JSON invalid, încearcă din nou de 3 ori)
- `generateRecoveryLessonWithAI()` — generează lecția de recuperare după arenă bazată pe conceptele greșite

### `roomService.js`
Gestionează ciclul de viață al unei camere:
- Crearea camerei cu cod unic (5 caractere, ex: "A3K9M")
- Pornirea arenei (calculează timpul de final)
- Avansarea la întrebarea următoare
- Verificarea dacă toți jucătorii au terminat
- Sincronizarea timpului între server și clienți

### `documentService.js`
Extrage textul din fișierele încărcate:
- **PDF** → folosește librăria `pdf-parse`
- **Imagini** (PNG, JPG) → folosește `tesseract.js` pentru OCR (recunoaștere text din imagini)

---

## `src/repositories/` — Comunicarea cu baza de date

### `RoomRepository.js`
Funcții CRUD pentru tabelul `rooms` din Supabase:
- Generare cod unic (verifică să nu existe deja)
- Citire, creare, actualizare camere

### `PlayerRepository.js`
Funcții CRUD pentru tabelul `players` din Supabase:
- Adăugare jucător în cameră
- Actualizare scor, răspunsuri, concepte slabe

---

## `src/middleware/` — Verificări intermediare

### `planMiddleware.js`
Verifică planul unui utilizator înainte să execute o acțiune:
- `checkAndIncrementLimit(userId, type)` — verifică dacă userul Free a atins limita (3/săptămână) și incrementează contorul
- `getUserPlan(userId)` — returnează `"free"` sau `"premium"`
- Resetează automat contoarele în fiecare luni (săptămâna nouă)

### `uploadMiddleware.js`
Configurează `multer` pentru upload de fișiere:
- Acceptă PDF și imagini
- Limită de 10 MB
- Stochează fișierul în memorie (nu pe disc)

---

## `src/domain/` — Structura obiectelor

### `Room.js`
Definește structura unei camere: cod, status, pack de întrebări, jucători, timestamps

### `Player.js`
Definește structura unui jucător: ID, nume, scor, răspunsuri date, concepte slabe

---

## `src/utils/` — Funcții ajutătoare

### `scoring.js`
Calculează dacă un răspuns e corect și câte puncte primești:
- Evaluare pentru toate tipurile de provocări (multiple choice, fill blank, matching, etc.)
- Punctaj de bază: 100 puncte + bonus de viteză (0-50 puncte în funcție de timpul rămas)

### `promptBuilder.js`
Construiește prompt-urile trimise către OpenAI:
- Prompt diferit pentru document vs subiect scris
- Prompt de audit (verificare calitate)
- Prompt de reparare (dacă JSON-ul returnat e invalid)

### `textUtils.js`
Funcții pentru procesarea textului:
- Curățare text extras din documente
- Eliminare link-uri externe
- Trunchierea documentelor mari la dimensiunea potrivită pentru AI

---

## `src/validators/packValidator.js`
Validează structura unui pack de provocări generat de AI:
- Verifică că toate câmpurile necesare există
- Normalizează tipurile de provocări (corectează greșeli minore)
- Asigură că nu există provocări incomplete

---

## `src/config/constants.js`
Constante de timing pentru arenă:
- Timp per întrebare: 20 secunde
- Timp afișare rezultat: 3 secunde
- Timp afișare clasament: 5 secunde

---

## `public/pages/` — Paginile HTML

| Fișier | URL | Descriere |
|---|---|---|
| `home.html` | `/` | Pagina principală cu prezentarea platformei |
| `login.html` | `/login` | Autentificare și înregistrare |
| `dashboard.html` | `/dashboard` | Panoul utilizatorului |
| `create.html` | `/create` | Creare arenă nouă |
| `join.html` | `/join` | Intrare într-o arenă cu cod |
| `arena.html` | `/arena` | Arena activă (jocul propriu-zis) |
| `lessons.html` | `/lessons` | Lecțiile personale cu AI |
| `pricing.html` | `/pricing` | Pagina de prețuri Free vs Premium |
| `upgrade-success.html` | `/upgrade-success` | Confirmare după plata cu Stripe |

---

## `public/js/pages/` — Logica fiecărei pagini

### `home.js`
Inițializează header-ul, arată/ascunde butonul de login în funcție de sesiune.

### `login.js`
Gestionează formularele de login și înregistrare. Folosește Supabase Auth.

### `create.js`
- Permite upload document, scriere subiect sau alegere lecție salvată
- Apelează `/api/generate-pack` (streaming SSE)
- Verifică limita de plan ÎNAINTE de generare
- Creează camera și redirectează la arenă

### `join.js`
Permite unui jucător să intre într-o arenă cu un cod de cameră.

### `arena.js`
Cel mai complex fișier. Gestionează întreaga experiență de joc:
- Polling periodic la server pentru sincronizare (fiecare 500ms)
- Afișarea întrebărilor cu timer countdown
- Trimiterea răspunsurilor
- Clasamentul live
- Reacții emoji în timp real
- Generarea lecției de recuperare la final

### `dashboard.js`
Pornește dashboard-ul: inițializează header-ul, apelează `renderDashboard`.

### `lessons.js`
- Generare lecție (document sau subiect)
- Salvare lecție în baza de date
- Quiz la lecție (Premium)
- Raport de performanță AI (Premium)
- Verifică limita de plan înainte de generare

### `pricing.js`
Gestionează butonul de upgrade — creează sesiunea Stripe Checkout și redirectează.

---

## `public/js/features/` — Funcționalități complexe

### `dashboard.js`
Randează tot conținutul dashboard-ului:
- Cardul de profil cu statistici și coroanele Premium
- Cardul de plan (Free cu progress bars / Premium cu portal Stripe)
- Sesiunile recente
- Leaderboard-ul prietenilor cu stilizare gold pentru utilizatorii PRO
- Cererile de prietenie în așteptare

### `historyDetail.js`
Afișează un modal cu detaliile complete ale unui quiz trecut (întrebări, răspunsuri, clasament).

---

## `public/js/components/` — Componente reutilizabile

### `renderer.js`
Randează provocările în arenă și în quiz-ul de lecție:
- Afișează întrebarea și opțiunile în funcție de tip (multiple choice, matching, etc.)
- Afișează faza de rezultat (corect/greșit, explicație, snippet din document)

### `friendManager.js`
Modal-ul de gestionare a prietenilor: căutare utilizatori, trimitere cereri, acceptare/refuz.

### `roomInvites.js`
Cardul cu invitații primite la arene de la prieteni.

### `dom.js`
Funcții mici de manipulare DOM reutilizate în toată aplicația.

---

## `public/js/shared/` — Utilitare comune

### `supabaseClient.js`
Inițializează clientul Supabase în browser. Face un singur fetch la `/api/config` pentru a lua URL-ul și cheia publică, apoi creează clientul (singleton — se inițializează o singură dată).

### `auth.js`
Funcții de autentificare în browser:
- `login(email, password)` — autentificare via Supabase
- `logout()` — deconectare
- `getSession()` — verifică dacă există sesiune activă
- `register(email, password, username)` — înregistrare (apelează backend-ul)

### `nav.js`
- `nav` — obiect cu funcții de navigare (`nav.dashboard()`, `nav.arena(code)`, etc.)
- `initHeader()` — inițializează header-ul pe orice pagină: afișează avatar, streak, dropdown-ul cu Dashboard/Abonament/Logout
- Afișează coroana 👑 și badge-ul PRO pentru utilizatorii Premium

### `api.js`
Toate funcțiile de fetch către backend, organizate într-un singur loc:
- `createRoom(pack, userId)`, `joinRoom(code, name, userId)`, `submitAnswer(...)`, etc.
- `generatePack(formData, onProgress)` — citește stream SSE și apelează callback la fiecare progres

### `lessonStorage.js`
Funcții pentru salvarea lecțiilor în baza de date (înlocuiește fostul localStorage):
- `saveLessonToStorage(lesson, documentText, userId)` — salvează în Supabase
- `getLessonsFromStorage(userId)` — preia toate lecțiile userului
- `updateLessonProgress(id, userId, data)` — actualizează scorul după quiz
- `deleteLessonFromStorage(id, userId)` — șterge o lecție

### `state.js`
Un obiect global care ține starea arenei în timp real:
- Index-ul întrebării curente, scorul local, timer, răspunsul selectat, etc.
- Folosit de `arena.js` și `renderer.js` împreună

### `uiFeedback.js`
- `showToast(message, type)` — notificație temporară (verde/roșu/galben)
- `showLoadingOverlay(...)` — overlay de loading cu pași și progress bar
- `hideLoadingOverlay()` — ascunde overlay-ul

### `theme.js`
Toggle între tema deschisă și întunecată.

---

## `public/css/styles.css`

Un singur fișier CSS pentru tot site-ul. Folosește variabile CSS (`--blue`, `--green`, etc.) pentru consistență. Stilul vizual este **neobrutalist** — borduri groase negre, shadow offset, font bold.

---

## Baza de date — Tabele Supabase

| Tabel | Ce stochează |
|---|---|
| `profiles` | Datele utilizatorilor: username, avatar, streak, puncte, plan Free/Premium, contoare săptămânale |
| `rooms` | Camerele de arenă: cod, status, pack de întrebări, timestamps |
| `players` | Jucătorii dintr-o cameră: scor, răspunsuri, concepte slabe |
| `game_sessions` | Sesiunile finalizate (arhivă istorică a quizurilor) |
| `game_results` | Rezultatele per jucător pentru fiecare sesiune |
| `user_lessons` | Lecțiile generate de utilizatori: lecția JSON, scor quiz, topics de revizuit |
| `friendships` | Relațiile de prietenie: requester, addressee, status (pending/accepted) |
| `room_invites` | Invitațiile la arene între prieteni |

---

## Fluxul complet — Cum funcționează o arenă

1. **Hostul** merge la `/create`, încarcă un PDF sau scrie un subiect
2. Frontend apelează `POST /api/generate-pack` → serverul trimite documentul la OpenAI → OpenAI generează 10-15 provocări → serverul le streamează înapoi (SSE)
3. Frontend apelează `POST /api/rooms` → serverul creează camera în Supabase cu un cod unic
4. Hostul intră în cameră (lobby) și dă codul prietenilor
5. Prietenii merg la `/join`, introduc codul → `POST /api/rooms/:code/join`
6. Hostul apasă Start → `POST /api/rooms/:code/start` → serverul calculează `ends_at` (timp total = nr_întrebări × 28 secunde)
7. Fiecare client face polling la `GET /api/rooms/:code` la fiecare 500ms pentru sincronizare
8. La fiecare răspuns → `POST /api/rooms/:code/submit` → serverul evaluează, calculează punctele, actualizează jucătorul
9. La final → `GET /api/rooms/:code/leaderboard` → clasamentul complet
10. Rezultatele se salvează în `game_sessions` și `game_results`
11. Opțional: lecție de recuperare → `POST /api/rooms/:code/lesson` → OpenAI generează mini-lecție pe conceptele greșite

---

## Fluxul Stripe — Cum funcționează abonamentul

1. User apasă „Upgrade" pe `/pricing`
2. Frontend apelează `POST /api/stripe/create-checkout-session` cu userId și email
3. Serverul creează sesiunea Stripe și returnează un URL
4. Userul e redirectat la pagina Stripe de plată
5. După plată, Stripe trimite un webhook la `POST /api/stripe/webhook`
6. Serverul actualizează `profiles.plan = 'premium'` în Supabase
7. Userul e redirectat la `/upgrade-success`
8. La anulare, Stripe trimite alt webhook → `profiles.plan = 'free'`
