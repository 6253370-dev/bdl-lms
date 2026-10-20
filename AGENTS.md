# Architecture rules

- Keep the conditional Vercel Nitro preset and explicitly direct non-Vercel output to `dist/`, with server and client subdirectories, because Lovable deploys that directory rather than Nitro's default `.output/`.
- Live-class server functions attach bearer authentication locally as well as globally; room calls also pass current session headers and catch RPC failures so authentication errors cannot crash the room page.