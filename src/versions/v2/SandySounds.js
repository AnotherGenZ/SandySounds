const Node = require('./Node');
const Player = require('./Player');
const regions = require('../regions');

let EventEmitter;

try {
    EventEmitter = require('eventemitter3');
} catch (err) {
    EventEmitter = require('events').EventEmitter;
}

class SandySounds extends EventEmitter {

    constructor(client, nodes, options) {
        super();
        this.client = client;
        this.players = new Map;
        this.nodes = new Map();
        this.pendingGuilds = {};
        this.options = options || {};
        this.failoverQueue = [];
        this.failoverRate = options.failoverRate || 250;
        this.failoverLimit = options.failoverLimit || 1;

        this.defaultRegions = regions;
        this.regions = options.regions || this.defaultRegions;

        for (let node of nodes) {
            this.createNode(Object.assign({}, node, options));
        }
    }


    createNode(options) {
        let node = new Node({
            host: options.host,
            port: options.port,
            region: options.region,
            numShards: options.numShards,
            userId: options.userId,
            password: options.password,
        });

        node.on('error', this.onError.bind(this, node));
        node.on('disconnect', this.onDisconnect.bind(this, node));
        node.on('message', this.onMessage.bind(this, node));

        this.nodes.set(options.host, node);
        this.emit('nodeCreate', node);
    }


    removeNode(host) {
        let node = this.nodes.get(host);
        if (!host) return;
        node.destroy();
        this.nodes.delete(host);
        this.onDisconnect(node);
    }


    checkFailoverQueue() {
        if (this.failoverQueue.length > 0) {
            let fns = this.failoverQueue.splice(0, this.failoverLimit);
            for (let fn of fns) {
                this.processQueue(fn);
            }
        }
    }


    queueFailover(fn) {
        if (this.failoverQueue.length > 0) {
            this.failoverQueue.push(fn);
        } else {
            return this.processQueue(fn);
        }
    }


    processQueue(fn) {
        fn();
        setTimeout(() => this.checkFailoverQueue(), this.failoverRate);
    }

    onError(node, err) {
        this.emit(err);
    }


    onDisconnect(node, msg) {
        let players = Array.from(this.nodes.values())(player => player.node.host === node.host);
        for (let player of players) {
            this.queueFailover(this.switchNode.bind(this, player, true));
        }
    }


    shardReady(id) {
        let players = Array.from(this.players.values()).filter(player => player.shard && player.shard === id);
        for (let player of players) {
            this.queueFailover(this.switchNode.bind(this, player));
        }
    }

    switchNode(player, leave) {
        let { guildId, channelId, track } = player,
            position = (player.state.position || 0) + (this.options.reconnectThreshold || 2000);

        let listeners = player.listeners('end'),
            endListeners = [];

        if (listeners && listeners.length) {
            for (let listener of listeners) {
                endListeners.push(listener);
                player.removeListener('end', listener);
            }
        }

        player.once('end', () => {
            for (let listener of endListeners) {
                player.on('end', listener);
            }
        });

        this.players.delete(guildId);

        player.playing = false;

        if (leave) {
            player.updateVoiceState(null);
        } else {
            player.node.send({ op: 'disconnect', guildId: guildId });
        }

        process.nextTick(() => {
            this.join(guildId, channelId, null, player).then(player => {
                player.play(track, { startTime: position });
                player.emit('reconnect');
                this.players.set(guildId, player);
            })
                .catch(err => {
                    player.emit('disconnect', err);
                    player.disconnect();
                });
        });
    }


    async onMessage(node, message) {
        if (!message.op) return;

        switch (message.op) {
            case 'playerUpdate': {
                let player = this.players.get(message.guildId);
                if (!player) return;

                return player.stateUpdate(message.state);
            }
            case 'event': {
                let player = this.players.get(message.guildId);
                if (!player) return;

                switch (message.type) {
                    case 'TrackEndEvent':
                        return player.onTrackEnd(message);
                    case 'TrackExceptionEvent':
                        return player.onTrackException(message);
                    case 'TrackStuckEvent':
                        return player.onTrackStuck(message);
                    default:
                        return player.emit('warn', `Unexpected event type: ${message.type}`);
                }
            }
        }
    }


