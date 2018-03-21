'use strict';

var envMap = new Map();
var envProcessed = false;

var AWS, ssm;

function get(name) {
	return (getFull(name)
			.then(function(ret) {
				return ret.value;
			})
			.catch(function(e) {
				throw e;
			}));
}

function getFull(name) {
	return (moduleInitWait()
			.then(function() {
				if (typeof(name) !== 'string') {
					throw new Error('Environment variable name is not a string');
				}
			})
			.then(function() {
				var item = envMap.get(name);
				if (item === undefined) {
					throw new Error('Environment variable "' + name + '" is not set');
				}
				return item;
			})
			.catch(function(e) {
				throw e;
			}));
}

function keys() {
	return (moduleInitWait()
			.then(function() {
				return Array.from(envMap.keys());
			})
			.catch(function(e) {
				throw e;
			}));
}

function getSync(name) {
	var item = getFullSync(name);
	return item ? item.value : undefined;
}

function getFullSync(name) {
	if (! envProcessed) {
		throw new Error('Uninitialized sec-env subsystem');
	}
	var item = envMap.get(name);
	return (item === undefined) ? undefined : item;
}

function keysSync() {
	if (! envProcessed) {
		throw new Error('Uninitialized sec-env subsystem');
	}
	return Array.from(envMap.keys());
}

function initAwsSsm() {
	if (! ssm) {
		if (! AWS) {
			AWS = require('aws-sdk');
		}
		ssm = new AWS.SSM();
	}
	return true;
}

function getAwsSsmString(name, withDecryption) {
	return (Promise.resolve()
			.then(function() {
				return initAwsSsm();
			})
			.then(function() {
				return new Promise(function(resolve, reject) {
					ssm.getParameters({ Names: [ name ], WithDecryption: withDecryption ? true : false },
									  function(e, r) {
										  if (e) {
											  return reject(e);
										  }
										  if (! (r && (typeof(r) === 'object') && Array.isArray(r.Parameters))) {
											  return reject(new Error('Invalid return data from AWS SSM'));
										  }
										  if (! r.Parameters.some(function(p) {
											  if (p.Name === name) {
												  if (p.Type !== (withDecryption ? 'SecureString' : 'String')) {
													  reject(new Error('Bad type for parameter "' + name + '"'));
													  return true;
												  }
												  resolve(p.Value);
												  return true;
											  }
											  return false;
										  })) {
											  return reject(new Error('Unable to fetch parameter "' +
																	  name +
																	  '" from AWS SSM'));
										  }
									  });
				});
			})
			.catch(function(e) {
				throw e;
			}));
}

function processEnv(name, value) {
	var type;
	return (Promise.resolve()
			.then(function() {
				if (! (typeof(name) === 'string') && (typeof(value) === 'string')) {
					throw new Error('Invalid environment item');
				}
			})
			.then(function() {
				var m;
				if ((m = value.match(/^sec-env:([a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\((.*)\)$/))) {
					type = m[1];
					var data = m[2];
					return (Promise.resolve()
							.then(function() {
								switch (type) {
								case 'string':
									return data;
								case 'base64':
									return Buffer.from(data, 'base64');
								case 'base64-string':
									return Buffer.from(data, 'base64').toString('utf8');
								case 'aws-ssm-string':
									return getAwsSsmString(data, false);
								case 'aws-ssm-secure-string':
									return getAwsSsmString(data, true);
								case 'aws-ssm-base64':
									return (getAwsSsmString(data, false)
											.then(function(ret) {
												return Buffer.from(ret, 'base64');
											})
											.catch(function(e) {
												throw e;
											}));
								case 'aws-ssm-base64-string':
									return (getAwsSsmString(data, false)
											.then(function(ret) {
												return Buffer.from(ret, 'base64').toString('utf8');
											})
											.catch(function(e) {
												throw e;
											}));
								case 'aws-ssm-secure-base64':
									return (getAwsSsmSecureString(data, true)
											.then(function(ret) {
												return Buffer.from(ret, 'base64');
											})
											.catch(function(e) {
												throw e;
											}));
								case 'aws-ssm-secure-base64-string':
									return (getAwsSsmSecureString(data, true)
											.then(function(ret) {
												return Buffer.from(ret, 'base64').toString('utf8');
											})
											.catch(function(e) {
												throw e;
											}));
								default:
									throw new Error('Invalid sec-env type in environment');
								}
							})
							.then(function(ret) {
								value = ret;
								return { name: name, value: value, type: type };
							})
							.catch(function(e) {
								throw e;
							}));
				} else {
					type = 'plain';
					return { name: name, value: value, type: type };
				}
			})
			.then(function(ret) {
				envMap.set(name, ret);
				return (ret.type !== 'plain');
			})
			.catch(function(e) {
				throw e;
			}));
}

function moduleInitialize(moduleRegisterInitialization) {
	var p = (Promise.all(Object.keys(process.env).map(function(k) { return processEnv(k, process.env[k]); }))
			 .then(function(ret) {
				 envProcessed = true;
			 })
			 .catch(function(e) {
				 throw e;
			 }));
	moduleRegisterInitialization(p);
}

var moduleInitWait = ((require('module-async-init'))(moduleInitialize, false/*, true*/));

module.exports = {
	moduleInitWait: moduleInitWait,
	get: get,
	getFull: getFull,
	keys: keys,
	getSync: getSync,
	getFullSync: getFullSync,
	keysSync: keysSync
};
