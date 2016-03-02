/**
 * Module containing util functions for RabbitMq
 * @module rabbit/util
 */

/**
 * @type {Object}
 * @property {function} buildRabbitMqUrl(String) - build amqp connection string
 * @property {function} validateJson(String) - validate string is in valid JSON format
 * @property {function} cleanData(String) - change $type to type
 */
var service = {
    buildRabbitMqUrl: buildRabbitMqUrl,
    validateJson: IsJsonString,
    cleanData: cleanData
};

/**
 * Builds the RabbitMqUrl connection string
 * @param {String} config - configuration for connection string
 * @returns {String} amqpConnString - returns amqp connection string
 * @example
 *
 * var util = require('rabbit.util.js');
 *
 * var config = {
 *     rabbitmqserver: 'localhost',
 *     rabbitmqport: 5672,
 *     rabbitmqusername: 'User_Name',
 *     rabbitmqpassword: 'Pass_Word',
 *     subscribequeue: 'Your.Target.Queue',
 *     vhost: 'YOUR-VHOST'
 * };
 *
 * var connString = util.buildRabbitMqUrl(config)
 * console.log(connString);
 */
function buildRabbitMqUrl(config){
    var auth = '';
    var heartbeat = config.rabbitheartbeat || 0;
    if((config.rabbitmqusername + config.rabbitmqpassword) != ''){
        auth = config.rabbitmqusername + ':' + config.rabbitmqpassword + '@';
    }
    return 'amqp://' + auth + config.rabbitmqserver + ':' + config.rabbitmqport + '/' + config.vhost + '?heartbeat=' + heartbeat;
}

/**
 * Checks string to see if it is valid JSON
 * @param {String} str - string to check if is valid JSON
 * @returns {boolean} - true if string is JSON formatted, false if string is not JSON formatted
 * @example
 *
 * var util = require('rabbit.util.js')
 *
 * var testString = '{"employee":"John"}';
 *
 * console.log(util.IsJsonString(testString));
 * // will print true because the string is valid JSON
 *
 */
function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * parses through string and replaces "$type" by "type"
 * @param data {String} - string to replace "$type" by "type"
 * @returns {string|void|XML}
 * @example
 *
 * var util = require('rabbit.util.js')
 *
 * var testString = 'foo $type Bar';
 *
 * console.log(util.cleanData(testString));
 * // will print 'foo type Bar'
 *
 */
function cleanData(data) {
    var cleandata = data.replace("$type","type");
    return cleandata;
}


module.exports = service;