    async join(guildId, channelId, options, player) {
        options = options || {};

        player = player || this.players.get(guildId);
        if (player && player.channelId !== channelId) {
            player.switchChannel(channelId);
            return Promise.resolve(player);
        }

        let region = this.getRegionFromData(options.region || 'us');
        let node = await this.findIdealNode(region);

        if (!node) {
            return Promise.reject('No available voice nodes.');
        }

        return new Promise((res, rej) => {
            this.pendingGuilds[guildId] = {
                channelId: channelId,
                options: options || {},
                player: player || null,
                node: node,
                res: res,
                rej: rej,
                timeout: setTimeout(() => {
                    node.send({ op: 'disconnect', guildId: guildId });
                    delete this.pendingGuilds[guildId];
                    rej(new Error('Voice connection timeout'));
                }, 10000),
            };

            node.send({
                op: 'connect',
                guildId: guildId,
                channelId: channelId,
            });
            this.client.sendWS();
        });
    }


    async leave(guildId) {
        let player = this.players.get(guildId);
        if (!player) {
            return;
        }
        player.disconnect();
        this.players.delete(player);
    }


    async findIdealNode(region) {
        let nodes = [...this.nodes.values()].filter(node => !node.draining && node.ws && node.connected);

        if (region) {
            let regionalNodes = nodes.filter(node => node.region === region);
            if (regionalNodes && regionalNodes.length) {
                nodes = regionalNodes;
            }
        }

        nodes = nodes.sort((a, b) => {
            let aload = a.stats.cpu ? (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100 : 0,
                bload = b.stats.cpu ? (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100 : 0;
            return aload - bload;
        });
        return nodes[0];
    }


    async voiceServerUpdate(data) {
        if (this.pendingGuilds[data.guild_id] && this.pendingGuilds[data.guild_id].timeout) {
            clearTimeout(this.pendingGuilds[data.guild_id].timeout);
            this.pendingGuilds[data.guild_id].timeout = null;
        }

        let player = this.players.get(data.guild_id);
        if (!player) {
            if (!this.pendingGuilds[data.guild_id]) {
                return;
            }

            player = this.pendingGuilds[data.guild_id].player;

            if (player) {
                player.sessionId = data.sessionId;
                player.hostname = this.pendingGuilds[data.guild_id].hostname;
                player.node = this.pendingGuilds[data.guild_id].node;
                player.event = data;
                this.players.set(data.guild_id, player);
            }

            player = player || this.players.set(new Player(data.guild_id, {
                shardID: data.shard_id,
                guildId: data.guild_id,
                sessionId: data.session_id,
                channelId: this.pendingGuilds[data.guild_id].channelId,
                hostname: this.pendingGuilds[data.guild_id].hostname,
                node: this.pendingGuilds[data.guild_id].node,
                options: this.pendingGuilds[data.guild_id].options,
                event: data,
                manager: this,
            }));

            player.connect({
                sessionId: data.session_id,
                guildId: data.guild_id,
                channelId: this.pendingGuilds[data.guild_id].channelId,
                event: {
                    endpoint: data.endpoint,
                    guild_id: data.guild_id,
                    token: data.token,
                },
            });
        }

        let disconnectHandler = () => {
            player = this.players.get(data.guild_id);
            if (!this.pendingGuilds[data.guild_id]) {
                if (player) {
                    player.removeListener('ready', readyHandler);
                }
                return;
            }
            player.removeListener('ready', readyHandler);
            this.pendingGuilds[data.guild_id].rej(new Error('Disconnected'));
            delete this.pendingGuilds[data.guild_id];
        };

        let readyHandler = () => {
            player = this.players.get(data.guild_id);
            if (!this.pendingGuilds[data.guild_id]) {
                if (player) {
                    player.removeListener('disconnect', disconnectHandler);
                }
                return;
            }
            player.removeListener('disconnect', disconnectHandler);
            this.pendingGuilds[data.guild_id].res(player);
            delete this.pendingGuilds[data.guild_id];
        };

        player.once('ready', readyHandler).once('disconnect', disconnectHandler);
    }


    getRegionFromData(endpoint) {
        if (!endpoint) return this.options.defaultRegion || 'us';

        endpoint = endpoint.replace('vip-', '');

        for (let key in this.regions) {
            let nodes = Array.from(this.nodes.values()).filter(n => n.region === key);
            if (!nodes || !nodes.length) continue;
            if (!nodes.find(n => n.connected && !n.draining)) continue;
            for (let region of this.regions[key]) {
                if (endpoint.startsWith(region)) {
                    return key;
                }
            }
        }

        return this.options.defaultRegion || 'us';
    }
}

module.exports = SandySounds;
