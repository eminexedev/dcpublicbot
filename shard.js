const { ShardingManager } = require('discord.js');
const config = require('./config.json');

let manager = new ShardingManager('./index.js', {
    token: env.var.DISCORD_TOKEN,
    totalShards: 'auto',
});

manager.on('shardCreate', shard => {
    console.log(`[SHARDS]: Launched shard ${shard.id}.`)
});

manager.on('connection', shard => {
     console.log(`[SHARDS]: Shard ${shard.id} connected.`)
}); // Built by yunuservices :smirk:

manager.spawn();