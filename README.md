# SandySounds

The **only** non-client specific [Lavalink](https://github.com/Frederikam/Lavalink) client for JavaScript.

Most of the code is ported from [eris-lavalink](https://github.com/briantanner/eris-lavalink)

## Installation

`npm install sandysounds --save`

## Assumptions

SandySounds assumes that the `data` packet that you give to `voiceServerUpdate()` has the following:

1. All the data contained in a regular voiceStateUpdate packet
2. `session_id`
3. (OPTIONAL) `shard_id`