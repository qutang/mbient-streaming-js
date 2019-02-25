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
        this._battery_level = undefined;
        this._last_reconnect_ts = [];
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
            this._last_reconnect_ts.push(0);
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
        var current_ts;
        accelerometer.setOutputDataRate(this._sr);
        accelerometer.setAxisSamplingRange(this._grange);
        logger.startLogging(false);
        accelerometer.setConfig();
        accelerometer.enableNotifications();
        accelerometer.enableAxisSampling();
        accelerometer.onChange(function (data) {
            if (typeof current_ts === "undefined") {
                current_ts = moment();
            } else {
                current_ts = current_ts.add(1.0 / this._sr, 's');
            }
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
        var engine = this;
        console.log('discovered device: ', device.address);
        device.on('disconnect', function () {
            console.log(device.address + ' got disconnected! :( ');
            var ts = moment().valueOf();
            // if more than 5 seconds since last reconnection
            if (ts - engine._last_reconnect_ts[device_index] <= 5000) {
                console.log('wait 5 seconds to reconnect...');
                utils.wait(5000);
            }
            console.log('try to reconnect...');
            engine._last_reconnect_ts[device_index] = ts;
            engine._connectAndSetupDevice(device, device_index);
        });
        this._connectAndSetupDevice(device, device_index);
    }
    _connectAndSetupDevice(device, device_index) {
        device.connectAndSetup(function (error) {
            console.log(device.address + ' is connected! at ws://localhost:' + this._ports[device_index]);
            console.log('Start accelerometer with ' + this._sr + 'hz ang +-' + this._grange + 'g');
            device.readBatteryLevel(function (error, batteryLevel) {
                console.log(device.address + " battery:", batteryLevel);
            });
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