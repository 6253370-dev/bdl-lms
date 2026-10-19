# Architecture rules

- Keep the conditional Vercel Nitro preset and explicitly direct non-Vercel output to `dist/`, with server and client subdirectories, because Lovable deploys that directory rather than Nitro's default `.output/`.