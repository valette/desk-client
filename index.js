const crypto  = require( 'crypto' ),
      fs      = require('fs'),
      ipc     = require('node-ipc'),
      libpath = require('path'),
      os      = require('os'),
      util    = require('util');

// base directory where all data files are (data, cache, actions, ..)
var rootDir = libpath.join(os.homedir(), 'desk') + '/';

class CustomError extends Error {

	constructor( error ) {

		super( error.message );
		Object.defineProperty(this, "name", {
			value: 'RemoteError'
		});
		const obj = Object.assign( {}, error );
		delete obj.message;
		Object.assign( this, obj );
	}
}

util.inherits( CustomError, Error );

ipc.config.socketRoot = rootDir;
ipc.config.silent = true;

exports = module.exports = {};

var serverId = 'socket';
var connected;
var callbacks = {};

var connectionCallbacks = [];
var includes = [];

function connect (callback) {
	if (!ipc.of.socket) {
		ipc.config.id = Math.random().toPrecision(6).toString();
		ipc.connectTo(serverId);
		ipc.of.socket.on("error", function (msg) {
			if (connected) return;
			var desk = require('desk-base');
			includes.forEach(function (file) {
				desk.include(file, 1);
			});
		});

		ipc.of.socket.on("connect", function (msg) {
			connected = true;
			ipc.of[serverId].on('action finished',
				function( res ) {
					const cb = callbacks[res.handle];
					delete callbacks[res.handle];
					if ( res.error ) return cb( new CustomError( res.error ) );
					cb( null, res );
				}
			);
			connectionCallbacks.forEach(cb => cb());
			connectionCallbacks.length = 0;
		});
	}
	connectionCallbacks.push(callback);
}

exports.include = function (file) {
	includes.push(file);
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

exports.Actions.executeAsync = util.promisify( exports.Actions.execute );

exports.FileSystem = {
	readFile : function (file, opts, cb , context) {
		if (typeof opts === 'function') {
			context = cb;
			cb = opts;
			opts = {};
		}
		fs.readFile( fullPath( file ), opts, cb.bind(context));
	},

	writeCachedFileAsync : async function ( name, content, cacheRoot ) {

		cacheRoot = cacheRoot || "cache";
		const shasum = crypto.createHash( 'sha1' );
		shasum.update( content );
		const hash = shasum.digest( 'hex' );
		const dir = fullPath( cacheRoot + "/" + hash[0] + "/" + hash[1] + "/" + hash );
		const file = dir + "/" + name;

		if ( fs.existsSync( file ) ) {

			if ( content === ( '' + fs.readFileSync( file ) ) ) {

				return file;

			}

		}

		await exports.Actions.executeAsync ( { action : "write_string",
			file_name : name, data : content, outputDirectory : dir } )
		return file;

	}

};

function fullPath ( ...dirs ) {

	const dir = libpath.join( ...dirs );
	return dir.startsWith( '/' ) ? dir : libpath.join( rootDir, dir );

}
exports.FileSystem.readFileAsync = util.promisify( exports.FileSystem.readFile );

exports.disconnect = function () {
	ipc.disconnect(serverId);
};

