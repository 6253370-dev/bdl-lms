# LMS dizayn brief-i (Claude Code üçün)

Bu fayl repo-nun `docs/` qovluğuna qoyulur. Claude Code işə başlamazdan əvvəl onu **bütövlükdə** oxumalıdır.
Sahib: Rustam Azimov (Baku Digital Lab). Dil: istifadəçi interfeysi Azərbaycan dilindədir, mətnlər `src/lib/i18n.ts` (`t`) və ya komponentlərin içindədir.

---

## 1. Layihə faktları

- **Stack:** TanStack Start + Vite 7, React 19, Tailwind CSS 4, shadcn/ui (Radix), `lucide-react`, `recharts`, Supabase (`@supabase/supabase-js`), LiveKit (canlı dərslər).
- **Skriptlər:** `npm run dev` (port 8080), `npm run build`, `npm run lint`, `npm run format`.
- **Deploy:** GitHub repo `6253370-dev/lmskontakt` → Vercel. **`main`-ə hər push dərhal canlı sayta (hdclms.vercel.app) deploy olur.** Hər PR üçün Vercel preview yaranır.
- **Baza:** Supabase layihəsi `lms-prod` (`kfcyvwpwmlwykkealgfu`). `.env`-dəki açarlar yalnız ictimai (publishable) açarlardır. **Lokal sayt real bazaya qoşulur.**
- **Marşrutlar:** `src/routes/*.tsx` (dashboard, courses.*, exams, quiz, crosswords, live-classes.*, library, attendance, calendar, champions, certificates.*, profile, question-bank, grading, reports, users, admin.comments).
- **Çərçivə:** `src/components/AppShell.tsx`. **UI primitivləri:** `src/components/ui/*`. **Ortaq dizayn komponentləri:** `src/components/design/*`.
- **Tokenlər:** `src/styles.css` (`:root` dəyişənləri). `src/integrations/supabase/types.ts` avtomatik yaradılıb, yalnız [B] migration-dan sonra yenilənir (7-ci bölmə).

## 2. Qaydalar (məcburidir)

1. **`main`-ə birbaşa yazma.** Hər mərhələ üçün ayrı branch aç (`feat/design-phase-1` və s.), sonda PR aç. PR təsvirində: hansı maddə nömrələri tamamlandı, ekran görüntüləri (masaüstü və 390px mobil), nələr yoxlandı.
2. **Biznes məntiqinə və icazələrə toxunma.** Sorğular, RLS, edge function-lar, auth, rol yoxlamaları dəyişmir. İstisna: maddənin yanında `[B]` yazılıbsa, o, 7-ci bölməyə uyğun gedir.
3. **Mətnləri dəyişmə.** Mövcud Azərbaycan dilindəki mətnlər qalır. Yeni mətn əlavə edirsənsə, Azərbaycan dilində yaz.
4. **Sirr yox.** `.env`-ə, kodda və ya commit-də heç bir parol, `service_role` açarı, token yazma. Giriş məlumatlarını Rustam verir.
5. **Dağıdıcı əmr yox.** Bazada məlumat silmə, `supabase db reset`, force push olmaz.
6. **Hər dəyişiklikdən sonra yoxla:** `npm run build` uğurlu olmalıdır. `npm run lint` işlə, amma işə başlamazdan əvvəl **bazanı qeyd et** (mövcud xətalar sənin deyil). Yeni xəta əlavə etmə.
7. **Brauzerdə yoxla** (Preview və ya `http://localhost:8080`): masaüstü (1280px), planşet (768px), mobil (390px). Kodla "bitdi" demə, ekranda gör.
8. **Əlçatanlıq:** mətn kontrastı ≥ 4.5:1, fokus halqası görünür, düymələr klaviaturadan işləyir, ikon düymələrdə `aria-label`.
9. **Qaranlıq rejim** (`.dark`) pozulmamalıdır. Yeni rənglər dəyişənlərlə verilsin, sərt kodlanmış `#hex` olmasın.
10. **Canlı mühitə toxunan hər əməliyyatdan əvvəl Rustamdan açıq təsdiq al:** Supabase-ə yazma (SQL/migration), Vercel production dəyişənləri və domenlər, `main`-ə birləşdirmə, istifadəçi silmə/şifrə dəyişmə. Connector-lar (GitHub, Supabase, Vercel) qoşuludursa onlardan istifadə et, amma təsdiqsiz canlı mühiti dəyişmə.

## 3. Dizayn sistemi

