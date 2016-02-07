var handlers = [{
    handlerFunction: testFunctionOne,
    queueConfig: 'theQueue',
    messageRate: 1
}, {
    handlerFunction: testFunctionTwo,
    queueConfig: 'theQueue2',
    messageRate: 1
}];

publisherConfigs = [{
    publisherExchange: ''
}];

var testConfig = {
    rabbitmqserver: 'dev.rabbitmq.com',
    rabbitmqport: '',
    rabbitmqusername: '',
    rabbitmqpassword: '',
    subscribeexchange: 'testExchange',
    vhost: '',
    heartbeat: 60

};
var testData = {
    testHandlers: handlers,
    testConfig: testConfig
};

function testFunctionOne(msg) {
    console.log(msg);
    try {

        //TODO: Add implementation to update mongo

        // Respond that the message has been received and processed to the server, once this is sent the message will be deleted from the Queue
        this.ack(msg, true);
    } catch (err) {
        this.reject(msg, true);
    }
}

function testFunctionTwo(msg) {
    console.log(msg);
    try {

        //TODO: Add implementation to update mongo

        // Respond that the message has been received and processed to the server, once this is sent the message will be deleted from the Queue
        this.ack(msg, true);
    } catch (err) {
        // this.reject(msg, true);
        console.log(err);
    }
}

module.exports = testData;