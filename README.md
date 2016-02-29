# RabbitMQ Integration services

Use this lightweight library to integrate with rabbitmq. 

All implementation is built into the listener service.

One connection is used per client instance, this connection can open up multiple channels, each channel is a connection to one Queue and will
have a message callback function that you pass into it. The callback function for the has a channel binded tied to it for publishing.

## [Documentation](https://cdn.rawgit.com/josephbisaillon/amqplib-lite/master/jsdoc_build/docs/index.html)

## Features
1. Subscriber functionality

2. Publisher functionality

3. Starting with version 0.2.0 an internal connection pool is maintained within amqplib-lite.

~~4. Test using mock service (TBA)~~

## Usage

1. npm install amqplib-lite

## Example
```
 var subscriber = require('amqplib-lite');
 
 var config = {
    rabbitmqserver: 'dev.rabbitmq.com',
    rabbitmqport: '',
    rabbitmqusername: '',
    rabbitmqpassword: '',
    subscribeexchange: 'testExchange',
    vhost: ''

 };
 
 // This handler function will response to the ack or reject the message based on business logic. It will also publish to an exchange using the existing
 // channel connection that exists in the context of the handler. 
 function testProcess1(msg) {
     var context = this;
     
     function publishResponseToExchange(Response){
               var publishConfigs = { 
                              PUBLISH_EXCHANGE: 'Events.Status.Exchange',
                              PUBLISH_AUDIT_KEY: 'NAT' };
                                            
              var ok = context.publish(publishConfigs.PUBLISH_EXCHANGE, publishConfigs.PUBLISH_AUDIT_KEY, new Buffer(Response));
              
              if (ok){
              console.log('published successfully');
              } else {
              console.log('publish failed');
              }
     }
     
     var data = JSON.parse(msg.content.toString());
     console.log(JSON.stringify(data));
     try {

         //TODO: Add implementation to update mongo

         // You can send a message now to an exchange that your processing worked or some other dependent message.
         publishResponseToExchange('HELLO WORLD');
         
         // Respond that the message has been received and processed to the server, once this is sent the message will be deleted from the Queue
         context.ack(msg, true);
     } catch (err) {
         // you can publish a message on failures now to notify other systems, etc.
         publishResponseToExchange('I FAILED :(');
            
         // reject the message, an error happened during processing
         context.reject(msg, true);
     }
 }

 var customLogObj = {
    info : LogMe,
    error : LogMe,
    debug : LogMe,
    fatal : LogMe,
    trace : LogMe,
    warn : LogMe
 };

 function LogMe(msg) {
    console.log('test ' + msg);
 }

 var handlers = [{
     handlerFunction: testProcess1,
     queueConfig: 'Your.First.Queue',
     messageRate: 1
 }];
 
// Custom logger passed in
let client = new RabbitClient(logger);
client.handlers = handlers; // when a disconnect happens this handler property will be used to reconnect internally
client.connect(config).then((connection) => {
    client.registerHandlers(handlers, connection);
}).catch(error => {
    logger.error("Error occurred while bootstrapping queue handlers: ", error);
});

 
 // No custom logger pass in
let client = new RabbitClient();
client.handlers = handlers; // when a disconnect happens this handler property will be used to reconnect internally
client.connect(config).then((connection) => {
    client.registerHandlers(handlers, connection);
}).catch(error => {
    logger.error("Error occurred while bootstrapping queue handlers: ", error);
});
 
```

## Internal Connection Pool *new

example
```
var rabbitMQ = require('amqplib-lite');

// flushes pool and does not bring the connection back. 
rabbitMQ.ConnectionPool.flushPoolNoRetry();


```
  getConnectionCount
  getDeadConnectionCount
  getConnectionDisplayData
  removeConnection
  addHandlerConnPool
  addConnection
  flushPoolRetry
  flushPoolNoRetry
  reviveConnection


## Contact
If you have any questions contact Joseph Bisaillon
