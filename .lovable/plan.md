# Gamification Center

Mövcud "Çempionlar" modulu tam "Gamification Center"-ə çevrilir. Kurslar, imtahanlar, quizlər və sual bankının mövcud işi pozulmur — bu, əlavə qatdır.

## Faza 1 — Baza: sual flagı + XP/Level + Duel + Leaderboard

**Verilənlər bazası**
- `bank_questions.is_gamification_enabled` boolean, default false (+ siyahıda 🟢/⚪ status və filter).
- Yeni cədvəllər (hamısında GRANT + RLS):
  - `gamification_duels` (id, challenger_id, opponent_id, question_count, duration_seconds, status: pending/accepted/declined/expired/in_progress/completed, question_ids jsonb, winner_id, timestamps)
  - `gamification_duel_answers` (duel_id, user_id, question_id, answer_id, is_correct, response_ms)
  - `gamification_xp_events` (user_id, event_type, xp, ref_id, created_at) — server-side yazılır
  - `gamification_xp_config` (key, xp) — admin redaktə edə bilər
  - `gamification_badges`, `gamification_user_badges`
  - `gamification_daily_challenges`, `gamification_challenge_attempts`
- Server funksiyalar (XP/score yalnız serverdə hesablanır): `createDuel`, `respondDuel`, `submitDuelAnswer`, `finishDuel`, `getLeaderboard`, `getMyGamificationStats`. Bütün sual seçmə sorğularında `is_gamification_enabled = true` filteri DB səviyyəsində.
- Level = ümumi XP-dən serverdə hesablanır.

**UI** (`/champions` → Gamification Center, menyuda ad dəyişir)
- Header: Level, XP progress bar, streak, duel/qələbə/badge sayları.
- "⚔️ Duel başlat": rəqib seçimi (+ təklif olunan rəqib), sual sayı 5/10/15/20, müddət 1/2/3/5 dəq. Kifayət qədər aktiv sual yoxdursa aydın mesaj, duel yaranmır.
- Duel dəvəti: notifications cədvəli ilə qəbul/imtina; statuslar.
- Duel oyun ekranı: geri sayım, cavablar; nəticə = düzgün cavab sayı, bərabərlikdə sürət. XP: cavab başına + sürət bonusu + qələbə bonusu.
- Duel tarixçəsi + detal görünüşü (suallar, cavablar, müddət, XP).
- Leaderboard: Bu həftə / Bu ay / Bütün zamanlar, istifadəçinin öz mövqeyi vurğulanır.
- Sual bankı formasına "Gamification üçün aktiv" checkbox.

## Faza 2 — Daily Challenge + Streak + Badges
- Hər gün avtomatik challenge (5 sual, gamification pool-dan), nəticəyə görə XP.
- Streak: ardıcıl aktiv günlər, həftəlik təqvim görünüşü.
- Badge engine: İlk Qələbə, Duelist, Çempion, Sniper, Perfect Score, Sürətli, 7 Day Streak — şərtlər serverdə yoxlanır.

## Faza 3 — Team Battle + Most Improved
- Most Improved: əvvəlki periodla müqayisədə inkişaf %.
- Team Battle: hazırda `profiles`-də department/team sahəsi YOXDUR — komanda məlumatı üçün ayrıca qərar lazımdır (sual verəcəm).

## Faza 4 — Boss Battle
- Aylıq event: 20 sual / 5 dəq, ayrıca leaderboard.

## Suallar
- Komandalar necə müəyyənləşsin? (profilə yeni "komanda" sahəsi, yoxsa mövcud qovluq/struktur?)