**Prinsip:** istinad şəkillərdən **düzülüşü, komponentləri, diaqramları, ikonları, önizləmələri, boşluq ritmini** götür. **Rəngi götürmə.** Rəng yalnız IKTex dizayn sistemindən gəlir.

### 3.1 Rənglər (artıq `src/styles.css`-dədir, yenidən ixtira etmə)
| Rol | Dəyişən | Dəyər |
|---|---|---|
| Əsas, link, seçilmiş | `--primary` / `--brand-600` | `#155EEF` |
| Hover | `--primary-hover` / `--brand-700` | `#004EEB` |
| Açıq fon (çip, seçilmiş sətir, ikon çipi) | `--brand-50`, `--brand-100` | `#EFF4FF`, `#D1E0FF` |
| Fokus halqası | `--ring` / `--focus-ring` | `#2970FF`, 4px, 24% |
| Neytral | `--gray-25 … --gray-950` | Untitled UI "gray modern" |
| Mətn | `--foreground` / `--muted-foreground` | `gray-900` / `gray-600` |
| Kənar | `--border` / `--input` | `gray-200` / `gray-300` |
| Uğur | `--success-*` | `#079455` |
| Xəbərdarlıq | `--warning-*` | `#F79009` |
| Xəta | `--error-*` / `--destructive` | `#D92D20` |

**Şəkillərdəki qırmızı/mərcan rənglər yoxdur.** Onların hamısı `--primary` (və açıq fonlar `--brand-50/100`) ilə əvəz olunur. Qırmızı yalnız mənfi status və təhlükəli əməliyyat üçün qalır (Gəlmədi, Keçmədi, Sil). Yaşıl (Keçdi, İştirak etdi) və kəhrəba (Gecikdi, Orta) yalnız status üçündür.

**Diaqram paleti:** əsas seriya `brand-600`, ikinci `brand-300`, üçüncü `brand-100`, boş zolaq/iz `gray-200`, status seriyaları `success/warning/error`. Heç vaxt qırmızı gradient və ya şəkillərdəki mərcan.

### 3.2 Tipoqrafiya
Şrift **Inter** (`--font-sans`). **Yoxla:** Inter həqiqətən yüklənir? (`src/routes/__root.tsx`-də `<link>` və ya `@font-face` olmalıdır. Yoxdursa sistem şriftinə düşür və ya Plus Jakarta Sans qalıb.) Yüklənmirsə əlavə et (400/500/600/700).
Başlıqlar 600, düymələr 600, etiketlər 500, mətn 400. Böyük başlıqlarda `letter-spacing: -0.02em` (artıq var).

### 3.3 Forma və dərinlik (QƏRAR D1)
**Cari defolt (Rustam dəyişə bilər):** şəkillərdəki yumşaq forma, IKTex rəngləri ilə.
- Kartlar: **16px** radius (`rounded-2xl` və ya `--radius-xl`), 1px `--border`, `--shadow-card`.
- Düymələr və inputlar: **10px**. Çiplər, tablar, filtr düymələri: **pill** (tam yuvarlaq).
- Modal/popover: 16px.
- Kölgə: yalnız IKTex `--elev-xs/sm/lg/xl`. Rəngli kölgə, parıltı, qradiyent fon yoxdur.
- İkonlar: yalnız `lucide-react`, 2px xətt, ölçülər 16/20/24.
- Pastel ikon çipi: 40×40, radius 12px, `--brand-50` fon + `--brand-600` ikon (status variantları `success-50` / `warning-50` / `error-50`).

Əgər Rustam D1-i "IKTex-in öz 8/12px formasını saxla" kimi dəyişsə, yalnız bu bölmədəki rəqəmlər dəyişir.

### 3.4 Texniki borc (Mərhələ 1-də təmizlənməlidir)
`src/styles.css`-in sonunda Lovable-ın yazdığı `.bento-*`, `.profile-*`, `.course-overview-grid`, `.calendar-*`, `.quiz-answers` kimi **layout klassları** var. Bir qismi komponentin daxili strukturuna bağlı kövrək seçicilərdir (`.profile-identity > div:first-child > div:first-child`, `.course-editor-details > :nth-child(3)` və s.). Yeni işdə bunlardan **istifadə etmə**: düzülüşü Tailwind klasları və kiçik komponentlərlə yaz. Təmizləmə mərhələ 1-də səhifələr dəyişdikcə tədricən aparılır (səhifəni yenidən yazanda onun CSS hack-ini də sil).

## 4. İstinad şəkillər

