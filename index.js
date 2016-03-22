var	fs           = require('fs'),
	ipc          = require('node-ipc'),
	libpath      = require('path'),
	os           = require('os');

// base directory where all data files are (data, cache, actions, ..)
var rootDir = libpath.join(os.homedir(), 'desk') + '/';

ipc.config.socketRoot = rootDir;
ipc.config.silent = true;

exports = module.exports = {};

var serverId = 'socket';
var connected;
var callbacks = {};

var connectionCallbacks = [];
var includedFiles = [];

function connect (callback) {
	if (!ipc.of.socket) {
		ipc.config.id = Math.random().toPrecision(6).toString();
		ipc.connectTo(serverId);
		ipc.of.socket.on("error", function (msg) {
			if (connected) return;
			var desk = require('desk-base');
			includedFiles.forEach(function (file) {
				desk.includeFile(file, 1);
			});
		});

		ipc.of.socket.on("connect", function (msg) {
			connected = true;
			ipc.of[serverId].on('action finished',
				function(res){
					callbacks[res.handle](res.err, res);
					delete callbacks[res.handle];
				}
			);
			connectionCallbacks.forEach(cb => cb());
			connectionCallbacks.length = 0;
		});
	}
	connectionCallbacks.push(callback);
}

exports.includeFile = function (file) {
	includedFiles.push(file);
}

exports.Actions = {
	execute : function (action, callback) {
		if (!connected) {
			connect(function () {
				exports.Actions.execute(action, callback);
			});
			return;
		}
		var handle = Math.random();
		action.handle = handle;

		callbacks[handle] = callback;
		ipc.of[serverId].emit('execute', action);
	}
};

exports.FileSystem = {
	readFile : function (file, opts, cb , context) {
		if (typeof opts === 'function') {
			context = cb;
			cb = opts;
			opts = {};
		}
		fs.readFile(libpath.join(rootDir, file), opts, cb.bind(context));
	}
};

exports.disconnect = function () {
	ipc.disconnect(serverId);
};

