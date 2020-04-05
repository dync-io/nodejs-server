const Pusher = require('pusher-js');
require('dotenv').config();

describe('Pusher', function() {
  let pusher;

  beforeEach(function() {
    pusher = new Pusher(process.env.APP_KEY, {
      wsHost: '127.0.0.1',
      wsPort: 80,
      enabledTransports: ['ws']
    });
  });

  describe('after construction', function() {
    it('#connectionState should be connected', function(done) {
      pusher.connection.bind('connected', function() {
        expect(pusher.connection.state).toEqual('connected');
        done();
      });
    });
  });
});
