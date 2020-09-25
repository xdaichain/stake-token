const http = require('http');
const Web3 = require('web3');

const web3 = new Web3(process.env.RPC_URL || 'https://mainnet.infura.io/v3/1125fe73d87c4e5396678f4e3089b3dd');
const BN = web3.utils.BN;

const refreshInterval = parseInt(process.env.REFRESH_INTERVAL || 10); // in seconds

// Token contract instance on Ethereum Mainnet
const tokenContract = new web3.eth.Contract(
  [{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}],
  '0x0Ae055097C6d159879521C384F1D2123D1f195e6'
);

// Parse BURN_ADDRESSES
const zeroAddress = '0x0000000000000000000000000000000000000000';
let burnAddresses = process.env.BURN_ADDRESSES || zeroAddress;
burnAddresses = burnAddresses.split(',');
if (!burnAddresses.includes(zeroAddress)) {
  burnAddresses.push(zeroAddress);
}

// Health API variables
let status = 'success'; // can be 'success' or 'error'
let lastSuccessDatetime = '';
let lastErrorDatetime = '';
let lastError = '';

// Handle HTTP requests
let circulatingSupply = '0';
let totalSupply = '0';
const server = http.createServer(async (req, res) => {
  if (req.url === '/total') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(totalSupply);
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(circulatingSupply);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/json' });

    const lastSuccessTimestamp = lastSuccessDatetime ? Date.parse(lastSuccessDatetime) / 1000 : 0;
    const lastErrorTimestamp = lastErrorDatetime ? Date.parse(lastErrorDatetime) / 1000 : 0;
    const secondsSinceLastSuccess = Math.floor(Date.now() / 1000 - lastSuccessTimestamp);
    const secondsSinceLastError = Math.floor(Date.now() / 1000 - lastErrorTimestamp);

    res.end(JSON.stringify({
      status,
      currentDatetime: currentDatetime(),
      lastSuccessDatetime,
      secondsSinceLastSuccess,
      lastErrorDatetime,
      secondsSinceLastError,
      lastError,
      supplyRefreshInterval: refreshInterval
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(process.env.PORT || 3000);
readSupply();

// Reads and calculates supply
async function readSupply() {
  try {
    let promises = [];
    const batch = new web3.BatchRequest();

    promises.push(new Promise((resolve, reject) => {
      batch.add(tokenContract.methods.totalSupply().call.request((err, result) => {
        if (err) reject(err);
        else resolve(result);
      }));
    }));
    promises.push(new Promise((resolve, reject) => {
      batch.add(tokenContract.methods.balanceOf('0x9BC4a93883C522D3C79c81c2999Aab52E2268d03').call.request((err, result) => {
        if (err) reject(err);
        else resolve(result);
      }));
    }));
    promises.push(new Promise((resolve, reject) => {
      batch.add(tokenContract.methods.balanceOf('0x3cFE51b61E25750ab1426b0072e5D0cc5C30aAfA').call.request((err, result) => {
        if (err) reject(err);
        else resolve(result);
      }));
    }));
    promises.push(new Promise((resolve, reject) => {
      batch.add(tokenContract.methods.balanceOf('0x0218B706898d234b85d2494DF21eB0677EaEa918').call.request((err, result) => {
        if (err) reject(err);
        else resolve(result);
      }));
    }));
    for (let i = 0; i < burnAddresses.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        batch.add(tokenContract.methods.balanceOf(burnAddresses[i]).call.request((err, result) => {
          if (err) reject(err);
          else resolve(result);
        }));
      }));
    }

    await batch.execute();
    const results = await Promise.all(promises);

    const totalSupplyBN = new BN(results[0]);

    if (totalSupplyBN.isZero()) {
      throw Error('Error: totalSupply is zero');
    } else {
      totalSupply = web3.utils.fromWei(totalSupplyBN);
    }

    const distributionBalance = new BN(results[1]);
    const privateOfferingBalance = new BN(results[2]);
    const advisorsRewardBalance = new BN(results[3]);

    let zeroBalance = new BN(0);
    for (let i = 4; i < results.length; i++) {
      zeroBalance = zeroBalance.add(new BN(results[i]));
    }
    
    circulatingSupply = web3.utils.fromWei(
      totalSupplyBN
        .sub(distributionBalance)
        .sub(privateOfferingBalance)
        .sub(advisorsRewardBalance)
        .sub(zeroBalance)
    );

    log(`${circulatingSupply}, ${totalSupply}`);

    status = 'success';
    lastSuccessDatetime = currentDatetime();
  } catch (e) {
    status = 'error';
    lastError = e.message;
    lastErrorDatetime = currentDatetime();
    log(e.message);
  }

  setTimeout(readSupply, refreshInterval * 1000); // update every refreshInterval seconds
}

// Prints log message with the current time
function log(message) {
  console.log(`${currentDatetime()} ${message}`);
}

function currentDatetime() {
  const now = new Date;
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() - 0 + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');
  const hours = (now.getUTCHours() - 0).toString().padStart(2, '0');
  const minutes = (now.getUTCMinutes() - 0).toString().padStart(2, '0');
  const seconds = (now.getUTCSeconds() - 0).toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}
