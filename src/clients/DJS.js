class DJSClient {
    constructor(client) {
        this.client = client;
    }

    getShard(shardID) {
        let shard = {
            status: 'disconnected'
        };

        if (this.client.status === 0) {
            shard.status = 'connected';
        }

        return shard;
    }

    getChannel(channelID) {
        let channel = this.client.channels.get(channelID);
        return channel;
    }

    getGuild(guildID) {
        let guildExists = this.client.guilds.has(guildID);
        return guildExists;
    }

    sendWS(shardID, op, packet) {
        this.client.ws.send({
            op: op,
            d: packet
        });
    }
}

module.exports = DJSClient;