import { createApp } from './app';
import { readEnv } from './config/env';

const env = readEnv();
const app = createApp(env);

app.listen(env.PORT);
