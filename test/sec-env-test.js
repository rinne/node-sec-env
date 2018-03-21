'use strict';

const env = require('../sec-env.js');

(env.moduleInitWait()
 .then(function() {
	 return env.keys();
 })
 .then(function(ret) {
	 var a = ret.map(function(k) { return env.getFull(k); });
	 return Promise.all(a);
 })
 .then(function(ret) {
	 process.exit(0);
 })
 .catch(function(e) {
	 console.log(e);
	 process.exit(1);
 }));
