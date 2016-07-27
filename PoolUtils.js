'use strict';

var Connections =  [],
    DeadConnections = [],
    retry = true,
    logger,
    _ = require('lodash');

module.exports = function (_logger) {
    logger = _logger;
    return {
        service: {
            getCount: getCount,
            getConnectionDisplayData: getConnectionDisplayData,
            publishMessageToExchange: publishMessageToExchange,
            ackMessage: ackMessage,
            nackMessage: nackMessage
        },
        pool: {
            Connections: Connections,
            DeadConnections: DeadConnections,
            retry: retry,
            removeConnection: removeConnection,
            addHandlerConnPool: addHandlerConnPool,
            addConnection: addConnection,
            addDeadConnection: addDeadConnection,
            addPublisherConnections: addPublisherConnections,
            getConnectionByExchange: getConnectionByExchange,
            clearPools: clearPools,
            addChannel: addChannel,
            getConnection: getConnection,
            flushPool: flushPool,
            reviveConnection: reviveConnection
        }
    }
};

// Array Watches
Connections.push = function() { Array.prototype.push.apply(this, arguments);  ConnectionPoolChanged(true);};
Connections.splice = function() { Array.prototype.splice.apply(this, arguments);  ConnectionPoolChanged(false);};
DeadConnections.push = function() { Array.prototype.push.apply(this, arguments);  ConnectionPoolChanged(true);};
DeadConnections.splice = function() { Array.prototype.splice.apply(this, arguments);  ConnectionPoolChanged(false);};

function getCount(status) {
    status = (status === 'alive');
    return status ? Connections.length : DeadConnections.length
}

function getConnectionDisplayData() {
    var friendlyObjArray = [];

    var i = 0;
    if (Connections.length > 0) {
        for ( i = 0; i < Connections.length; i++) {
            if (Connections[i].registeredHandlers) {
                Connections[i].registeredHandlers.forEach(function (handler) {
                    var friendlyObj = {
                        guid: Connections[i].guid,
                        queueConfig: handler.queueConfig,
                        messageRate: handler.messageRate,
                        status: 'Alive'
                    };
                    friendlyObjArray.push(friendlyObj);
                });
            }
        }
    }

    if (Connections.length > 0) {
        for ( i = 0; i < Connections.length; i++) {
            if (Connections[i].registeredHandlers.length < 1) {
                Connections[i].registeredPublishers.forEach(function (publisher) {
                    console.log('looping through registered publishers');
                    console.log(publisher);
                    var friendlyObj = {
                        guid: Connections[i].guid,
                        queueConfig: publisher,
                        messageRate: 0,
                        status: 'Alive'
                    };
                    friendlyObjArray.push(friendlyObj);
                });
            }
        }
    }

    if (DeadConnections.length > 0) {
        for ( i = 0; i < DeadConnections.length; i++) {
            if (DeadConnections[i].registeredHandlers) {
                DeadConnections[i].registeredHandlers.forEach(function (handler) {
                    var friendlyObj = {
                        guid: DeadConnections[i].guid,
                        queueConfig: handler.queueConfig,
                        messageRate: handler.messageRate,
                        status: 'Dead'
                    };
                    friendlyObjArray.push(friendlyObj);
                });
            }
        }
    }

    if (DeadConnections.length > 0) {
        for (i = 0; i < DeadConnections.length; i++) {
            if (DeadConnections[i].registeredHandlers.length < 1) {
                DeadConnections[i].registeredPublishers.forEach(function (publisher) {
                    console.log('looping through registered publishers');
                    console.log(publisher);
                    var friendlyObj = {
                        guid: DeadConnections[i].guid,
                        queueConfig: publisher,
                        messageRate: 0,
                        status: 'Dead'
                    };
                    friendlyObjArray.push(friendlyObj);
                });
            }
        }
    }

    return friendlyObjArray;
}

function removeConnection(guid) {
    var i = _.findIndex(Connections, {guid:guid});
    if (i >= 0){
        console.log('found guid removing connection');
        Connections[i].channels = [];
        Connections[i].connection.close();
        DeadConnections.push(Connections[i]);
        _.remove(Connections, {guid:guid});
    } else {
        console.log('no matching guid found, not removing connection');
    }
}

function addHandlerConnPool(guid, handler) {
    var i = _.findIndex(Connections, {guid:guid});
    if (i >= 0){
        console.log('found guid adding handler to conn pool');
        Connections[i].registeredHandler = handler;
    } else {
        console.log('no matching guid found, not setting handler');
    }
}

