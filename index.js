require('dotenv').config();
const bittrex = require('node-bittrex-api');

const howOftenToCheckInSecs = 10;
const howOftenToCheckInMs = howOftenToCheckInSecs * 1000;
let targetLskUsdtPrice = process.env['TARGET_LSK_USDT_PRICE'];
let buyOrSell = process.env['BUY_OR_SELL'];

console.log('Buy or Sell:', buyOrSell);
console.log('Target LSK USDT Price:', targetLskUsdtPrice);
console.log('Key', process.env['API_KEY']);
console.log('Checking every ', howOftenToCheckInSecs + ' seconds.');

bittrex.options({
  'apikey': process.env['API_KEY'] || '',
  'apisecret': process.env['API_SECRET'] || ''
});


async function main() {

  const lskBtcPrice = await getLastPriceForMarket('BTC-LSK');
  const btcUsdtPrice = await getLastPriceForMarket('USDT-BTC');

  if (lskBtcPrice === -1 || btcUsdtPrice === -1) {

    console.log('Failed to get price(s). Will try again in ' + howOftenToCheckInSecs + ' seconds.');

    return;
  }

  const lskUsdtPrice = lskBtcPrice * btcUsdtPrice;

  console.log(new Date() + ': Current LSK price on Bittrex in USDT: ', lskUsdtPrice);

  if (buyOrSell === 'buy' && lskUsdtPrice <= targetLskUsdtPrice) {
    console.log("Triggered buy. Attempting...");
    await tradesell(lskBtcPrice);
    buyOrSell = 'buy';
    targetLskUsdtPrice = lskUsdtPrice * 0.909090909;
  } else if(buyOrSell === 'sell' && lskUsdtPrice >= targetLskUsdtPrice) {
    console.log("Triggered sell. Attempting...");
    await tradebuy(lskBtcPrice);
    buyOrSell = 'sell';
    targetLskUsdtPrice = lskUsdtPrice * 1.1;
  }
}

async function getLastPriceForMarket(market) {

  return new Promise(function(resolve) {
    bittrex.getticker({ market }, function (rate) {
      if(rate) {
        return resolve(parseFloat(rate.result.Last));
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

  return new Promise(function(resolve) {
    bittrex.tradesell({
        MarketName: 'BTC-LSK',
        OrderType: 'LIMIT',
        Quantity: quantityToTrade,
        Rate: rate,
        TimeInEffect: 'GOOD_TIL_CANCELLED',
        ConditionType: 'NONE',
        Target: 0
      }, function (data, err) {

        if (err) {
          console.log('Trigger reached, but error occurred whilst creating sell order:', err);
        } else {
          console.log('Trigger reached and sell trade created:', data);
        }

        resolve();
      }
    );
  })
}

async function tradebuy(rate) {

  const btcBalance = await getBalance('BTC');
  const quantityToTrade = (btcBalance / rate) - 0.01;

  return new Promise(function(resolve) {
    bittrex.tradebuy({
        MarketName: 'BTC-LSK',
        OrderType: 'LIMIT',
        Quantity: quantityToTrade,
        Rate: rate,
        TimeInEffect: 'GOOD_TIL_CANCELLED',
        ConditionType: 'NONE',
        Target: 0
      }, function (data, err) {
        if (err) {
          console.log('Trigger reached, but error occured whilst buy creating order:', err);
        } else {
          console.log('Trigger reached and buy trade created:', data);
        }

        resolve();
      }
    );
  })
}


main();
setInterval(main, howOftenToCheckInMs);