Rustam şəkilləri `docs/design-reference/` qovluğuna qoyur (adları dəyişmədən). Hər şəkil yuxarıdakı qaydalarla (rəng IKTex) oxunur. Şəkillərdəki **loqo, ad-soyad və məzmun saxtadır**, yalnız düzülüş və komponent üçündür.

| Fayl | Ekran | Maddələr |
|---|---|---|
| `bento-dashboard-mockup.jpg` | Ana səhifə | 62–70 |
| `01-kurslar.jpg` | Kurslar kataloqu | 71–75 |
| `02-kurs-sehifesi.jpg` | Kurs səhifəsi | 76–81 |
| `03-ders-pleyeri.jpg` | Dərs pleyeri | 21–24 |
| `04-imtahanlar.jpg` | İmtahan həlli | 29–30 |
| `05-krossvordlar.jpg` | Krossvord oyunu | 33 |
| `06-canli-dersler.jpg` | Canlı dərs otağı | 38 |
| `07-sertifikatlar.jpg` | Sertifikatlarım | 39–40 |
| `08-profil.jpg` | Profil | 42–45 |
| `09-teqvim.jpg` | Təqvim | 46–47 |
| `10-hesabatlar.jpg` | Hesabatlar | 48 |
| `11-sual-banki.jpg` | Sual bankı | 49–51 |
| `12-cempionlar.jpg` | Çempionlar (gamification) | 14–15 |
| `13-kitabxana.jpg` | Kitabxana | 52–53 |
| `14-davamiyyet.jpg` | Davamiyyət | 54–56 |
| `15-quiz.jpg` | Quiz | 31–32 |
| `16-qiymetlendirme.jpg` | Açıq cavabların qiymətləndirilməsi | 57 |
| `17-istifadeciler.jpg` | İstifadəçilər | 58–60 |
| `18-kurs-redaktoru.jpg` | Kurs redaktoru | 25–28 |
| `19-sertifikat-sablonlari.jpg` | Sertifikat şablonları | 41 |
| `20-canli-dersler-siyahi.jpg` | Canlı dərslər siyahısı | 36–37 |
| `21-krossvord-katalog.jpg` | Krossvord kataloqu və yaradıcı | 34–35 |
| `22-serhler.jpg` | Şərhlər | 61 |

`03-ders-pleyeri_1.jpg` təkrardır, istifadə etmə.

## 5. Maddələr

`[G]` yalnız görünüş. `[B]` baza/backend dəyişikliyi də lazımdır (7-ci bölməyə bax). `~` mövcud kodda yoxla, bəlkə artıq var.

### A. Çərçivə (`AppShell.tsx`)
1. Başlıqda qlobal axtarış (kurs, mövzu, krossvord) `[G+B]`
2. İstifadəçi menyusu: ad yanında açılan siyahı (profil, ayarlar, çıxış) `[G]`
3. Yan menyuda say nişanları (oxunmamış bildiriş, yeni şərh) `[G]`
4. Yan menyunun aşağısında istifadəçi kartı və "Dəstək mərkəzi" kartı `[G]`
5. Səhifə başlığının üstündə breadcrumb `[G]`

### B. Ortaq komponentlər (`src/components/design/`)
6. KPI kartı + trend göstəricisi ("↑ +12% keçən dövrlə") `[G+B]`
7. Say göstərən pill tablar ("Hamısı (244)") `[G]`
8. Vahid status çipi (Aktiv/Qeyri-aktiv, Keçdi/Keçmədi, Asan/Orta/Çətin, Yarımçıq, LIVE) `[G]`
9. Avatar: şəkil, onlayn nöqtəsi, avatar yığını ("+12") `[G]`
10. Dairəvi proqres (kurs faizi, taymer, səviyyə) `[G]`
11. Donut diaqram + leyend `[G]`
12. Area diaqram (aylıq aktivlik) `[G]`
13. Aktivlik istilik xəritəsi + ardıcıl gün (streak) `[B]`
14. Podium (top 3), reytinq cədvəli, "Sizin yeriniz 6/124" `[G+B]`
15. Səviyyə pillələri (1–10) və XP-yə görə səviyyə sistemi `[B]`
16. Master-detal düzülüşü: solda siyahı, sağda detal paneli (3 sütunlu variant da) `[G]`
17. Cədvəl: seçim qutusu, sətirdə redaktə/kopya/sil ikonları, nömrəli səhifələmə, "1–8 / 1 240 nəticə" `[G]`
18. Tarix aralığı seçicisi `[G]`
19. PDF/Excel ixrac düymələri `[G+B]`
20. Pastel ikon çipləri və motivasiya zolağı `[G]`

