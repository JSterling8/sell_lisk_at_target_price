require('dotenv').config();
const bittrex = require('node-bittrex-api');

const howOftenToCheckInSecs = 10;
const howOftenToCheckInMs = howOftenToCheckInSecs * 1000;
// TODO. Set automatically based on balance and current price (if no LSK, buy at 1% less than current price)
let targetLskUsdtPrice = process.env['TARGET_LSK_USDT_PRICE'];
// TODO. Set automatically based on balance and current price (if no LSK, buy at 1% less than current price)
let buyOrSell = process.env['BUY_OR_SELL'];
let spreadPercent = process.env['SPREAD_PERCENT'];

console.log('Buy or Sell:', buyOrSell);
console.log('Target LSK USDT Price:', targetLskUsdtPrice);
console.log('Key', process.env['API_KEY']);
console.log('Checking every ', howOftenToCheckInSecs + ' seconds.');

bittrex.options({
  'apikey': process.env['API_KEY'] || '',
  'apisecret': process.env['API_SECRET'] || ''
});

let awaitingOrderToBeTaken = false;

async function main() {

  if(!awaitingOrderToBeTaken) {

    const lskBtcPrice = await getSpotPriceForMarket('BTC-LSK');
    const btcUsdtPrice = await getSpotPriceForMarket('USDT-BTC');

    if (lskBtcPrice === -1 || btcUsdtPrice === -1) {
      console.log('Failed to get price(s). Will try again in ' + howOftenToCheckInSecs + ' seconds.');
      return;
    }

    const lskUsdtPrice = lskBtcPrice * btcUsdtPrice;

    console.log(new Date() + ': Current LSK price on Bittrex in USDT: ', lskUsdtPrice);

    if (buyOrSell === 'buy' && lskUsdtPrice <= targetLskUsdtPrice) {
      console.log("Triggered buy. Attempting...");
      try {
        await tradebuy(lskBtcPrice);
        awaitingOrderToBeTaken = true;
        setTimeout(function() {
          awaitingOrderToBeTaken = false;
        }, 30000);
        buyOrSell = 'sell';
        targetLskUsdtPrice = lskUsdtPrice * (1 + (spreadPercent / 100));
        console.log("Now awaiting sell. USDT sell target is: " + targetLskUsdtPrice);
      } catch (err) {
        console.log("Buy failed. Will retry in 10 seconds if price is still good...", err);
      }
    } else if(buyOrSell === 'sell' && lskUsdtPrice >= targetLskUsdtPrice) {
      console.log("Triggered sell. Attempting...");
      try {
        await tradesell(lskBtcPrice);
        awaitingOrderToBeTaken = true;
        setTimeout(function() {
          awaitingOrderToBeTaken = false;
        }, 30000);
        buyOrSell = 'buy';
        // If we sell at 10% up (say from 100->110), we want to buy back at 100 again, 10% of 110 is 11, not 10, hence the math below
        targetLskUsdtPrice = lskUsdtPrice * (100 / (100 * (1 + (spreadPercent / 100))));
        console.log("Now awaiting buy. USDT buy target is: " + targetLskUsdtPrice);
      } catch (err) {
        console.log("Sell failed. Will retry in 10 seconds if price is still good...", err);
      }
    }
  }
}

async function getLiskUsdtPrice() {
  const lskBtcPrice = await getSpotPriceForMarket('BTC-LSK');
  const btcUsdtPrice = await getSpotPriceForMarket('USDT-BTC');

  if (lskBtcPrice === -1 || btcUsdtPrice === -1) {
    return -1;
  }

  return lskBtcPrice * btcUsdtPrice;
}

async function getSpotPriceForMarket(market) {

  return new Promise(function(resolve) {
    bittrex.getticker({ market }, function (rate) {
      if(rate) {
        const ask = parseFloat(rate.result.Ask);
        const bid = parseFloat(rate.result.Bid);
        return resolve((bid + ask) / 2);
      } else {
        return resolve(-1);
      }
    })
  })
}

async function getBalance(currency) {

  return new Promise(function(resolve, reject) {
    bittrex.getbalance({
        currency
    }, function(data, err) {
      if (err) {
        console.log('Error occurred whilst getting balance:', err);
        return reject();
      } else {
        console.log(`Available ${currency} balance is ${data.result.Available}.`);
        return resolve(data.result.Available);
      }
    })
  })
}

async function tradesell(rate) {

  const quantityToTrade = await getBalance('LSK');

  return new Promise(function(resolve, reject) {
    bittrex.selllimit({
      market: 'BTC-LSK',
      quantity: quantityToTrade,
      rate: rate
      }, function (data, err) {
        if (err) {
          console.log('Trigger reached, but error occurred whilst creating sell order:', err);
          return reject(err);
        } else {
          console.log('Trigger reached and sell trade created:', data);
          return resolve();
        }
      }
    );
  })
}

async function tradebuy(rate) {

  const btcBalance = await getBalance('BTC');
  const quantityToTrade = (btcBalance / rate) - 0.5;

  return new Promise(function(resolve, reject) {

    if(quantityToTrade < 0) {
      reject("Not enough balance to trade");
    }

    bittrex.buylimit({
        market: 'BTC-LSK',
        quantity: quantityToTrade,
        rate: rate
      }, function (data, err) {
        if (err) {
          console.log('Trigger reached, but error occurred whilst buy creating order:', err);
          return reject(err);
        } else {
          console.log('Trigger reached and buy trade created:', data);
          return resolve();
        }
      }
    );
  })
}


main();
setInterval(main, howOftenToCheckInMs);