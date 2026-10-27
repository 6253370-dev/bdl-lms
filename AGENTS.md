# Architecture rules

- Presentation-only Bento redesigns use shared canvas/toolbar/layout classes and small display components; each route retains its existing queries, actions and access gates so visual work cannot change business behavior.

- Keep the conditional Vercel Nitro preset and explicitly direct non-Vercel output to `dist/`, with server and client subdirectories, because Lovable deploys that directory rather than Nitro's default `.output/`.
- Live-class server functions attach bearer authentication locally as well as globally; room calls also pass current session headers and catch RPC failures so authentication errors cannot crash the room page.
- Catalog cards use a stretched course-detail link with independent controls above it, so the full card opens the overview without intercepting editing or certificate actions.
- Instructor display always resolves `courses.instructor_name` first and falls back to the course creator's profile name, on catalog cards and the course overview alike, so a course never renders without a teacher line.
- Dashboard recent and popular sections share course presentation and use the caller-scoped `dashboard_allowed_courses` function; popularity is unique viewer count, so private viewing records stay hidden and inaccessible courses never enter either section.
- Course overview and player share `recordCourseView`, upserting by user/course with a fresh timestamp so repeat visits refresh personal history without increasing unique popularity.
- The course player opts out of AppShell through ProtectedRoute's presentation flag; authentication remains unchanged while the player owns its focused header, curriculum panel and detail tabs.