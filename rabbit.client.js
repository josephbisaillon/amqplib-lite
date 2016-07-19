var amqp = require('amqplib/callback_api');
var util = require('./rabbit.util.js');
var utl = require('util');
var Q = require('q');
var EventEmitter = require('events');
var logger = {};

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
 * @param {Number} intervalInSeconds = interval that it will retry in seconds
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
function Connect(customLogger, maxRetry, intervalInSeconds) {

    if (intervalInSeconds){
        intervalInSeconds = (intervalInSeconds*1000);
    }

    logger = customLogger || require('./loggerService.js');
    this.interval = intervalInSeconds || (600 * 1000);
    this.guid = guid();
    this.maxRetries = maxRetry || 10;
    this.maxChannelRetries = maxRetry || 10;
    this.connectionAttempts = 0;
    this.channelAttempts = 0;
    this.publishExchange = {};
    this.publishChannel = {};
    this.connection = {};
    this.registeredHandlers = [];
    this.channels = [];
    this.registeredPublishers = [];
    this.configInternal = {};
    EventEmitter.call(this);
}
utl.inherits(Connect, EventEmitter);

function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16)+"000000000").substr(2,8);
        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
    }
    return _p8() + _p8(true) + _p8(true) + _p8();
}

Connect.ConnectionPool = require('./PoolUtils')(logger).pool;
Connect.service = require('./PoolUtils')(logger).service;

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
    context.configInternal = config;

    return Q.ninvoke(amqp, "connect", util.buildRabbitMqUrl(context.configInternal)).then(function (conn, err) {

        if (err){
            logger.error('[AMQP] caught exception');
        }

        context.connectionAttempts += 1;
        logger.info("Connection in progress...attempts: " + context.connectionAttempts);

        conn.on("error", function (err) {
            if (err.message !== "Connection closing") {
                logger.error("[AMQP] conn error", err);
                conn.close();
            }
        });

        conn.on("close", function (err) {
            logger.error(err);

            logger.trace("[AMQP] reconnecting");
            logger.info('[AMQP] Connection attempts: ' + context.connectionAttempts + ' Maximum attempts: ' + context.maxRetries);

            var serverDisconnect = false;

            if (err){
                var substring = '320';
                if (err.indexOf(substring) > -1){
                    logger.trace('[AMQP] Connection has been force closed by the server');
                    serverDisconnect = true;
                }
            }

            Connect.ConnectionPool.removeConnection(context.guid);


            if ((context.connectionAttempts < context.maxRetries && Connect.ConnectionPool.retry) || serverDisconnect) {
                logger.trace('[AMQP] retry?: ' + Connect.ConnectionPool.retry + ' disconnect came from server?: ' + serverDisconnect);
                return setTimeout(function () {
                    context.connect(config).then(function (conn) {
                        context.registerHandlers(context.registeredHandlers);
                        context.registerPublishers(context.registeredPublishers);
                    })
                }, context.interval);
            }
            else
            {
                context.emit('failure', 'failed to connect after ' + context.maxRetries + ' tries.');
                logger.trace('[AMQP] done retrying')
            }
        });

        logger.info("[AMQP] has successfully created a connection");
        context.connectionAttempts = 0;
        context.channelAttempts = 0;
        Connect.ConnectionPool.removeConnection(context.guid);
        Connect.ConnectionPool.addConnection(context);
        context.connection = conn;
        logger.trace('New connection added new count : ' + Connect.ConnectionPool.Connections.length);
        return conn;

    }).catch(function (err) {

        context.connectionAttempts += 1;
        logger.error("[AMQP] " + err.message);
        logger.trace('[AMQP] Connection attempts: ' + context.connectionAttempts + ' Maximum attempts: ' + context.maxRetries);
        if (context.connectionAttempts < context.maxRetries) {
            logger.trace('[AMQP] attempting reconnect');
            return setTimeout(function () {
                context.connect(config).then(function (conn) {
                    context.registerHandlers(context.handlers);
                    context.registerPublishers(context.registeredPublishers);
                })
            }, context.interval);
        }
        else
        {
            context.emit('failure', 'failed to connect after ' + context.maxRetries + ' tries.');
            Connect.ConnectionPool.clearPools(context.guid);
            Connect.ConnectionPool.addDeadConnection(context);
        }
    });
}

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
Connect.prototype.setUpListener = function(messageRate) {
    var context = this;
    return Q.ninvoke(context.connection, 'createChannel').then(function (ch) {

        ch.on("error", function (err) {
            logger.error("[AMQP] channel error " + err);
        });
        ch.on("close", function () {
            logger.error("[AMQP] Channel closed");
            context.channelAttempts = context.channelAttempts + 1;
            if (context.maxChannelRetries > context.channelAttempts) {
                logger.trace('[AMQP] retry channel connection again');
                logger.trace('[AMQP] ' + context.maxChannelRetries + ' attempts: ' + context.channelAttempts);
                context.registerHandlers(context.registeredHandlers);
            } else {
                logger.info('You have exceeded the maximum channel retry, not closing channel');
                context.connectionAttempts = context.maxRetries;
                // retry the connection forever
                Connect.ConnectionPool.flushPool(context.guid);

            }
        });
        logger.trace("[AMQP] Channel prefetch rate set to " + messageRate);
        ch.prefetch(messageRate); // limit the number of messages that are read to 1, once the server receives an acknowledgement back it will then send another
        return ch;
    });
}

/**
 * This function should be fired when the main amqp connection has been fired
 * @memberof Listener
 * @param {array} handlers - Takes in an array of confuration settings to loop through and create queue connections for
 */
Connect.prototype.registerHandlers = function(handlers) {

    var context = this;
    context.registeredHandlers = handlers || context.registeredHandlers;
    logger.trace("[AMQP] Beginning channel connections");

    Connect.ConnectionPool.addHandlerConnPool(context.guid, handlers);

    context.registeredHandlers.forEach(function (handler) {
        logger.trace("[AMQP] attempting queue listener handshake for " + handler.queueConfig);
        context.setUpListener(handler.messageRate)
            .then(function (ch) {
                logger.trace("[AMQP] Success handshake complete, listening on " + handler.queueConfig);
                // ch.consume(handler.queueConfig, handler.handlerFunction.bind(ch), {noAck: false});
                ch.consume(handler.queueConfig, handler.handlerFunction, {noAck: false});
                ch.queueConfig = handler.queueConfig;
                Connect.ConnectionPool.addChannel(context.guid, ch);
            }).catch(function (err) {
            if (err) {
                logger.error("[AMQP] " + err.message);
            }
        });
    });

}

/**
 * Used to register new channels on connections that exist, it also checks that the publishing exchange is reachable
 * @param config
 * @param amqpConn
 */
Connect.prototype.registerPublishers = function(config){
    var context = this;

    logger.trace("[AMQP] Tieing publishers to this connection - GUID:" + context.guid);
    context.registeredPublishers = config || context.registeredPublishers;

    context.connection.createChannel(function(err, ch) {
        if (err) {
            logger.error('[AMQP] no was properly opened for publishers on connection');
        } else {
            logger.trace('[AMQP] Channel was created and added to publishers connection');
            Connect.ConnectionPool.addPublisherConnections(context.guid, context.registeredPublishers, ch);
        }
    });
}


module.exports = Connect;
