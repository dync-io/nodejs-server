const Pusher = require('pusher-js');
require('dotenv').config();

describe('Channel', function() {
  let pusher;
  let channel;

  beforeEach(function() {
    pusher = new Pusher(process.env.APP_KEY, {
      wsHost: '127.0.0.1',
      wsPort: 80,
      enabledTransports: ['ws']
    });
    channel = pusher.subscribe('test');
  });

  describe('after construction', function() {
    it('#state should be connected', function(done) {
      pusher.connection.bind('connected', function() {
        expect(pusher.connection.state).toEqual('connected');
        done();
      });
    });

    it('#subscribed should be false', function() {
      expect(channel.subscribed).toEqual(false);
    });

    it('#subscriptionPending should be false', function() {
      expect(channel.subscriptionPending).toEqual(false);
    });

    it('#subscriptionCancelled should be false', function() {
      expect(channel.subscriptionCancelled).toEqual(false);
    });

  });

  describe('#authorize', function() {
    it('should call back with false, {} immediately', function() {
      const callback = jasmine.createSpy('callback');
      channel.authorize('1.1', callback);
      expect(callback).toHaveBeenCalledWith(false, {});
    });
  });

  describe('#trigger', function() {
    beforeEach(function() {
      channel.subscribed = true;
    });

    it('should raise an exception if the event name does not start with client-', function() {
      let exception;
      try {
        channel.trigger('whatever', {});
      } catch(e) {
        exception = e;
      }

      expect(exception.constructor.name).toEqual('BadEventName');
    });

    it('should call send_event on connection', function() {
      spyOn(pusher, 'send_event');
      channel.trigger('client-test', { k: 'v' });
      expect(pusher.send_event)
        .toHaveBeenCalledWith('client-test', { k: 'v' }, 'test');
    });

    it('should return true if connection sent the event', function() {
      spyOn(pusher, 'send_event').and.returnValue(true);
      expect(channel.trigger('client-test', {})).toBe(true);
    });

    it("should return false if connection didn't send the event", function() {
      spyOn(pusher, 'send_event').and.returnValue(false);
      expect(channel.trigger('client-test', {})).toBe(false);
    });
  });

  describe('#disconnect', function() {
    it('should set subscribed to false', function() {
      channel.handleEvent({
        event: 'pusher_internal:subscription_succeeded'
      });
      channel.disconnect();
      expect(channel.subscribed).toEqual(false);
    });

    it('should set subscriptionPending to false', function() {
      channel.subscriptionPending = true;

      channel.disconnect();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe('#handleEvent', function() {
    it('should not emit pusher_internal:* events', function() {
      const callback = jasmine.createSpy('callback');
      channel.bind('pusher_internal:test', callback);
      channel.bind_global(callback);

      channel.handleEvent({
        event: 'pusher_internal:test'
      });

      expect(callback).not.toHaveBeenCalled();
    });

    describe('on pusher_internal:subscription_succeeded', function() {
      it('should emit pusher:subscription_succeeded', function() {
        const callback = jasmine.createSpy('callback');
        channel.bind('pusher:subscription_succeeded', callback);

        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(callback).toHaveBeenCalledWith('123');
      });

      it('should set #subscribed to true', function() {
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(channel.subscribed).toEqual(true);
      });

      it('should set #subscriptionPending to false', function() {
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(channel.subscriptionPending).toEqual(false);
      });
    });

    describe('pusher_internal:subscription_succeeded but subscription cancelled', function() {
      it('should not emit pusher:subscription_succeeded', function() {
        const callback = jasmine.createSpy('callback');
        channel.bind('pusher:subscription_succeeded', callback);

        channel.cancelSubscription();
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(callback).not.toHaveBeenCalled();
      });

      it('should set #subscribed to true', function() {
        channel.cancelSubscription();
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(channel.subscribed).toEqual(true);
      });

      it('should set #subscriptionPending to false', function() {
        channel.cancelSubscription();
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(channel.subscriptionPending).toEqual(false);
      });

      it('should call #pusher.unsubscribe', function() {
        spyOn(pusher, 'unsubscribe');
        expect(pusher.unsubscribe).not.toHaveBeenCalled();

        channel.cancelSubscription();
        channel.handleEvent({
          event: 'pusher_internal:subscription_succeeded',
          data: '123'
        });

        expect(pusher.unsubscribe).toHaveBeenCalledWith(channel.name);
      });
    });

    describe('on other events', function() {
      it('should emit the event', function() {
        const callback = jasmine.createSpy('callback');
        channel.bind('something', callback);

        channel.handleEvent({
          event: 'something',
          data: 9
        });

        expect(callback).toHaveBeenCalledWith(9, {});
      });

      it("should emit the event even if it's named like JS built-in", function() {
        const callback = jasmine.createSpy('callback');
        channel.bind('toString', callback);

        channel.handleEvent({
          event: 'toString',
          data: 'works'
        });

        expect(callback).toHaveBeenCalledWith('works', {});
      });
    });
  });

  describe('#subscribe', function() {
    beforeEach(function() {
      pusher.connection = {
        socket_id: '9.37'
      };
      channel.authorize = jasmine.createSpy('authorize');
    });

    it('should authorize the connection first', function() {
      expect(channel.authorize.calls.count()).toEqual(0);
      channel.subscribe();

      expect(channel.authorize.calls.count()).toEqual(1);
      expect(channel.authorize).toHaveBeenCalledWith(
        '9.37', jasmine.any(Function)
      );
    });

    it('should send a pusher:subscribe message on successful authorization', function() {
      spyOn(pusher, 'send_event');
      expect(pusher.send_event).not.toHaveBeenCalled();

      channel.subscribe();
      const authorizeCallback = channel.authorize.calls.argsFor(0)[1];
      authorizeCallback(false, {
        auth: 'one',
        channel_data: 'two'
      });

      expect(pusher.send_event).toHaveBeenCalledWith(
        'pusher:subscribe',
        { auth: 'one', channel_data: 'two', channel: 'test' }
      );
    });

    it('should emit pusher:subscription_error event on unsuccessful authorization', function() {
      spyOn(pusher, 'send_event');
      const onSubscriptionError = jasmine.createSpy('onSubscriptionError');
      channel.bind('pusher:subscription_error', onSubscriptionError);

      channel.subscribe();
      const authorizeCallback = channel.authorize.calls.argsFor(0)[1];
      authorizeCallback(true, { error: 'test error' });

      expect(onSubscriptionError).toHaveBeenCalledWith(
        { error: 'test error' }
      );
      expect(pusher.send_event).not.toHaveBeenCalled();
    });

    it('should set #subscriptionPending to true if previously unsubscribed', function() {
      expect(channel.subscriptionPending).toEqual(false);

      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(true);
    });

    it('should do nothing if already subscribed', function() {
      channel.subscribed = true;
      channel.subscribe();

      expect(channel.subscriptionPending).toEqual(false);
    });
  });

  describe('#unsubscribe', function() {
    it('should send a pusher:unsubscribe message', function() {
      spyOn(pusher, 'send_event');
      expect(pusher.send_event).not.toHaveBeenCalled();
      channel.unsubscribe();

      expect(pusher.send_event).toHaveBeenCalledWith(
        'pusher:unsubscribe', { channel: 'test' }
      );
    });

    it('should set #subscribed to false', function() {
      channel.subscribed = true;
      channel.unsubscribe();

      expect(channel.subscribed).toEqual(false);
    });
  });

  describe('#cancelSubscription', function() {
    it('should set #subscriptionCancelled to true', function() {
      expect(channel.subscriptionCancelled).toEqual(false);

      channel.cancelSubscription();

      expect(channel.subscriptionCancelled).toEqual(true);
    });
  });

  describe('#reinstateSubscription', function() {
    it('should set #subscriptionCancelled to false', function() {
      channel.cancelSubscription();
      expect(channel.subscriptionCancelled).toEqual(true);

      channel.reinstateSubscription();

      expect(channel.subscriptionCancelled).toEqual(false);
    });
  });
});
