// init your app
var Fs = require('fire-fs');
var Path = require('fire-path');
var Ipc = require('ipc');
var Crypto = require('crypto');
var Getmac = require('getmac');

function _initFire () {
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

function _initLoginIpc () {
    Ipc.on('login:query-info', function ( reply ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        var lastLoginAccount = fireballProfile['last-login'];
        var rememberPasswd = fireballProfile['remember-passwd'];

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
                    });
                }
            });
        }
        else {
            reply({
                'account': lastLoginAccount,
                'remember-passwd': rememberPasswd,
                'password': '',
            });
        }
    });

    Ipc.on('login:save', function ( detail ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        if ( detail.account !== undefined ) {
            fireballProfile['last-login'] = detail.account;
        }
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
    });

    Ipc.on('login:succeed', function ( detail ) {
        var fireballProfile = Editor.loadProfile( 'fireball', 'global' );
        fireballProfile['last-login'] = detail.account;
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
    });
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
        _initLoginIpc();

        Fire.info('Welcome to Fireball! The next-gen html5 game engine.');

        // load ~/.fireball/fireball.json
        Editor.loadProfile( 'fireball', 'global', {
            'recently-opened': [],
            'last-login': '',
            'remember-passwd': true,
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
    }
};

