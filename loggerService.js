var logger = {
    info: defaultLog,
    error: defaultLog,
    debug: defaultLog,
    fatal: defaultLog,
    trace: defaultLog,
    warn: defaultLog
};

function defaultLog(msg) {
    console.log(msg);
}

module.exports = logger;