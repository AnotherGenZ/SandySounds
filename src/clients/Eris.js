class ErisClient {
    constructor(client) {
        this.client = client;
    }

    getShard(shardID) {
        let shard = this.client.shards.get(shardID);
        return shard;
    }

    getChannel(channelID) {
        let channel = this.client.getChannel(channelID);
        return channel;
    }

    getGuild(guildID) {
        let guildExists = this.client.guilds.has(guildID);
        return guildExists;
    }

    sendWS(shardID, op, packet) {
        let shard = this.client.shards.get(shardID);
        shard.sendWS(op, packet);
    }
}

module.exports = ErisClient;