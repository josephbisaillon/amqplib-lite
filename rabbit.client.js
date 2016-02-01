var amqp = require('amqplib/callback_api');
var util = require('./rabbit.util.js');
var Q = require('q');
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
 * @example
 * var subscriber = require('amqplib-lite');
 *
 * // Custom logger passed in
 * var client = new subscriber(customLogObj);
 * client.start(handlers,config);
 *
 * // No custom logger pass in
 * var client = new subscriber();
 * client.start(handlers,config);
 *
 */
function Connect(customLogger) {
    logger = customLogger || require('./loggerService.js');
}

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
 * @property {String} subscribequeue - RabbitMqServer queue that you wish to subscribe to.
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
        logger.info("Connection in progress...");

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

            return setTimeout(function() {context.connect(config)}, 1000);
        });

        console.log("[AMQP] connected");
        logger.info("[AMQP] has connected successfully");
        return conn;

    }).catch(function (err) {
        console.error("[AMQP]", err.message);
        logger.error("[AMQP] " + err.message);
        return setTimeout(function() {context.connect(config)}, 1000);

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
function setUpListener(messageRate, amqpConn) {
    return Q.ninvoke(amqpConn, 'createChannel').then(function (ch) {

        ch.on("error", function (err) {
            console.error("[AMQP] channel error", err);
            logger.error("[AMQP] channel error " + err);
        });
        ch.on("close", function () {
            console.log("[AMQP] Channel closed");
            logger.info("[AMQP] Channel closed");
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
    logger.info("[AMQP] Beginning channel connections");
    handlers.forEach(function (handler) {
        logger.info("[AMQP] attempting queue listener handshake for " + handler.queueConfig);
        setUpListener(handler.messageRate, amqpConn)
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

Connect.prototype.registerPublishers = function(handler, amqpConn){
    logger.info("[AMQP] Beginning publisher connections");
    var publishers = {};
    handlers.forEach(function (handler) {
        logger.info("[AMQP] attempting publisher handshake for " + handler.queueConfig);
        createChannel(amqpConn)
            .then(function (ch) {
                logger.info("[AMQP] Success handshake complete, listening on " + handler.queueConfig);
                publishers[handler.publisherExchange] = ch;
            }).catch(function (err) {
            if (err) {
                console.log(err);
                logger.fatal("[AMQP] " + err.message);
            }
        });
    });
    return publishers;
};

module.exports = Connect;