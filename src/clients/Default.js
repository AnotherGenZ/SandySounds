const functions = require('../functions');

class Client {
    constructor(functions) {
        this.functions = functions;

        functions.forEach(item => {
            if (!this.functions[item]) {
                console.error(`Missing ${item} in functions`);
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

    async sendWS(shard, op, packet) {
        return this.functions.sendWS(shard, op, packet);
    }
}