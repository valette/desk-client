#!/usr/bin/env node

'use strict';

var	desk = require(__dirname + '/../index.js');

desk.Actions.execute({action : "sleep", time_in_seconds : 2},
	function (err, res) {
		console.log("err : ");
		console.log(err);
		console.log("res : ");
		console.log(res);
		process.exit(0);
	}
);
