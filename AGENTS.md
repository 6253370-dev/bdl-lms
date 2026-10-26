# Architecture rules

- Keep the conditional Vercel Nitro preset and explicitly direct non-Vercel output to `dist/`, with server and client subdirectories, because Lovable deploys that directory rather than Nitro's default `.output/`.
- Live-class server functions attach bearer authentication locally as well as globally; room calls also pass current session headers and catch RPC failures so authentication errors cannot crash the room page.
- Catalog cards use a stretched course-detail link with independent controls above it, so the full card opens the overview without intercepting editing or certificate actions.
- Instructor display always resolves `courses.instructor_name` first and falls back to the course creator's profile name, on catalog cards and the course overview alike, so a course never renders without a teacher line.