### C. Ekranlar
**Dərs pleyeri**
21. Bölmələrə bölünmüş (akkordeon) proqram paneli: müddət, tamamlanma işarəsi, cari dərs vurğusu `[B]` (bölmə/modul anlayışı bazada yoxdur)
22. "Şəxsi qeydlər" tabı `[B]`
23. İcmal: dərs metası (müddət, növ, səviyyə), "Əvvəlki/Növbəti dərs" `[G]`
24. Video pleyer: sürət, subtitr `~` `[G]`

**Kurs redaktoru**
25. Dərsə baxış limiti ("Limitsiz", "3 dəfə") `[B]`
26. Dərs siyahısında sürüklə-burax sıralama `~` `[G]`
27. Şəkil yükləmə zonası, simvol sayğacı (71/500), "Nələr öyrənəcəksiniz" teqləri `[G]`
28. Dərs tipi ikonları, müddət/ölçü göstəricisi `[G]`

**İmtahan və quiz**
29. Sual naviqasiyası (nömrəli dairələr: cavablanıb / hazırkı / boş) `[G]`
30. Başlıqda dairəvi taymer, "İmtahanı tərk et", kiçik ipucu kartı `[G]`
31. Quiz tarixçəsi paneli (faiz çipləri) və XP paneli `[G+B]`
32. Suallarda şəkil dəstəyi `[B]`

**Krossvord**
33. Oyun ekranı: vaxt/XP/tamamlanma kartları, Üfüqi/Şaquli ipucu siyahısı, aktiv söz vurğusu, "Yoxla" və "Yadda saxla və çıx" `[G]`
34. Katalog: "Yarımçıq qalmış" davam kartları, filtrlər (mövzu, çətinlik, müəllif), kartda XP/söz sayı/çətinlik `[B]`
35. Yaradıcı ekran: söz–sual cədvəli və avtomatik önizləmə `~` `[G]`

**Canlı dərslər**
36. Siyahı: "İndi canlı" hero kartı, gələcək dərslər (tarix bloku, "Xatırlat"), keçmiş dərslər `[G+B]`
37. Keçmiş dərsin yazısı və "Təkrar izlə" `[B]` (böyük iş)
38. Otaq: iştirakçı video şəbəkəsi, alt idarəetmə paneli, "Çat / Qaldırılmış əllər" tabları `[G]` (funksiya var, görünüş yenilənir)

**Sertifikatlar**
39. "Sertifikatlarım": böyük önizləmə, "Etibarlı sertifikat" nişanı, kod, "PDF yüklə", "Paylaş", say kartları `[G+B]`
40. Kodla sertifikatı yoxlama səhifəsi `[B]`
41. Şablon qalereyası və vizual redaktor (əsas/ikinci/fon rəngi, loqo, imza, canlı önizləmə, "Defolt", "Kopyasını yarat") `[B]` (indi yalnız PDF/PPTX yüklənir)

**Profil**
42. Başlıq: kamera düyməsi, məkan/universitet/sahə çipləri, səviyyə proqresi, şüar kartı `[G+B]`
43. "Uğurlarım" rozet şəbəkəsi və gizli uğurlar `[G]`
44. "Krossvordlarım" cədvəli `[G]`
45. "Haqqımda": maraqlar, hədəf, sevimli sitat, qoşulma tarixi `[B]`

**Təqvim**
46. Rəngli hadisə çipləri və növ leyendası `[G]`
47. "Bu gün" gündəlik xətti (vaxt, yer: Zoom/Meet/LMS) və "Bütün tədbirlər" filtri `[G+B]`

**Hesabatlar**
48. Trendli KPI-lər, aylıq aktivlik, tamamlanma donutu, ən çox izlənən kurslar, ən aktiv istifadəçilər, son imtahan nəticələri `[G+B]`

**Sual bankı**
49. Statistik kartlar (cəmi, test, açıq, mövzu sayı) `[G]`
50. Sağda önizləmə paneli, düzgün cavab və "İzah" sahəsi, "PDF ixrac" `[B]`
51. Sətirdə kopyalama və toplu seçim `[G]`

**Kitabxana**
52. Növ filtri (Kitablar, PDF, Video, Təqdimat) və "Seçilmiş resurs" hero kartı `[B]`
53. Video və təqdimat resursları, kartda növ çipi, ölçü, "Yüklə" və "Bax" `[G+B]`

