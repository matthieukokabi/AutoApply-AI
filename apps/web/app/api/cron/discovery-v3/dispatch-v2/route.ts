// Versioned Vercel Cron entrypoint. Keeping the implementation in the canonical
// route preserves external compatibility while a path rotation forces Vercel to
// replace stale cron-to-deployment registrations.
export { GET, POST } from "../route";
