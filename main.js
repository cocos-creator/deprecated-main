global.shellStartTime = Date.now();

// load modules
var App = require('app');
var Path = require('fire-path');
var Fs = require('fire-fs');
var Url = require('fire-url');
var Nomnom = require('nomnom');
var Chalk = require('chalk');
var Winston = require('winston');

// set global values
global.FIRE_VER = "0.2.0";
global.FIRE_PATH = __dirname;
// DISABLE: global.FIRE_DATA_PATH = App.getPath('userData');
global.FIRE_DATA_PATH = Path.join( App.getPath('home'), '.fireball' );
global.FIRE_PROJECT_PATH = "";  // will be init in Fireball.open
global.Fire = {};

// this will prevent default atom-shell uncaughtException
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', function(error) {
    if ( Fire.sendToWindows )
        Fire.sendToWindows('console:error', error.stack || error);
    Winston.uncaught( error.stack || error );
});

// initialize ~/.fireball
if ( !Fs.existsSync(global.FIRE_DATA_PATH) ) {
    Fs.makeTreeSync(global.FIRE_DATA_PATH);
}

// initialize ~/.fireball/settings/
var settingsPath = Path.join(global.FIRE_DATA_PATH, 'settings');
if ( !Fs.existsSync(settingsPath) ) {
    Fs.mkdirSync(settingsPath);
}

// initialize logs/

// get log path
var _logpath = '';
if ( process.platform === 'darwin' ) {
    _logpath = Path.join(App.getPath('home'), 'Library/Logs/Fireball' );
}
else {
    _logpath = App.getPath('appData');
}

if ( !Fs.existsSync(_logpath) ) {
    Fs.makeTreeSync(_logpath);
}

var _logfile = Path.join(_logpath, 'fireball.log');
if ( Fs.existsSync(_logfile) ) {
    Fs.unlinkSync(_logfile);
}

var winstonLevels = {
    normal   : 0,
    success  : 1,
    failed   : 2,
    info     : 3,
    warn     : 4,
    error    : 5,
    fatal    : 6,
    uncaught : 7,
};
Winston.setLevels(winstonLevels);

Winston.remove(Winston.transports.Console);
Winston.add(Winston.transports.File, {
    level: 'normal',
    filename: _logfile,
    json: false,
});

var chalk_id = Chalk.bgBlue;
var chalk_success = Chalk.green;
var chalk_warn = Chalk.yellow;
var chalk_error = Chalk.red;
var chalk_info = Chalk.cyan;

var levelToFormat = {
    normal: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + text;
    },

    success: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_success(text);
    },

    failed: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_error(text);
    },

    info: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_info(text);
    },

    warn: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_warn.inverse.bold('Warning:') + ' ' + chalk_warn(text);
    },

    error: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_error.inverse.bold('Error:') + ' ' + chalk_error(text);
    },

    fatal: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_error.inverse.bold('Fatal Error:') + ' ' + chalk_error(text);
    },

    uncaught: function ( text ) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        return pid + chalk_error.inverse.bold('Uncaught Exception:') + ' ' + chalk_error(text);
    },
};

Winston.add( Winston.transports.Console, {
    level: 'normal',
    formatter: function (options) {
        var pid = chalk_id("[" + process.pid + "]") + " ";
        var text = "";
        if ( options.message !== undefined ) {
            text += options.message;
        }
        if ( options.meta && Object.keys(options.meta).length ) {
            text += " " + JSON.stringify(options.meta);
        }

        // output log by different level
        var formatter = levelToFormat[options.level];
        if ( formatter ) {
            return formatter(text);
        }

        return text;
    }
});

//
function parseArgv( argv ) {
    Nomnom
    .script("fire")
    .option('project', { position: 0, help: "The fireball project file." })
    .option('version', { abbr: 'v', flag: true, help: 'Print the version.',
            callback: function () { return FIRE_VER; } })
    .option('help', { abbr: 'h', flag: true, help: 'Print this usage message.' })
    .option('dev', { abbr: 'd', flag: true, help: 'Run in development mode.' })
    .option('showDevtools', { abbr: 'D', full: 'show-devtools', flag: true, help: 'Open devtools automatically when main window loaded.' })
    .option('debug', { full: 'debug', flag: true, help: 'Open in browser context debug mode.' })
    .option('debugBreak', { full: 'debug-brk', flag: true, help: 'Open in browser context debug mode, and break at first.' })
    .option('disableDirectWrite', { full: 'disable-direct-write', flag: true, help: 'Disables the DirectWrite font rendering system on windows.' })
    ;

    var opts = Nomnom.parse(argv);

    if ( opts.dev ) {
        if ( opts._.length < 2 ) {
            opts.project = null;
        }
        else {
            opts.project = opts._[opts._.length-1];
        }

        // DEBUG? I think debug could redirect the data-path
        // global.FIRE_DATA_PATH = __dirname;
    }

    return opts;
}

function _fireurl ( url ) {
    var data = Url.parse(url);
    var relativePath = '';

    switch ( data.protocol ) {
        case 'fire:':
            relativePath = url.substr(7);
            return Path.join( FIRE_PATH, relativePath );

        case 'editor-core:':
            relativePath = url.substr(14);
            return Path.join( FIRE_PATH, 'src/editor-core/', relativePath );

        case 'assets:':
            return Fire.AssetDB.fspath(url);

        default:
            return url;
    }
}


var _profiles = {};