**Davamiyyət**
54. Filtrlər (tarix, kurs, qrup) və KPI (iştirak %, gəlməyən, gecikən) `[G]`
55. "Gecikdi" statusu (indi yalnız var/yox) `[B]`
56. Donut statistikası və Excel ixrac `[G+B]`

**Qiymətləndirmə**
57. 3 sütunlu düzülüş: növbə, cavab, bal paneli. Slayder, sürətli bal düymələri (0, 0.25, 0.5…), rəy sahəsi, "1/12" naviqasiyası `[G]`

**İstifadəçilər**
58. Yan profil paneli: Haqqında, Fəaliyyət, Kurslar, Qruplar tabları `[G+B]`
59. Vəzifə, şöbə, status (Aktiv/Qeyri-aktiv), "Bu gün aktiv" KPI-si `[B]`
60. Rol filtri və toplu seçim `[G]`

**Şərhlər**
61. Master-detal: filtr (Yeni/Cavablanmış/Gizlədilmiş), "Cavab yaz", "Gizlət", sağda cavab zənciri və cavab redaktoru `[B]`

### D. Ana səhifə (`dashboard.tsx`, `bento-dashboard-mockup.jpg`)
62. "Davam et" kartında proqres (dairəvi və xətti), "16 / 24 dərs tamamlanıb", qaldığı dərsə qayıdan düymə `[G]`
63. Həftəlik öyrənmə aktivliyi sütun diaqramı, cəmi saat, keçən həftəyə görə % `[B]` (öyrənmə vaxtı izlənmir)
64. Səviyyə kartı (səviyyə, XP, növbəti səviyyəyə qalan XP) `[B]` (15 ilə eynidir)
65. Üç mini göstərici: Sertifikatlar, Keçilən imtahanlar, Orta bal `[G]`
66. "Yaxınlaşan imtahan" kartı (təqvim hadisələrindən) `[G]`
67. Başlıqda şüar sətri `[G]`
68. "Ən populyar kurslar": "Populyar" nişanı, müəllif avatarı, reytinq, dərs sayı `[G]`
69. "Liderlər cədvəli" vidceti (dövr seçimi, öz sətri vurğulu) `[G]`
70. Admin ana səhifəsində siyahıların yerinə diaqramlar `[G]`

### E. Kurslar kataloqu (`courses.index.tsx`, `01-kurslar.jpg`)
71. Tablar: Hamısı / Davam edən / Tamamlanan `[G]`
72. Qovluq filtrini üfüqi kateqoriya çiplərinə çevirmək `[G]`
73. Sıralama seçimi (Ən populyar, Ən yeni, Reytinq) `[G]`
74. Kartda şəxsi proqres xətti (%), kateqoriya çipi, müəllim, reytinq `[G]`
75. "Seçilmiş kurs" hero kartı, admin seçir `[B]`

### F. Kurs səhifəsi (`courses.$courseId.index.tsx`, `02-kurs-sehifesi.jpg`)
Məzmunun çoxu artıq var (reytinq, "Nələr öyrənəcəksiniz", "Kursa daxildir", proqram, müəllim, rəylər). Əsas iş düzülüşdür.
76. Mövcud bölmələri 3 sütunlu bento düzülüşünə keçirmək `[G]`
77. Reytinq paylanması (5★ 72%, 4★ 20%…) `[G]`
78. "Siyahıya əlavə et" (kursu işarələmək) `[B]`
79. "Oxşar kurslar" bloku `[G]`
80. Müəllim kartında statistika (tələbə sayı, kurs sayı, reytinq) `[G]`
81. Proqramın bölmələrə bölünməsi, hər birində dərs sayı `[B]` (21 ilə eyni modul işi)

### G. Əhatədən kənar (etmə)
Birbaşa mesajlaşma (Mesajlar), Mentorlar, Sifarişlər, Karyera, Forum və marketinq saytı naviqasiyası (Kurslar/İxtisaslar/Bloq/Haqqımızda). "Seçilənlər" yalnız 78-ci maddə qədər. "Qruplar" üçün qərar gözlənilir, indi etmə.

## 6. Mərhələlər

