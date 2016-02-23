var amqp = require('amqplib/callback_api');
var util = require('./rabbit.util.js');
var utl = require('util');
var Q = require('q');
var EventEmitter = require('events');
var logger = {};
var registeredHandlers = {};

/**
 * The configuration object that must be passed for an amqp connection string to be properly built
 * @typedef {Object} customLogger
 * @property {function} error - custom implementation of customLogger.error
 * @property {function} info - custom implementation of customLogger.info
 * @property {function} debug - custom implementation of customLogger.debug
 * @property {function} fatal - custom implementation of customLogger.fatal
 * @property {function} trace - custom implementation of customLogger.trace
 * @property {function} warn - custom implementation of customLogger.warn
 */

/**
 * Creates a new Listener instance
 * @constructor
 * @param {customLogger} [customLogger = require('./loggerService.js')] - A custom logger object
 * @param {Number} maxRetry = number of reconnection attempts before a failure event is emmited by the rabbitclient (default is 10)
 * @example
 * var subscriber = require('amqplib-lite');
 *
 * // Custom logger passed in
 * let client = new RabbitClient(customLogObj);
 * client.handlers = handlers; // when a disconnect happens this handler property will be used to reconnect internally
 * client.connect(config).then((connection) => {
 *    client.registerHandlers(handlers, connection);
 * }).catch(error => {
 *   logger.error("Error occurred while bootstrapping queue handlers: ", error);
 * });
 *
 * // No custom logger pass in
 * let client = new RabbitClient();
 * client.handlers = handlers; // when a disconnect happens this handler property will be used to reconnect internally
 * client.connect(config).then((connection) => {
 *    client.registerHandlers(handlers, connection);
 * }).catch(error => {
 *   logger.error("Error occurred while bootstrapping queue handlers: ", error);
 * });
 *
 */
function Connect(customLogger, maxRetry) {
    logger = customLogger || require('./loggerService.js');
    this.maxRetries = maxRetry || 10;
    this.connectionAttempts = 0;
    EventEmitter.call(this);
}
utl.inherits(Connect, EventEmitter);

/**
 * The configuration object that must be passed for an amqp connection string to be properly built
 * @typedef {Object} RabbitHandler
 * @property {function} handlerFunction - The callback function that messages will be returned and processed on
 * @property {String} queueConfig - The queue that it will connect to ex "My.First.Queue"
 * @property {Number} messageRate - The amount of messages that can be received at a time. Once this amount of messages is ack more will come in (if available)
 */

/**
 * An array of RabbitHandlers, each rabbit handler has a configuration for a queue to connect to
 * @typedef {Array<RabbitHandler>} RabbitHandlers
 */

/**
 * The configuration object that must be passed for an amqp connection string to be properly built
 * @typedef {Object} RabbitConfiguration
 * @property {String} rabbitmqserver - RabbitMqServer string IP or Domain.
 * @property {Number} rabbitmqport - RabbitMqServer Port.
 * @property {String} rabbitmqusername - RabbitMqServer username.
 * @property {String} rabbitmqpassword - RabbitMqServer password.
 * @property {Number} rabbitheartbeat - optional, sets the client heartbeat with the server. Helps prevent TCP timeouts if rabbit server does not have heartbeat service enabled
 * @property {String} vhost - RabbitMqServer vhost.
 */

/**
 * Generates and processes a single amqp connection for channels to be opened on.
 * @memberof Listener
 * @param {RabbitHandlers} handlers - Array of callback handlers WITH configuration for those handlers, one handler per channel
 * @param {RabbitConfiguration} config - must pass a {@link RabbitConfiguration} object
 */

