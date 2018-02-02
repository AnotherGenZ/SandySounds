const requiredFunctions = require('../functions');

class Client {
    constructor(functions) {
        this.functions = functions;

        requiredFunctions.forEach(item => {
            if (!this.functions[item]) {
                throw new Error(`Missing ${item} in functions`);
            }
        });
    }

    async getShard(shardID) {
        return this.functions.getShard(shardID);
    }

    async getChannel(channelID) {
        return this.functions.getChannel(channelID);
    }

    async getGuild(guildID) {
        return this.functions.getGuild(guildID);
    }

    async sendWS(shardID, op, packet) {
        return this.functions.sendWS(shardID, op, packet);
    }
}

module.exports = Client;