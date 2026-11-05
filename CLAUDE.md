# Baku Digital Lab LMS

Daxili təlim platforması (kurslar, imtahanlar, quiz, krossvord, canlı dərslər, kitabxana, davamiyyət, sertifikat, gamification). Sahib: Rustam Azimov. Hər yeni sessiyada bu faylı və `docs/DESIGN-BRIEF.md`-i oxu.

## Stack və əmrlər
TanStack Start + Vite 7, React 19, Tailwind 4, shadcn/ui, Supabase, LiveKit. `npm run dev` (8080), `npm run build`, `npm run lint`.

## Mühit
- Repo: `6253370-dev/lmskontakt` (GitHub). Deploy: Vercel layihəsi `lmskontakt`, canlı sayt `hdclms.vercel.app`. **`main`-ə hər push dərhal canlı sayta düşür.** PR-lar Vercel preview alır.
- Baza: Supabase `lms-prod` (`kfcyvwpwmlwykkealgfu`, region eu-central-1, pulsuz plan). **Lokal sayt də bu bazaya qoşulur.** Storage bucket-ları: `course-media` (public), `certificate-templates` (private), `library-books` (private).
- Edge function-lar (`supabase/functions`): `admin-create-user`, `admin-update-user`, `admin-delete-user`, `login-with-employee-id`. (`bootstrap-super-admin` bilərəkdən deploy edilməyib. `copy-files` təqaüdə çıxıb və silinməlidir.)
- Giriş işçi ID ilə işləyir. Hesab məlumatlarını və parolları Rustam verir, heç yerdə yazma.
- Köhnə mənbə: layihə əvvəl Lovable-da idi və oradan köçürülüb. Lovable ilə bağlılıq bitib, ona yeni dəyişiklik göndərmə.

## Qaydalar
1. `main`-ə birbaşa yazma. Branch → PR → Vercel preview → Rustam təsdiq edəndə birləşdirmə.
2. Canlı mühiti dəyişən hər əməliyyatdan əvvəl açıq təsdiq al: Supabase-ə yazma, Vercel dəyişənləri/domenlər, `main`-ə birləşdirmə, istifadəçi silmə/şifrə dəyişmə.
3. Biznes məntiqi, RLS, edge function-lar və mətnlər istəyilmədən dəyişmir. İstifadəçi interfeysi Azərbaycan dilindədir.
4. Sirr yazma: parol, `service_role` açarı, token commit olunmur.
5. Dağıdıcı əmr yox (məlumat silmə, `supabase db reset`, force push).
6. Hər dəyişiklikdən sonra `npm run build`, brauzerdə 1280/768/390px yoxlaması. Kodla "bitdi" demə, ekranda gör.

## Baza haqqında bilməli
- `supabase/migrations` **natamamdır** (bəzi cədvəllər migration-sız yaranıb). Mövcud sxemin tək mənbəsi canlı bazadır. Sıfırdan lokal quruluşa etibar etmə.
- `src/integrations/supabase/types.ts` avtomatik yaradılıb. Yalnız sxem dəyişəndən sonra yenilənir.
- Sxem dəyişikliyi qaydası: `docs/DESIGN-BRIEF.md`, 7-ci bölmə.

## Rustamın qəbul etdiyi qərarlar (xatırlatma, təkrar-təkrar soruşma)
Bu, test mühitidir: canlı saytda yalnız uydurma məlumat var, şəxsi məlumat yoxdur. Rustam şüurlu olaraq bunları qəbul edib: repo public qalır, test hesablarının şifrələri sadədir, "Leaked password protection" və bu cür təkmilləşdirmələr indi lazım deyil. Onları xatırlatma və təhlükəsizlik haqqında soruşma. Yalnız yeni funksiya yazanda RLS-i düzgün yaz və gizli açarları heç vaxt commit etmə.

## Dizayn işi
Rəng yalnız IKTex dizayn sistemindən (`src/styles.css`, `--brand-*`, `--gray-*`). Şəkillərdəki qırmızı/mərcan rənglər istifadə olunmur. Ətraflı: `docs/DESIGN-BRIEF.md` (maddə siyahısı, mərhələlər, istinad şəkillər `docs/design-reference/`).

## İş axını (öyrənilmiş qaydalar)
- PR-ı `gh pr create` ilə aç. GitHub connector-un "Open new pull request" alətini istifadə etmə, o, yazma icazəsi olmadığı üçün uğursuz olur və boş forma açır.
- `gh pr merge` və ya `main`-ə push etmə. Birləşdirməni Rustam GitHub-da özü edir (əvvəl Vercel preview-da baxandan sonra).
- Böyük işi kiçik PR-lara böl (ekran qrupu üzrə). Hər PR-da dəyişən ekranların siyahısı və yoxlama nəticəsi olsun.
- Ekran görüntüsü ala bilmirsənsə, bunu **açıq yaz** ("bu səhifələri ekranda yoxlaya bilmədim"). Kodla ölçməni gözlə yoxlama kimi təqdim etmə.
- `docs/screenshots/` heç vaxt commit olunmur (real ad və məlumat ola bilər). Repo public-dir.