Connect.prototype.connect = function (config) {
    var context = this;

    return Q.ninvoke(amqp, "connect", util.buildRabbitMqUrl(config)).then(function (conn) {
        context.connectionAttempts += 1;
        logger.trace("Connection in progress...attempts: " + context.connectionAttempts);

        conn.on("error", function (err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
                logger.error("[AMQP] " + err.message);
                conn.close();
            }
        });

        conn.on("close", function () {
            console.error("[AMQP] reconnecting");
            logger.error("[AMQP] reconnecting");
            logger.trace('[AMQP] Connection attempts: ' + context.connectionAttempts + ' Maximum attempts: ' + context.maxRetries);
            if (context.connectionAttempts < context.maxRetries) {
                return setTimeout(function () {
                    context.connect(config).then(function (conn) {
                        context.registerHandlers(context.handlers, conn);
                    })
                }, 1000);
            } else
            {
                context.emit('failure', 'failed to connect after ' + context.maxRetries + ' tries.');
            }
        });

        console.log("[AMQP] connected");
        logger.info("[AMQP] has connected successfully");
        context.connectionAttempts = 0;
        return conn;

    }).catch(function (err) {
        context.connectionAttempts += 1;
        console.error("[AMQP]", err.message);
        logger.error("[AMQP] " + err.message);
        logger.trace('[AMQP] Connection attempts: ' + context.connectionAttempts + ' Maximum attempts: ' + context.maxRetries);
        if (context.connectionAttempts < context.maxRetries) {
            return setTimeout(function () {
                context.connect(config).then(function (conn) {
                    context.registerHandlers(context.handlers, conn);
                })
            }, 1000);
        }
        else
        {
            context.emit('failure', 'failed to connect after ' + context.maxRetries + ' tries.');
        }
    });
};

/**
 * A Channel object, part of the amqplib. Search amqplib documentation for more information
 * @typedef {Object} Channel
 */

/**
 * Sets up a channel object to be used
 * @memberof Listener
 * @param {number} messageRate - number of messages that will be fetched at a time. server must receive ack before it will pass more.
 * @param {Connection} amqpConn - xxxxxx
 * @returns {Promise<Channel>} - channel object that can be used to request messages and response
 */
Connect.prototype.setUpListener = function(messageRate, amqpConn) {
    var context = this;
    return Q.ninvoke(amqpConn, 'createChannel').then(function (ch) {

        ch.on("error", function (err) {
            console.error("[AMQP] channel error", err);
            logger.error("[AMQP] channel error " + err);
        });
        ch.on("close", function () {
            console.log("[AMQP] Channel closed");
            logger.info("[AMQP] Channel closed");

            context.registerHandlers(registeredHandlers,amqpConn);
        });
        logger.info("[AMQP] Channel prefetch rate set to " + messageRate);
        ch.prefetch(messageRate); // limit the number of messages that are read to 1, once the server receives an acknowledgement back it will then send another
        return ch;
    });
}

/**
 * This function should be fired when the main amqp connection has been fired
 * @memberof Listener
 * @param {array} handlers - Takes in an array of confuration settings to loop through and create queue connections for
 */
Connect.prototype.registerHandlers = function (handlers, amqpConn) {
    var context = this;
    logger.info("[AMQP] Beginning channel connections");
    registeredHandlers = handlers;
    if(registeredHandlers){
        console.log("[AMQP] Set handlers " ,JSON.stringify(registeredHandlers));
    }

    registeredHandlers.forEach(function (handler) {
        logger.info("[AMQP] attempting queue listener handshake for " + handler.queueConfig);
        context.setUpListener(handler.messageRate, amqpConn)
            .then(function (ch) {
                logger.info("[AMQP] Success handshake complete, listening on " + handler.queueConfig);
                ch.consume(handler.queueConfig, handler.handlerFunction.bind(ch), {noAck: false});
            }).catch(function (err) {
            if (err) {
                console.log(err);
                logger.fatal("[AMQP] " + err.message);

            }
        });
    });

};

/**
 * Used to register new channels on connections that exist, it also checks that the publishing exchange is reachable
 * @param config
 * @param amqpConn
 */
Connect.prototype.registerPublisher = function(config, amqpConn){
    return new Promise(function(resolve, reject) {
        logger.info("[AMQP] Beginning publisher connections");
        logger.info("[AMQP] attempting publisher handshake for new channel to publish on " + config.publisherExchange);
        amqpConn.createChannel(function(err, ch) {
            if (err) {
                logger.error('no channel');
                return reject(err);
            }

            ch.checkExchange(config.publisherExchange, function (err, ok) {
                if (err) {
                    logger.error('[AMQP] error finding exchange ' + config.publisherExchange);
                } else {
                    logger.info('[AMQP] success finding exchange ' + config.publisherExchange);
                    resolve(ch);

                }
            });
        });
    });
};

module.exports = Connect;
