# Baby Tracker

A simple, installable web app (PWA) for tracking a baby's sleep, feeds, and
solids, shared in real time across family members. No app store, no build
tools — just HTML/CSS/JS and Firebase.

## How it works

- Anyone can **create a family**, which generates a 6-character code.
- Family members **join** by entering that code on their own phone.
- All data (sleep sessions, feeds, solids) syncs live via Firestore, so if
  one person starts a nap, everyone sees it update within a second or two.
- "Time since last X" counters update automatically.
- Installed to a phone's home screen via the browser's "Add to Home Screen" —
  it then opens full-screen like a regular app.

There are no passwords — the family code is the only thing that gates
access, similar to sharing a Wi-Fi password. Don't share the code outside
your family.

## One-time setup (you'll need to do this once)

### 1. Create a free Firebase project
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. "baby-tracker"), and finish
   the wizard (you can decline Google Analytics).

### 2. Enable Firestore
1. In the Firebase console, go to **Build > Firestore Database**.
2. Click **Create database**, choose a region close to you, and start in
   **production mode** (we'll paste in proper rules next).

### 3. Enable Anonymous sign-in
1. Go to **Build > Authentication > Sign-in method**.
2. Enable the **Anonymous** provider. (This just lets the app tell "your
   family's devices" apart from random internet traffic — no login screen
   is ever shown to you or your family.)

### 4. Register a Web App and get your config
1. In Project Settings (gear icon) > **General**, scroll to "Your apps" and
   click the **Web** icon (`</>`) to register a new web app.
2. Give it any nickname, skip Firebase Hosting setup here.
3. Copy the `firebaseConfig` object it shows you.
4. Paste those values into [`js/firebase-config.js`](js/firebase-config.js)
   in this project, replacing the placeholder values.

### 5. Set the Firestore security rules
1. Go to **Build > Firestore Database > Rules**.
2. Replace the contents with everything in [`firestore.rules`](firestore.rules)
   from this project, then click **Publish**.

## Testing it locally

From this `baby-tracker` folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser. (A real HTTP server is
needed — opening `index.html` directly as a file won't let the service
worker or Firebase SDK work correctly.)

## Getting it onto your and your family's phones

Phones can't reach `localhost` on your computer, so you need to host the
files somewhere public. Two free, no-install options:

**Option A — GitHub Pages (recommended, git is already set up on this machine)**
1. Create a free GitHub account if you don't have one, and a new repository.
2. Push this `baby-tracker` folder to it.
3. In the repo's Settings > Pages, set the source to your main branch.
4. GitHub gives you a URL like `https://yourname.github.io/baby-tracker/`.

**Option B — Netlify drag-and-drop**
1. Go to https://app.netlify.com/drop (free account needed).
2. Drag the whole `baby-tracker` folder onto the page.
3. Netlify gives you a live URL immediately.

Once you have a URL:
1. Open it on your phone in Safari (iOS) or Chrome (Android).
2. Create your family, note the code.
3. Use the browser's **Share > Add to Home Screen** (iOS) or **menu > Install
   app** (Android).
4. Send the family code (not the app link alone — they need both) to family
   members so they can join from their own phones the same way.

## Known limitations (by design, to keep this free and simple)

- No native push notifications or lock-screen live countdowns (that would
  require a paid Apple Developer account and a native app — see our earlier
  discussion). Everyone sees live updates whenever the app is open.
- No per-person login — anyone with the family code has full access.
- Data isn't backed up anywhere outside Firestore; Firebase's free tier is
  more than enough for a family's usage.
