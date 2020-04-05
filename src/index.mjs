
// node index.mjs --experimental-modules
import dotenv from 'dotenv';
dotenv.config({
    SERVER_HOST: '0.0.0.0',
    SERVER_PORT: 80,
    DEBUG: '*'
});

import nanoexpress from '@nanoexpress/pro-slim';
import cors from 'cors';
import Debug from 'debug';
import server from './server.mjs';

const debug = Debug('app');
const app = nanoexpress();

app.options('/*', cors());
app.get('/', async () => 'Pusher Server');

app.ws('/app/:appKey', server);

app.listen(process.env.SERVER_PORT, process.env.SERVER_HOST);
debug('Server listening');
