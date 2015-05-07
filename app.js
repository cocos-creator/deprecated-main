// init your app
var Fs = require('fire-fs');
var Path = require('fire-path');
var Ipc = require('ipc');
var Crypto = require('crypto');
var Getmac = require('getmac');

function _initFire () {
    global.Fire = {};

    // load and mixin Fire module
    Fire = require('./src/core/core');
    // Fire.JS.mixin( Fire, require('./src/engine/engine.editor-core'));
    Fire.JS.mixin( Fire, require('./src/editor-share/editor-share'));
    Fire.JS.mixin( Fire, {
        log: Editor.log,
        success: Editor.success,
        failed: Editor.failed,
        info: Editor.info,
        warn: Editor.warn,
        error: Editor.error,
        fatal: Editor.fatal,
    });

    // mixin Fire.Editor to Editor
    Fire.JS.mixin( Editor,  Fire.Editor);
}

function _verifyEmail (value) {
    var reg = /^\w+((-\w+)|(\.\w+))*\@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/;
    return reg.test(value);
}

var _projectPath = null;
var _requireLogin = false;

// exports
module.exports = {

    initCommander: function ( commander ) {
        commander
            .usage('[options] <project-path>')
            .option('--test-login', 'Test login module in dev mode.')
            ;
    },

    init: function ( options ) {
        Editor.log( 'Initializing fire' );
        _initFire();

        Fire.info('Welcome to Fireball! The next-gen html5 game engine.');

        // load ~/.fireball/fireball.json
        Editor.loadProfile( 'fireball', 'global', {
            'recently-opened': [],
            'last-login': '',
            'remember-passwd': true,
            'login-type': 'account',
        });

        if ( options.args.length > 0 ) {
            _projectPath = options.args[0];
        }

        _requireLogin = !Editor.isDev || options.testLogin;
    },

    run: function () {
        // require login in release environment
        if ( _requireLogin ) {
            var Login = require( Editor.url('editor-core://login') );
            Login.open(this.enter);
        }
        else {
            this.enter();
        }
    },

    enter: function () {
        if ( _projectPath ) {
            var Fireball = require( Editor.url('editor-core://fireball') );
            Fireball.open({
                path: _projectPath,
            });
        }
        else {
            var Dashboard = require( Editor.url('editor-core://dashboard') );
            Dashboard.open();
        }
    },

    load: function () {
    },

    unload: function () {
    },

    'login:query-info': function ( reply ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        var lastLoginAccount = fireballProfile['last-login'];
        var rememberPasswd = fireballProfile['remember-passwd'];
        var loginType = fireballProfile['login-type'];
        // get password
        if ( rememberPasswd ) {
            Getmac.getMac( function ( err, macAddress) {
                if ( err ) {
                    reply({
                        'account': lastLoginAccount,
                        'remember-passwd': rememberPasswd,
                        'password': '',
                    });
                    return;
                }

                var infoFile = Path.join(Editor.dataPath,'.info');
                if ( Fs.existsSync(infoFile) ) {
                    var info = JSON.parse(Fs.readFileSync(infoFile));
                    var crypted = info[lastLoginAccount];
                    var passwd = '';
                    if ( crypted ) {
                        var decipher = Crypto.createDecipher('aes-256-cbc', macAddress);
                        decipher.update( crypted, 'hex', 'utf8' );
                        passwd = decipher.final('utf8');
                    }

                    reply({
                        'account': lastLoginAccount,
                        'remember-passwd': rememberPasswd,
                        'password': passwd,
                        'login-type': loginType,
                    });
                }
            });
        }
        else {
            reply({
                'account': lastLoginAccount,
                'remember-passwd': rememberPasswd,
                'password': '',
                'login-type': loginType,
            });
        }
    },

    'login:save': function ( detail ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        if ( detail.account !== undefined ) {
            fireballProfile['last-login'] = detail.account;
        }
        fireballProfile['login-type'] = detail['login-type'];
        if ( detail['remember-passwd'] !== undefined ) {
            fireballProfile['remember-passwd'] = detail['remember-passwd'];

            // remove passwd if remember is false
            if ( detail['remember-passwd'] === false ) {
                var infoFile = Path.join(Editor.dataPath,'.info');
                if ( Fs.existsSync(infoFile) ) {
                    var info = JSON.parse(Fs.readFileSync(infoFile));
                    if ( info[detail.account] ) {
                        delete info[detail.account];
                    }
                    Fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
                }
            }
        }
        fireballProfile.save();
    },

    'login:succeed': function ( detail ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        fireballProfile['last-login'] = detail.account;
        fireballProfile['login-type'] = detail['login-type'];
        fireballProfile['remember-passwd'] = detail['remember-passwd'];
        fireballProfile.save();

        if ( detail['remember-passwd'] ) {
            Getmac.getMac( function ( err, macAddress) {
                if ( err ) {
                    Editor.error( 'Failed to remember your passwd.');
                    return;
                }

                var chipher = Crypto.createCipher('aes-256-cbc', macAddress);
                chipher.update(detail.password,'utf8','hex');
                var crypted = chipher.final('hex');

                var infoFile = Path.join(Editor.dataPath,'.info');
                var info = {};

                if ( Fs.existsSync(infoFile) ) {
                    info = JSON.parse(Fs.readFileSync(infoFile));
                }
                info[detail.account] = crypted;
                Fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
            });
        }

        Editor.sendToWindows('popup:login');
    },

    'editor:login': function ( reply, account, password ) {
        var isEmail = _verifyEmail(account);

        var formData = {
            username: isEmail ? '' : account,
            email: isEmail ? account : '',
            password: password,
        };

        var options = {
            url: 'https://accounts.fireball-x.com/login',
            form: formData,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
            }
        };

        Request.post( options, function ( err, httpResponse, body ) {
            if ( err ) {
                reply( err.message );
                return;
            }

            if ( httpResponse.statusCode !== 200 ) {
                reply( JSON.parse(body).error.message );
                return;
            }

            var token = JSON.parse(body).id;
            var userId = JSON.parse(body).userId;
            var opt = {
                url: 'https://accounts.fireball-x.com/api/users/' + userId + '?access_token=' + token,
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json'
                }
            };
            Request.get(opt, function (err, res, body) {
                if ( err ) {
                    reply( err.message );
                    return;
                }

                if ( res.statusCode !== 200 ) {
                    reply( JSON.parse(body).error.message );
                    return;
                }

                var userInfo = JSON.parse(body);
                Editor.token = token;
                Editor.userInfo = userInfo;

                Editor.sendToWindows('editor:user-info-changed', {
                    'token': token,
                    'user-info': userInfo,
                });

                reply( null, {
                    'token': token,
                    'user-info': userInfo,
                });
            });
        });
    },

    'editor:token-login': function (reply,token, userId) {
        var opt = {
            url: 'https://accounts.fireball-x.com/api/users/' + userId + '?access_token=' + token,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        };
        Request.get(opt, function (err, res, body) {
            if ( err ) {
                reply(err);
                return;
            }

            if ( res.statusCode !== 200 ) {
                reply( JSON.parse(body).error.message );
                return;
            }

            var userInfo = JSON.parse(body);
            Editor.userInfo = userInfo;
            Editor.token = token;

            Editor.sendToWindows('editor:user-info-changed', {
                'token': Editor.token,
                'user-info': userInfo,
            });

            reply(userInfo);
        });
    },

    'editor:logout': function ( reply ) {
        var opt = {
            url: 'https://accounts.fireball-x.com//logout?access_token=' + Editor.token,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json'
            }
        };
        Editor.token = null;
        Editor.userInfo = null;

        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        var account = fireballProfile['last-login'];
        fireballProfile['last-login'] = '';
        fireballProfile['login-type'] = 'account';

        // remove passwd if remember is false
        var infoFile = Path.join(Editor.dataPath,'.info');
        if ( Fs.existsSync(infoFile) ) {
            var info = JSON.parse(Fs.readFileSync(infoFile));
            if ( info[account] ) {
                delete info[account];
            }
            Fs.writeFileSync(infoFile, JSON.stringify(info, null, 2));
        }
        fireballProfile.save();


        Request.post(opt,function (err, httpResponse, body) {
            if (err || httpResponse.statusCode !== 200) {
                return;
            }

            Editor.sendToWindows('editor:user-info-changed', {
                'token': null,
                'user-info': null,
            });
        });
        reply("log out");
    },
};