function _getProfilePath ( name, type ) {
    if ( type === 'global' ) {
        return Path.join( FIRE_DATA_PATH, 'settings', name + '.json' );
    }
    else if ( type === 'project' ) {
        return Path.join( FIRE_PROJECT_PATH, 'settings', name + '.json' );
    }
    else if ( type === 'local' ) {
        return Path.join( FIRE_PROJECT_PATH, 'local', name + '.json' );
    }

    return '';
}

// type: global, local, project
function _saveProfile ( name, type, obj ) {
    var path = _getProfilePath( name, type );
    var json = JSON.stringify(obj, null, 2);
    Fs.writeFileSync(path, json, 'utf8');
}

// type: global, local, project
function _loadProfile ( name, type, defaultProfile ) {
    var id = name + '@' + type;
    var profile = _profiles[id];
    if ( profile ) {
        return profile;
    }

    var profileProto = {
        save: function () {
            _saveProfile( name, type, this );
        },
        clear: function () {
            for ( var p in this ) {
                if ( p !== 'save' && p !== 'clear' ) {
                    delete this[p];
                }
            }
        },
    };

    var path = _getProfilePath( name, type );
    profile = defaultProfile || {};

    if ( !Fs.existsSync(path) ) {
        Fs.writeFileSync(path, JSON.stringify(profile, null, 2));
    }
    else {
        try {
            profile = JSON.parse(Fs.readFileSync(path));
        }
        catch ( err ) {
            if ( err ) {
                Fire.warn( 'Failed to load profile %s, error message: %s', name, err.message );
                profile = {};
            }
        }
    }

    profile = Fire.JS.mixin( profile, profileProto );
    _profiles[id] = profile;

    return profile;
}

function registerProtocol () {
    Winston.normal( 'Register protocol' );

    // register protocol
    var Protocol = require('protocol');
    Protocol.registerProtocol('fire', function(request) {
        var url = decodeURIComponent(request.url);
        var data = Url.parse(url);
        var relativePath = data.hostname;
        if ( data.pathname ) {
            relativePath = Path.join( relativePath, data.pathname );
        }
        var file = Path.join( FIRE_PATH, relativePath );
        return new Protocol.RequestFileJob(file);
    });

    Protocol.registerProtocol('library', function(request) {
        var url = decodeURIComponent(request.url);
        var data = Url.parse(url);
        var relativePath = data.hostname;
        if ( data.pathname ) {
            relativePath = Path.join( relativePath, data.pathname );
        }
        var file = Path.join(Fire.AssetDB.getLibraryPath(), relativePath);
        var result = new Protocol.RequestFileJob(file);
        return result;
    });

    // DISABLE:
    // Protocol.registerProtocol('assets', function(request) {
    //     var url = decodeURIComponent(request.url);
    //     var file = Fire.AssetDB.fspath(url);
    //     return new Protocol.RequestFileJob(file);
    // });

    Protocol.registerProtocol('uuid', function(request) {
        var url = decodeURIComponent(request.url);

        //
        var data = Url.parse(url);
        var uuid = data.hostname;
        if ( data.pathname ) {
            uuid = Path.join( uuid, data.pathname );
        }
        var file = Fire.AssetDB.uuidToLibraryPath(uuid);

        if ( data.query === "thumb" ) {
            var rawfile = Fire.AssetDB.uuidToFspath(uuid);
            file = file + ".thumb" + Path.extname(rawfile);
        }

        //
        return new Protocol.RequestFileJob(file);
    });
}

function initFireApp () {
    Winston.normal( 'Initializing Fire' );

    // load Fire module
    Fire = require('./src/core/core');
    //Fire.JS.mixin( Fire, require('./src/engine/engine.editor-core'));
    Fire.JS.mixin( Fire, require('./src/editor-share/editor-share'));

    Fire.url = _fireurl;
    Fire.loadProfile = _loadProfile;

    // load ~/.fireball/fireball.json
    Fire.loadProfile( 'fireball', 'global', {
        recentlyOpened: [],
    });

    //
    var FireApp = require( Fire.url('editor-core://fire-app') );
    new FireApp();
}

function start() {
    // parse process arguments
    var options = parseArgv( process.argv.slice(1) );

    // quit when all windows are closed.
    App.on('window-all-closed', function( event ) {
        App.quit();
    });

    App.on('open-file', function() {
        // TODO
    });

    App.on('open-url', function() {
        // TODO
    });

    //
    App.on('will-finish-launching', function() {
        if ( !options.dev ) {
            var crashReporter = require('crash-reporter');
            crashReporter.start({
                productName: 'Fireball',
                companyName: 'FireBox',
                submitUrl: 'https://fireball-x.im/crash-report',
                autoSubmit: false,
            });
        }
    });

    if ( options.disableDirectWrite ) {
        App.commandLine.appendSwitch('disable-direct-write');
    }
    // DISABLE: http cache only happends afterwhile, not satisefy our demand (which need to happend immediately).
    // App.commandLine.appendSwitch('disable-http-cache');

    //
    App.on('ready', function() {
        registerProtocol();
        initFireApp();
        Fire.info("Welcome to Fireball! The next-gen html5 game engine.");

        Fire.isDev = options.dev;

        // check if project valid
        try {
            if ( options.project ) {
                var Fireball = require( Fire.url('editor-core://fireball') );
                Fireball.open(options);
            }
            else {
                var Dashboard = require( Fire.url('editor-core://dashboard') );
                Dashboard.open();
            }
        }
        catch ( error ) {
            Winston.error(error.stack || error);
            App.terminate();
        }
    });
}

// starts the app
start();