**Mərhələ 1: təməl (yalnız `[G]`).**
Maddələr 1–12, 16–20. İşin sırası:
1. Baza xətti: `npm install`, `npm run build`, `npm run lint` nəticələrini qeyd et.
2. 3.2-ni yoxla (Inter yüklənirmi) və 3.3-ü (D1) tokenlərə və primitivlərə tətbiq et (`Card`, `Button`, `Input`, `Badge`, `Tabs`, `Table`).
3. Ortaq komponentləri `src/components/design/` içində yaz: `StatCard` (6), `PillTabs` (7), `StatusChip` (8), `Avatar`/`AvatarStack` (9), `RingProgress` (10), `DonutChart` (11), `AreaChartCard` (12), `MasterDetail` (16), `DataTable` əlavələri (17), `DateRangePicker` (18), `ExportButton` (19, yalnız düymə), `IconChip` və `MotivationStrip` (20).
4. `AppShell`-i yenilə (1–5). 1-ci maddədə axtarış indi yalnız kurs adlarına görə, mövcud `courses` sorğusu ilə.
5. Hər komponent üçün mövcud bir səhifədə real istifadə et. Komponenti yalnız yazıb qoyma.
**Hazırdır meyarı:** build uğurlu, yeni lint xətası yoxdur, 3 ekran ölçüsündə yoxlanıb, PR təsvirində ekran görüntüləri.

**Mərhələ 2: ən çox görünən ekranlar.** Ana səhifə (62, 65–70), kataloq (71–74), kurs səhifəsi (76, 77, 79, 80), pleyer (23, 24), kurs redaktoru (27, 28).

**Mərhələ 3: qalan `[G]` maddələri.** İmtahan/quiz (29, 30), krossvord oyunu (33, 35), canlı dərs görünüşü (36, 38), sertifikatlarım görünüşü (39), profil (43, 44), təqvim (46), hesabatlar (48, mövcud məlumatla), sual bankı (49, 51), kitabxana kartları (53), davamiyyət (54, 56), qiymətləndirmə (57), istifadəçilər (60), şərhlər düzülüşü.

**Mərhələ 4: `[B]` maddələri.** Hər biri ayrıca PR, 7-ci bölmə ilə.

## 7. `[B]` maddələri üçün iş qaydası

Baza dəyişikliyini Claude Code özü edir: Supabase connector-u ilə (Claude-da hesaba qoşulu connector-lar Code-da da görünür, yoxlamaq üçün `/mcp`). Hədəf layihə: `lms-prod` (`kfcyvwpwmlwykkealgfu`). **Bu real bazadır**, ona görə sıra belədir:
1. Migration faylını yaz: `supabase/migrations/<YYYYMMDDHHMMSS>_<ad>.sql` (cədvəl/sütun, indekslər, **RLS siyasətləri**; mövcud nümunələrə bax: `is_admin_or_super(auth.uid())`, `auth.uid() = user_id`).
2. SQL-i Rustama göstər və **açıq təsdiq al**. Təsdiq olmadan bazaya yazma.
3. Təsdiqdən sonra connector ilə tətbiq et (`apply_migration`). Sonra təhlükəsizlik yoxlamasını işlət (`get_advisors`, tip `security`) və yeni xəbərdarlıq yaranıbsa düzəlt.
4. `src/integrations/supabase/types.ts`-i yeni sxemə uyğun yenilə.
5. Mövcud məlumatı silən və ya dəyişən əmrlər (`DROP`, `DELETE`, `TRUNCATE`, tipi dəyişən `ALTER`) üçün ayrıca xəbərdarlıq et və geri qaytarma planını yaz.
6. Supabase connector qoşulu deyilsə, dayan və Rustamdan qoşmasını istə. Alternativ: SQL faylını ver, Rustam Supabase panelində "SQL Editor"-də icra edər.
7. **Tarixi qeyd:** repo-dakı `supabase/migrations` natamam idi (bəzi cədvəllər migration-sız yaradılıb). `supabase db reset` və sıfırdan lokal qurma etibarlı deyil. Mövcud sxemin tək mənbəsi canlı bazadır. Böyük sxem dəyişiklikləri başlamazdan əvvəl ayrıca test layihəsi (və ya Supabase branch) tövsiyə olunur.

## 8. İlk tapşırıq (Claude Code-a verilir)

> `docs/DESIGN-BRIEF.md` faylını bütövlükdə oxu, sonra `docs/design-reference/` içindəki şəkillərə bax. `main`-ə yazma, `feat/design-phase-1` adlı branch aç. **Yalnız Mərhələ 1-i** et. Başlamazdan əvvəl plan yaz: hansı faylları dəyişəcəksən, hansı komponentləri yaradacaqsan. Rustam təsdiq edəndən sonra işə başla. Bitəndə `npm run build` və `npm run lint` nəticələrini, 3 ölçüdə yoxlama nəticəsini və PR-ı göstər.
