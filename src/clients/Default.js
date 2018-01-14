class Client {
    constructor(functions) {
        this.functions = functions;

        ['getShard', 'getGuild', 'getChannel'].forEach(item => {
            if (!this.functions[item]) {
                console.error(`Missing ${item} in functions`);
            }
        });
    }

    async getShard(shardID) {
        return await this.functions.getShard(shardID);
    }

    async getChannel(channelID) {
        return await this.functions.getChannel(channelID);
    }

    async getGuild(guildID) {
        return await this.functions.getGuild(guildID);
    }

    async sendWS(shard, op, packet) {
        return await this.functions.sendWS(shard, op, packet);
    }
}