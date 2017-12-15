const bittrex = require('node-bittrex-api');

const targetLskUsdtPrice = process.env['TARGET_LSK_USDT_PRICE'];
const quantityToSell = process.env['QUANTITY_TO_SELL'];
const howOftenToCheckInSecs = 10;
const howOftenToCheckInMs = howOftenToCheckInSecs * 1000;

console.log('Target Price', targetLskUsdtPrice);
console.log('Quantity to sell', quantityToSell);
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

  if (lskUsdtPrice >= targetLskUsdtPrice) {
    console.log("Triggered sell. Attempting...");

    await tradesell(lskBtcPrice);

    console.log('Terminating program');

    process.exit();
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

async function tradesell(rate) {

  return new Promise(function(resolve) {
    bittrex.tradesell({
        MarketName: 'BTC-LSK',
        OrderType: 'LIMIT',
        Quantity: quantityToSell,
        Rate: rate,
        TimeInEffect: 'GOOD_TIL_CANCELLED',
        ConditionType: 'NONE',
        Target: 0
      }, function (data, err) {

        if (err) {
          console.log('Trigger reached, but error occured whilst creating order:', err);
        } else {
          console.log('Trigger reached and trade created:', data);
        }

        resolve();
      }
    );
  })
}


main();
setInterval(main, howOftenToCheckInMs);