var devices = require('node-metawear');
var moment = require('moment');

var rate  = parseFloat(process.argv[2]) || 50;
var range = parseFloat(process.argv[3]) || 2;

var WebSocket = require('ws');

var port = 8848;

const wss = new WebSocket.Server({ port: port });

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
      console.log('Received: ' + message);
    });
    console.log('connected to client');
    // ws.send('connected');
});

var broadcast_mbient_data = function(){
    var broadcast = function(data_sample) {
        var json = JSON.stringify(data_sample);
        // wss.clients is an array of all connected clients
        wss.clients.forEach(function each(client) {
            client.send(json);
            // console.log('Sent: ' + json);
        });
    }

    var last_ts = 0;
    var sample_counts = 0;

    console.log('start detecting devices...');
    devices.discover(function(device) {
        console.log('discovered device ', device.address);
    
        device.on('disconnect', function() {
            console.log('we got disconnected! :( ');
        });
    
        device.connectAndSetup(function(error) {
            console.log('were connected!');
            console.log('metawear websocket server at ws://localhost:' + port);
            console.log('Start accelerometer with ' + rate + 'hz ang +-' + range + 'g');
    
            var accelerometer = new device.Accelerometer(device);
            var logger        = new device.Log(device);
    
            accelerometer.setOutputDataRate(rate);
            accelerometer.setAxisSamplingRange(range);
            logger.startLogging(false);
    
            accelerometer.setConfig();
            accelerometer.enableNotifications();
            accelerometer.enableAxisSampling();
            accelerometer.start();
    
            accelerometer.onChange(function(data) {
                var current_ts = moment();
                var current_ts_str = current_ts.format('YYYY-MM-DD HH:mm:ss.SSS');
                var current_ts_ms = current_ts.valueOf() / 1000.0;
                var data_sample = {
                    'HEADER_TIME_STAMP': current_ts_ms,
                    'X': data.x,
                    'Y': data.y,
                    'Z': data.z
                }
                sample_counts++;
                if(current_ts.valueOf() - last_ts > 1000){
                    last_ts = current_ts.valueOf();
                    console.log('sampling rate: ' + sample_counts + ' Hz');
                    sample_counts = 0;
                }
                broadcast(data_sample);
            });
        });
    });
};

broadcast_mbient_data();
console.log('waiting for connection...');
