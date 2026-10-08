import express from 'express';
import { createApp } from './application.js';
import { readEnv } from './config/env.js';

// Vercel's Express runtime invokes the exported app directly. Keep the local
// listener in server.ts so local development and long-running Node hosts still
// use the same application factory without opening a port in serverless mode.
// The direct reference also makes this entry unambiguous to Vercel's Express
// source detector; application construction remains centralized in createApp.
void express;
const app = createApp(readEnv());

export default app;
