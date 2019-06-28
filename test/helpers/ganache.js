function send(method, params = []) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        }, (err, res) => {
            return err ? reject(err) : resolve(res);
        });
    });
}

function takeSnapshot() {
    return send('evm_snapshot')
}

function revertSnapshot(id) {
    return send('evm_revert', [id])
}

function mineBlock(timestamp) {
    return send('evm_mine', [timestamp])
}

function increaseTime(seconds) {
    return send('evm_increaseTime', [seconds])
}

function minerStop() {
    return send('miner_stop', [])
}

function minerStart() {
    return send('miner_start', [])
}

module.exports = {
    takeSnapshot,
    revertSnapshot,
    mineBlock,
    minerStop,
    minerStart,
    increaseTime
}
  