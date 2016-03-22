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

function connect (callback) {
	ipc.config.id = Math.random().toPrecision(6).toString();
	ipc.connectTo(serverId, callback);
	ipc.of.socket.on("error", function (msg) {
		if (connected) return;
		require('desk-base');
	});

	ipc.of.socket.on("connect", function (msg) {
		ipc.of[serverId].on('action finished',
			function(res){
				callbacks[res.handle](res.err, res);
				delete callbacks[res.handle];
			}
		);
	});
};

exports.Actions = {
	execute : function (action, callback) {
		if (!connected) {
			connect(function () {
				connected = true;
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

