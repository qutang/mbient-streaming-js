var devices = require('node-metawear');
var moment = require('moment');

var rate = parseFloat(process.argv[2]) || 50;
var range = parseFloat(process.argv[3]) || 2;

var WebSocket = require('ws');

var port1 = 8848;
var port2 = 8849;

const wss1 = new WebSocket.Server({ port: port1 });
const wss2 = new WebSocket.Server({ port: port2 })

var max_connections = 2;

wss1.on('connection', function (ws) {
    ws.on('message', function (message) {
        console.log('Received: ' + message);
    });
    console.log('connected to client');
    // ws.send('connected');
});

wss2.on('connection', function (ws) {
    ws.on('message', function (message) {
        console.log('Received: ' + message);
    });
    console.log('connected to client');
    // ws.send('connected');
});

var broadcast_sample = function (data_sample, index = 1) {
    var json = JSON.stringify(data_sample);
    // wss.clients is an array of all connected clients
    if (index == 1) {
        wss1.clients.forEach(function each(client) {
            client.send(json);
            // console.log('Sent: ' + json);
        });
    } else {
        wss2.clients.forEach(function each(client) {
            client.send(json);
            // console.log('Sent: ' + json);
        });
    }
}

var connect_device = function (device, index) {

    console.log('discovered device ', device.address);
    device.on('disconnect', function () {
        console.log('we got disconnected! :( ');
    });

    device.connectAndSetup(function (error) {
        if (index == 1) {
            var port = port1
        } else {
            var port = port2
        }
        console.log(device.address + ' is connected! at ws://localhost:' + port);
        console.log('Start accelerometer with ' + rate + 'hz ang +-' + range + 'g');

        var last_ts = 0;
        var sample_counts = 0;
        var accelerometer = new device.Accelerometer(device);
        var logger = new device.Log(device);

        accelerometer.setOutputDataRate(rate);
        accelerometer.setAxisSamplingRange(range);
        logger.startLogging(false);

        accelerometer.setConfig();
        accelerometer.enableNotifications();
        accelerometer.enableAxisSampling();
        accelerometer.start();

        accelerometer.onChange(function (data) {
            var current_ts = moment();
            var current_ts_str = current_ts.format('YYYY-MM-DD HH:mm:ss.SSS');
            var current_ts_ms = current_ts.valueOf() / 1000.0;
            var data_sample = {
                'ID': device.id,
                'HEADER_TIME_STAMP': current_ts_ms,
                'X': data.x,
                'Y': data.y,
                'Z': data.z
            }
            sample_counts++;
            if (current_ts.valueOf() - last_ts > 1000) {
                last_ts = current_ts.valueOf();
                console.log(device.id + ', sampling rate: ' + sample_counts + ' Hz');
                sample_counts = 0;
            }
            broadcast_sample(data_sample, index);
        });
    });
}

function wait(ms) {
    var start = new Date().getTime();
    var end = start;
    while (end < start + ms) {
        end = new Date().getTime();
    }
}

var broadcast_mbient_data = function () {
    var max_connections = 2;
    var onDiscover = function (discovered) {
        if (discovered._peripheral.advertisement.localName === 'MetaWear') {
            connect_device(discovered, index = max_connections);
            max_connections -= 1;
            wait(2000);
            if (max_connections == 0) {
                devices.stopDiscoverAll(onDiscover);
                console.log('stopped scanning')
            }
        }
    }
    devices.discoverAll(onDiscover);
};

broadcast_mbient_data();
console.log('waiting for connection...');
