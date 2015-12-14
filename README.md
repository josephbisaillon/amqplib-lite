# RabbitMQ Integration services

Use this lightweight library to integrate with rabbitmq. 

All implementation is built into the listener service, simply use listener.start and pass it your configuration

One connection is used per client instance, this connection can open up multiple channels, each channel is a connection to one Queue and will
have a message callback function that you pass into it. 

## Features
1. Subscriber functionality

~~2. Publisher functionality (coming soon)~~

~~3. Test using mock service (TBA)~~

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

 function testProcess1(msg) {
     var data = JSON.parse(msg.content.toString());
     console.log(JSON.stringify(data));
     try {

         //TODO: Add implementation to update mongo

         // Respond that the message has been received and processed to the server, once this is sent the message will be deleted from the Queue
         this.ack(msg, true);
     } catch (err) {
         this.reject(msg, true);
     }
 }

 function testProcess2(msg) {
     var data = JSON.parse(msg.content.toString());
     console.log(JSON.stringify(data));
     try {

         //TODO: Add implementation to update mongo

         // Respond that the message has been received and processed to the server, once this is sent the message will be deleted from the Queue
         this.ack(msg, true);
     } catch (err) {
        this.reject(msg, true);
        // console.log(err);
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
 }, {
     handlerFunction: testProcess2,
     queueConfig: 'Your.Second.Queue',
     messageRate: 1
 }];
 
 // Custom logger passed in
 var client = new amqpService(customLogObj);
 client.start(handlers,config);
 
 // No custom logger pass in
 var client = new amqpService();
 client.start(handlers,config);
 
```

## Contact
If you have any questions contact Joseph Bisallon
