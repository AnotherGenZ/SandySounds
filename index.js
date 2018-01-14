const Sandysounds = require('./src/SandySounds');
const DefaultClient = require('./src/clients/Default');

function SandySounds(...args) {
    return new Sandysounds(...args);
}

SandySounds.Clients = {
    Default: DefaultClient
};

module.exports = SandySounds;