In a Nutshell
=============

This is a unified system to access process environment. This is most
useful in serverless applications (e.g. AWS Lambda) in which some
configuration information is passed to the system via environments.

Environments can be either literal strings (= traditional
environments) or pointers to either plaintext or encrypted AWS SSM
strings. Changing an environment value from the plaintext one to the
protected one can be done by only changing the value of the
environment variable. No changes to the code is needed.


Example
=======

Environment is typically accessed asynchronously, because fetching and
decrypting values stored to SSM can't be fetched
synchronously. However after the initialization has been completed,
lookups complete immediately.

```
const env = require('sec-env');

function xxx() {
    var home, shell, something;
    return (Promise.resolve()
            .then(function() {
                return Promise.all([ env.get('HOME'), env.get('SHELL'), env.get('SOMETHING') ]);
            })
            .then(function(ret) {
                home = ret[0];
                shell = ret[1];
                something = ret[2];
                console.log('got environments home:' , home, 'shell:', shell, 'something:', something);
            })
            .catch(function(e) {
                console.log(e.message);
                process.exit(1);
            }));
}

xxx();
```

Testing from command line:

```
$ node async-test.js
Environment variable "SOMETHING" is not set
$ SOMETHING=foobar node async-test.js
got environments home: /home/tri shell: /bin/bash something: foobar
```

Alternatively, values can be accessed using synchronous API, but in
order to do that, the asynchronous module initialization must complete
first.

```
const env = require('./node-sec-env/sec-env.js');

function xxx() {
        var home, shell, something;
        return (env.moduleInitWait()
                        .then(function(ret) {
                                home = env.getSync('HOME');
                                shell = env.getSync('SHELL');
                                something =  env.getSync('SOMETHING');
                                console.log('got environments home:' , home, 'shell:', shell, 'something:', something);
                        })
                        .catch(function(e) {
                                console.log(e.message);
                                process.exit(1);
                        }));
}

xxx();
```

Testing from command line:

```
$ node sync-test.js
got environments home: /home/tri shell: /bin/bash something: undefined
$ SOMETHING=foobar node sync-test.js
got environments home: /home/tri shell: /bin/bash something: foobar
$ SOMETHING='sec-env:string(barbar)' node sync-test.js
got environments home: /home/tri shell: /bin/bash something: barbar
$ SOMETHING='sec-env:base64-string(a3Vra3V1)' node sync-test.js
got environments home: /home/tri shell: /bin/bash something: kukkuu
$ SOMETHING='sec-env:base64(a3Vra3V1)' node sync-test.js
got environments home: /home/tri shell: /bin/bash something: <Buffer 6b 75 6b 6b 75 75>
```

The main difference being that the individual values doesn't have to
be evaluated over promise steps and the undefined environment value
doesn't throw error but instead returns undefined.

Reference
=========

env.moduleInitWait()
--------------------

Returns a promise that resolves once the env module is initialized and
synchronous interfaces can be used. Using any synchronous interface
before initializations are complete causes an error to be
thrown. There is no need to call and wait this, if only asynchronous
interfaces are used, since they individually wait the initialization
to complete, before executing.

env.get(name)
-------------

Fetch the value of a variable asynchronously. Returns a promise
resolving to the value. Promise rejects, if the name does not exist.

env.getFull(name)
-----------------

Fetch the value object containing name, value ane type of the
variable. Returns a promise resolving to the object. Promise rejects,
if the name does not exist.

env.keys()
----------

Fetch the list of available variable keys as an array. Returns a
promise resolving to array of strings.

env.getSync(name)
-----------------

Get a value of the variable synchronously. Throws an error, if the
sec-env module has not been initialized. This interface can be used
safely only after the code one way or another has waited
env.moduleInitWait() to resolve.

env.getFullSync(name)
---------------------

Get a value object (see env.getFull() for details) of the variable
synchronously. Throws an error, if the sec-env module has not been
initialized. This interface can be used safely only after the code one
way or another has waited env.moduleInitWait() to resolve.

env.keysSync()
--------------

Fetch the list of available variable keys as an array
synchronously. Throws an error, if the sec-env module has not been
initialized. This interface can be used safely only after the code one
way or another has waited env.moduleInitWait() to resolve.

env.isSet(name)
---------------

Return a promise resolving to true or false depending on whether the
variable name is defined or not. This is an asynchronous interface and
is safe to call even when the module initialization still in progress.


Value Formats
=============

Values are encoded to the process environment as follows:

sec-env:type(value)

All environment values that do not match to the format above, are used
as literals. This means that such variables are not processed at all,
but can still be accessed via env.get() and other methods.

Types
-----

### string
A value is a non-processed string. For eaxmple setting variable x to
sec-env:type(foobar) causes env.getSync('x') to return string foobar.

### base64
A value is a base64 encoded data.  The encoding is automatically
removed and the data is returned as Buffer.

### base64-string
A value is a base64 encoded data.  The encoding is automatically
removed and the data is returned as string.

### aws-ssm-string and aws-ssm-secure-string

A value is a name of a variable stored in AWS SSM. In case of a secure
string, it is automatically decrypted. A variable that has been stored
as a secure (i.e. encrypted) string to SSM can be used only as a
secure string. Data is returned as a string.

For example
sec-env:aws-ssm-secure-string(/my/service/development/env/zap) causes
the value to be fetched from AWS SSM
path /my/service/development/env/zap and automatically
decrypted using the AWS KMS key that was used in encrypting
the value and returned as a string.

### aws-ssm-base64 and aws-ssm-secure-base64

A value is a name of a variable stored in AWS SSM. In case of a secure
string, it is automatically decrypted. A variable that has been stored
as a secure (i.e. encrypted) string to SSM can be used only as a
secure string. Data is automatically base64 decoded and returned as
a Buffer.

### aws-ssm-base64-string and aws-ssm-secure-base64-string

A value is a name of a variable stored in AWS SSM. In case of a secure
string, it is automatically decrypted. A variable that has been stored
as a secure (i.e. encrypted) string to SSM can be used only as a
secure string. Data is automatically base64 decoded and returned as
a string.


Author
======

Timo J. Rinne <tri@iki.fi>


License
=======

MIT License
