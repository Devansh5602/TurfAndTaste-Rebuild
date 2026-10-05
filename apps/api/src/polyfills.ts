// Provide WebSocket polyfill for Supabase realtime client in Node.js 20
// Only needed in development/test where Node.js < 22 may be used
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;