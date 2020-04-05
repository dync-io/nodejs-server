
import Debug from 'debug';
import url from 'url';

import { genSocketId, encode } from './utils.mjs';

const debug = Debug('server');
const APP_KEY = process.env.APP_KEY;

async function Server(req, ws) {
  ws.socket_id = genSocketId();
  const params = url.parse(`${req.getUrl()}?${req.getQuery()}`, true);
  const app_key = params.pathname.split('/').pop();

  function pingpong() {
    ws.send(encode('pusher:pong', {}));
  }

  function subscribe(data) {
    debug('Client subscribed to channel %s', data.channel);
    ws.subscribe(data.channel);
    ws.send(encode('pusher_internal:subscription_succeeded', {}, data.channel));
  }

  function unsubscribe(data) {
    debug('Client unsubscribed to channel %s', data.channel);
    ws.subscribe(data.channel);
  }

  ws.on('close', () => {
    debug('Client disconnected');
  });

  ws.on('message', message => {
    debug('Event: %s', message);
    try {
      const json = JSON.parse(message);
      switch (json.event) {
        case 'pusher:ping':
          pingpong();
          break;
        case 'pusher:subscribe':
          subscribe(json.data);
          break;
        case 'pusher:unsubscribe':
          unsubscribe(json.data);
          break;
        default:
          debug('Unknow event', json);
      }
    } catch (e) {
      ws.end();
    }
  });
  
  if (!app_key) {
    debug('App key not sent');
    ws.send(encode('pusher:error', {
      code: 4005,
      message: 'Path not found'
    }));
    return ws.end();
  } else if (APP_KEY !== app_key) {
    debug('Wrong app key %s', app_key);
    ws.send(encode('pusher:error', {
      code: 4001,
      message: `App key ${app_key} not in this cluster. Did you forget to specify the cluster?`
    }));
    return ws.end();
  } else {
    debug('New client with socket id %s', ws.socket_id);
    ws.send(encode('pusher:connection_established', {
      socket_id: ws.socket_id,
      activity_timeout: 120
    }));
  }
}

export default Server;
