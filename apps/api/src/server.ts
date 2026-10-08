// Provide WebSocket polyfill for Supabase realtime client in Node.js 20
// Must be set before importing Supabase client
// Only needed in development/test where Node.js < 22 may be used
if (process.env.NODE_ENV !== 'production') {
  await import('./polyfills.js');
}

import { createApp } from './application.js';
import { readEnv } from './config/env.js';

const env = readEnv();
const app = createApp(env);

app.listen(env.PORT);
