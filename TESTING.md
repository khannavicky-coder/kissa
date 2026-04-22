# Testing Kissa

A simple, friendly walkthrough you can do in 10 minutes inside the Lovable preview.

## 0. Before you start

Open the **preview URL** on the right. The first time, you'll land on the sign-up screen. If you're already signed in from a previous test, you'll go straight to **Home**.

You can sign up with:
- **Email + password** (instant — no email verification needed)
- **Apple** or **Google** (uses Lovable's managed OAuth)

> Tip: For repeat testing, use email/password — it's faster than re-doing OAuth each time.

---

## 1. Sign up → Home

1. Fill in your name, your child's name, email, password.
2. Tap **Create account**.
3. ✅ You should land on **/home** with "Hello, [your name]" and a banner asking you to add a child.

If you stay stuck on the sign-up screen → check the browser console and tell me what error you see.

---

## 2. Add a child profile

1. From Home, tap the **"Add your little dreamer"** banner (or go to Settings → Children profiles).
2. Enter a name, pick an age (3–9), pick an animal avatar.
3. Tap **Save profile**.
4. ✅ You should see the child card on /children. You can add up to 2.

---

## 3. Record + clone your voice

1. From Home, tap the **"Record your voice"** banner (or Settings → My voice).
2. Tap the big mic button — your browser will ask for microphone permission. **Allow it.**
3. Read aloud the suggested sentence for ~30 seconds (or tap stop earlier).
4. Listen back with **Play recording**.
5. Tap **Save my voice**.
6. ✅ You should see "Your voice is ready ✨" and bounce back to Home.

> What's happening behind the scenes: the recording is uploaded to a private storage bucket, then sent to ElevenLabs to create a cloned voice. The voice ID is saved against your account.

If this fails: usually means `ELEVENLABS_API_KEY` isn't valid, or your ElevenLabs plan doesn't support voice cloning. Open Settings → My voice — the status will say "failed".

---

## 4. Generate a story

1. From Home, tap **Create tonight's story** (or tap a child chip).
2. Fill in:
   - **What's the adventure?** e.g. "A dragon who collects shiny coins"
   - **Money lesson** — pick one
   - Characters / setting (optional)
   - **Length** — start with **Short** for faster testing
3. Tap **Generate story**.
4. ⏳ Wait ~10–20 seconds.
5. ✅ You should land on the **Preview** screen with the full story text.

---

## 5. Edit + narrate

1. On the Preview screen, edit any sentence you don't like (this trains your data flywheel).
2. Tap **Narrate in my voice**.
3. ⏳ Wait ~30–60 seconds (longer for "Long" stories).
4. ✅ You'll auto-navigate to the **Player** screen.

---

## 6. Play it back

1. Tap the big play button.
2. ✅ You should hear the story narrated **in your cloned voice**.
3. Tap the share icon (top right) — should copy the link or open the native share sheet.

---

## 7. Library, Settings, Pricing

- **Library** (bottom nav): Lists all stories. Filter by child if you have 2.
- **Settings** (bottom nav): Profile, children, voice, plan, sign out.
- **Pricing**: Visual placeholder — buttons say "Coming soon" (no payments wired yet).
- **Sign out**: From Settings → bounces you back to the sign-up screen. Re-test by signing in via /login.

---

## Common issues

| Symptom | Likely cause |
|---|---|
| "We need microphone access" | Allow mic in your browser; on iOS Safari, the preview must be the foreground tab |
| Voice cloning "failed" status | ElevenLabs key invalid OR your ElevenLabs plan doesn't include Instant Voice Cloning |
| Story stuck on "Weaving…" | Open the browser console — usually OpenAI rate limit (429) or invalid key (401) |
| Audio plays as silence | The story was synthesized but the audio file is empty — re-narrate from Preview |
| 404 on refresh | Lovable handles this automatically; if you see one, tell me which URL |

---

## When you're ready to publish

Once everything above passes:
1. Top right of Lovable → **Publish**
2. Test the same flow on the published URL
3. Then start on the marketing waitlist from your launch plan

Happy testing 🌙