// DONE
function addConnection(client) {
    clearPools(client.guid);
    Connections.push(client);
}

// DONE
function addDeadConnection(client) {
    clearPools(client.guid);
    console.log('[AMQP] DeadConnection added to pool');
    DeadConnections.push(client);
}

// DONE
function clearPools(guid){
    if (_.findIndex(Connections, guid) >= 0){
        console.log('found live connection to pull');
        _.pull(DeadConnections, client.guid);
    }

    if (_.findIndex(DeadConnections, guid) >= 0){
        console.log('found dead connection to pull');
        _.pull(DeadConnections, client.guid);
    }
}

// DONE
function addPublisherConnections(guid, publishers, ch) {
    var i = _.findIndex(Connections, {guid:guid});
    if (i >= 0){
        Connections[i].registeredPublishers = publishers;
        Connections[i].publisherChannel = ch;
    }
}

// DONE
function getConnectionByExchange(exchange) {

    var i = _.findIndex(Connections, {exchange:exchange});
    if (i >= 0){
        Connections[i].connection.close();
        DeadConnections.push(Connections[i]);
        _.remove(Connections, {exchange:exchange});
    }
}

// DONE
function addChannel(guid, ch) {
    var i = _.findIndex(Connections, {guid:guid});
    if (i >= 0){
        console.log('found guid adding channel to connection');
        Connections[i].channels.push(ch);
    } else {
        console.log('no matching guid found, not setting handler');
    }
}

// DONE
function getConnection(guid) {
    // return the connection
    return _.find(Connections, {guid:guid}) || _.find(DeadConnections, {guid:guid});
}

// DONE
function switchConnection(client, type){
    if (type === 'livetodead'){
        var i = _.findIndex(Connections, {guid:guid});
        if (i >= 0){
            console.log('found guid changing live conn to dead');
            DeadConnections.push(client);
            _.remove(DeadConnections, client);
        } else {
            console.log('no matching guid found, not setting handler');
        }
    } else if (type === 'deadtolive'){

    }
}

// DONE
function flushConn(guid, retry) {
    console.log('flush pool with retry called for guid');
    retry = retry || true;

    console.log('remove connection started ' + guid);

    var i = _.findIndex(Connections, {guid:guid});
    if (i >= 0){
        console.log('found guid removing live connection, retry', retry);
        Connections[i].connection.close();
        switchConnection(Connections[i]);
    } else {
        console.log('no matching guid found, not setting handler');
    }
}

// DONE
function flushPool(retry) {
    console.log('flush pool with retry called');
    _(Connections).forEach(function(conn) {
        flushConn(conn.guid, retry);
    });
}

// DONE
function reviveConnection(guid) {
    var i = _.findIndex(DeadConnections, {guid:guid});
    if (i >= 0){
        var connToRevive = DeadConnections[i];
        connToRevive.connect(connToRevive.configInternal).then(function(ch){
            connToRevive.registerHandlers(connToRevive.registerHandlers);
            connToRevive.registerPublishers(connToRevive.registerPublishers);
        });
    }
}

// NOT DONE
function publishMessageToExchange(exchange, auditkey, message) {
    console.log('publishing to exchange started');
    var ok;
    _.forEach(Connections, function (conn){
        _.forEach(conn.registeredPublishers, function(pub){
            if (pub === exchange) {
                console.log('found publisher on this connection, beginning publishing');
                ok = conn.publisherChannel.publish(exchange, auditkey, new Buffer(message));
                console.log('message publish ' + ok);
            }
        });
    });
    return ok;
}

// INTERNAL DONE
function uAck(msg, ackStatus, queue, type){
    _.forEach(Connections, function(conn){
        _.forEach(conn.channels, function(ch){
            if (queue === ch.queueConfig){

                if (type === 'ack'){
                    ch.ack(msg, ackStatus);
                } else {
                    ch.reject(msg, ackStatus);
                }
            }
        });
    });
}

// DONE
function ackMessage(msg, ackStatus, queue) {
    uAck(msg, ackStatus, queue, 'ack');
}

// DONE
function nackMessage(msg, ackStatus, queue) {
    uAck(msg, ackStatus, queue, 'nack');
}

// DONE
function ConnectionPoolChanged(added){
    if (added) {
        console.log('Pool change detected - Connections : ' + Connections.length + ' DeadConnections : ' + DeadConnections.length);
    }else {
        console.log('Pool change detected - Connections : ' + Connections.length + ' DeadConnections : ' + DeadConnections.length);
    }
}