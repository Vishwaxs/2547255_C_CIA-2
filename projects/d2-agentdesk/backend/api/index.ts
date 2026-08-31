// Vercel serverless entrypoint.
//
// This is the entire cost of running the same API on serverless: createApp() already
// returns a configured Express instance, and an Express app is itself a
// (req, res) handler, which is exactly what Vercel's Node runtime expects. No route
// duplication, no framework adapter, no second copy of the middleware chain — the
// factory that exists for the tests is the same one that boots here.
//
// server.ts remains the long-lived entrypoint for Docker and local dev. The two differ
// only in how the app is bound: app.listen there, per-invocation here.
import { createApp } from '../src/app';

export default createApp();
