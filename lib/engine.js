var _ = require('underscore');
var WebSocket = require('ws');
var utils = require('./utils.js');
var devices = require('node-metawear');
var moment = require('moment');

class Engine {
    constructor(sr, grange, max_conns, init_port) {
        this._sr = sr;
        this._grange = grange;
        this._max_conns = max_conns;
        this._init_port = init_port;
        this._DEVICE_NAME = 'MetaWear';
        this._devices = [];
        this._accelerometers = [];
        this._init();
    }
    _init() {
        var init_port = this._init_port;
        this._ports = _.map(_.range(this._max_conns), function (x) { return x + init_port; });
        this._sockets = this._ports.map(function (p) {
            var socket = new WebSocket.Server({ port: p });
            socket.on('connection', function (ws) {
                ws.on('message', function (message) {
                    console.log('Received: ' + message);
                });
                console.log('connected to client');
            });
            return socket;
        });
    }
    _onDiscover(device) {
        if (device._peripheral.advertisement.localName === this._DEVICE_NAME) {
            this._devices.push(device);
            var device_index = this._devices.length - 1;
            this._connectDevice(device, device_index = device_index);
            utils.wait(2000);
            if (this._devices.length == this._max_conns) {
                devices.stopDiscoverAll(this._onDiscover.bind(this));
                console.log('Reached max connections, stopped scanning');
            }
        }
    }

    _initAccelerometer(device, device_index) {
        var last_ts = 0;
        var sample_counts = 0;
        var accelerometer = new device.Accelerometer(device);
        var logger = new device.Log(device);
        accelerometer.setOutputDataRate(this._sr);
        accelerometer.setAxisSamplingRange(this._grange);
        logger.startLogging(false);
        accelerometer.setConfig();
        accelerometer.enableNotifications();
        accelerometer.enableAxisSampling();
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
            };
            sample_counts++;
            if (current_ts.valueOf() - last_ts > 1000) {
                last_ts = current_ts.valueOf();
                console.log(device.id + ', sampling rate: ' + sample_counts + ' Hz');
                sample_counts = 0;
            }
            this._broadcastData(data_sample, device_index);
        }.bind(this));
        this._accelerometers.push(accelerometer);
    }
    _startAccelerometer(device_index) {
        this._accelerometers[device_index].start();
    }
    _broadcastData(data_sample, device_index) {
        var json = JSON.stringify(data_sample);
        // wss.clients is an array of all connected clients
        this._sockets[device_index].clients.forEach(function each(client) {
            client.send(json);
        });
    }
    _connectDevice(device, device_index) {
        console.log('discovered device: ', device.address);
        device.on('disconnect', function () {
            console.log('we got disconnected! :( ');
        });
        device.connectAndSetup(function (error) {
            console.log(device.address + ' is connected! at ws://localhost:' + this._ports[device_index]);
            console.log('Start accelerometer with ' + this._sr + 'hz ang +-' + this._grange + 'g');
            this._initAccelerometer(device, device_index);
            this._startAccelerometer(device_index);
        }.bind(this));
    }
    start() {
        console.log('Start device engine...');
        console.log('Start scanning devices...');
        console.log('Configurations: %d Hz, %d g, %d connections, %d intial port', this._sr, this._grange, this._max_conns, this._init_port);

        devices.discoverAll(this._onDiscover.bind(this));
    }
}

module.exports = Engine;