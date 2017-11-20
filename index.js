var bittrex = require('node-bittrex-api');

var targetLskUsdPrice = process.env['TARGET_LSK_USD_PRICE'] || 11.46;
var quantityToSell = process.env['QUANTITY_TO_SELL'] || 48.27149519;

console.log('Target Price', process.env['TARGET_LSK_USD_PRICE']);
console.log('Quantity to sell', process.env['QUANTITY_TO_SELL']);
console.log('Key', process.env['API_KEY']);
console.log('Secret', process.env['API_SECRET']);

bittrex.options({
  'apikey': process.env['API_KEY'] || '',
  'apisecret': process.env['API_SECRET'] || ''
});

function sellIfTargetReached() {
  bittrex.getticker( { market : 'BTC-LSK' }, function(lskBtcData, err ) {

    if(lskBtcData) {
      var lskBtcPrice = lskBtcData.result.Last;

      bittrex.getticker({market: 'USDT-BTC'}, function (btcUsdData, err) {

        if(btcUsdData) {
          var btcUsdtPrice = btcUsdData.result.Last;

          lskUsdPrice = parseFloat(lskBtcPrice * btcUsdtPrice);

          console.log(new Date() + ': Current LSK price on Bittrex: ', lskUsdPrice);

          if (lskUsdPrice >= targetLskUsdPrice) {
            bittrex.tradesell({
                MarketName: 'BTC-LSK',
                OrderType: 'LIMIT',
                Quantity: quantityToSell,
                Rate: lskBtcPrice,
                TimeInEffect: 'GOOD_TIL_CANCELLED',
                ConditionType: 'NONE',
                Target: 0
              }, function (data, err) {

                if (err) {
                  console.log('Trigger reached, but error occured whilst creating order:', err);
                } else {
                  console.log('Trigger reached and trade created:', data);
                }

                console.log('Terminating program');
              }
            );

            process.exit();
          }
        }
      });
    }
  });
}

var howOftenToCheckInSecs = 60;
var howOftenToCheckInMs = howOftenToCheckInSecs * 1000;

sellIfTargetReached();
setInterval(sellIfTargetReached, howOftenToCheckInMs);