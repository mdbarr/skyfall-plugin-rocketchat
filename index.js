'use strict';

const { driver } = require('@rocket.chat/sdk');

driver.useLog({
    debug: () => null,
    info: () => null,
    warn: () => null,
    warning: () => null,
    error: () => null
});

function RocketChat(skyfall) {
  this.connection = null;

  this.connect = (options) => {
    if (this.connection) {
      return this.connection;
    }

    const id = skyfall.utils.id();
    const name = options.username || options.host;
    let connected = false;

    this.connection = {
      id,
      name,
      host: options.host,
      secure: Boolean(options.secure),
      username: options.username,
      get connected() {
        return connected;
      }
    };

    skyfall.events.emit({
      type: `rocketchat:${ name }:connecting`,
      data: this.connection,
      source: id
    });

    skyfall.events.on(`rocketchat:${ name }:send`, (event) => {
      this.send(event.data);
    });

    return driver.connect({
      host: this.connection.host,
      useSsl: this.connection.secure
    }).
      then(() => {
        return driver.login({
          username: this.connection.username,
          password: options.password
        });
      }).
      then(() => {
        return driver.subscribeToMessages();
      }).
      then(() => {
        connected = true;

        skyfall.events.emit({
          type: `rocketchat:${ name }:connected`,
          data: this.connection,
          source: id
        });

        return driver.reactToMessages((error, message) => {
          if (error) {
            skyfall.events.emit({
              type: `rocketchat:${ name }:error`,
              data: error,
              source: id
            });
          } else if (message.u.username !== this.connection.username) {
            skyfall.events.emit({
              type: `rocketchat:${ name }:message`,
              data: message,
              source: id
            });
          }
        });
      });
  };

  this.send = function({
    to, content
  }) {
    if (this.connection && this.connection.connected) {
      let getRoomId;
      if (to.startsWith('@')) {
        getRoomId = driver.getDirectMessageRoomId(to.substring(1));
      } else {
        getRoomId = driver.getRoomId(to);
      }

      getRoomId.
        then((roomId) => {
          const message = driver.prepareMessage(content, roomId);
          driver.sendMessage(message);
        });
    }
  };
}

module.exports = {
  name: 'rocketchat',
  install: (skyfall, options) => {
    skyfall.rocketchat = new RocketChat(skyfall, options);
  }
};
