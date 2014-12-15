global.shellStartTime = Date.now();

// load modules
var App = require('app');
var Path = require('fire-path');
var Fs = require('fire-fs');
var Url = require('fire-url');
var Nomnom = require('nomnom');
var Chalk = require('chalk');

// set global values
global.FIRE_VER = "v0.0.8";
global.FIRE_PATH = __dirname;
global.FIRE_DATA_PATH = App.getDataPath();
global.FIRE_PROJECT_PATH = "";  // will be init in Fireball.open
global.Fire = {};

var _options = {};

// this will prevent default atom-shell uncaughtException 
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', function(error) {
    if ( Fire && Fire.error ) {
        Fire.error(error.message);
        console.error( Chalk.red(error.stack || error) );
    }
    else {
        console.error( Chalk.red.inverse.bold('Error:') + ' ' + Chalk.red(error.stack || error) );
    }
});

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
        global.FIRE_DATA_PATH = __dirname;
    }

    return opts;
}

function fireurl ( url ) {
    var data = Url.parse(url);
    var relativePath = '';

    switch ( data.protocol ) {
        case 'fire:':
            relativePath = url.substr(7);
            return Path.join( FIRE_PATH, relativePath );

        case 'editor-core:':
            relativePath = url.substr(14);
            if ( _options.dev ) {
                return './' + Path.join( 'src/editor-core/dev/', relativePath );
            }
            return './' + Path.join( 'src/editor-core/min/', relativePath );

        case 'assets:':
            return Fire.AssetDB.fspath(url);

        default:
            return url;
    }
}

function saveProfile () {
    // create default user profile.
    var profilePath = Path.join(FIRE_DATA_PATH,'profile.json');
    Fs.writeFileSync(profilePath, JSON.stringify(Fire.userProfile, null, 4));
}

function registerProtocol () {
    console.log( 'Register protocol' );

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
        var relpath = url.substr(10);
        var file = Path.join(Fire.AssetDB.getLibraryPath(),relpath);
        return new Protocol.RequestFileJob(file);
    });

    // DISABLE:
    // Protocol.registerProtocol('assets', function(request) {
    //     var url = decodeURIComponent(request.url);
    //     var file = Fire.AssetDB.fspath(url);
    //     return new Protocol.RequestFileJob(file);
    // });

    Protocol.registerProtocol('uuid', function(request) {
        var url = decodeURIComponent(request.url);
        var uuid = url.substr(7);
        var file = Fire.AssetDB.uuidToFspath(uuid);
        return new Protocol.RequestFileJob(file);
    });
}

function initFireApp () {
    console.log( 'Initializing Fire' );

    // load Fire core module
    if ( _options.dev ) {
        global.Fire = require('./src/core/core.dev');
        global.Fire = Fire.mixin( global.Fire,
                                  require('./src/editor-share/editor-share.dev')
                                  );
    }
    else {
        global.Fire = require('./src/core/core.min');
        global.Fire = Fire.mixin( global.Fire,
                                  require('./src/editor-share/editor-share.min')
                                  );
    }
    global.Fire.url = fireurl;
    global.Fire.saveProfile = saveProfile;
    global.Fire.Console = require( Fire.url('editor-core://fire-console') );

    // load user profile
    console.log( 'Loading user profile' );
    var profilePath = Path.join(FIRE_DATA_PATH,'profile.json');
    if ( !Fs.existsSync(profilePath) ) {
        Fire.userProfile = {
            recentlyOpened: [],
        };
        // create default user profile.
        Fs.writeFileSync(profilePath, JSON.stringify(Fire.userProfile, null, 4));
    }
    else {
        Fire.userProfile = JSON.parse(Fs.readFileSync(profilePath));
    }

    //
    var FireApp = require( Fire.url('editor-core://fire-app') );
    new FireApp();
}

function start() {
    // parse process arguments
    _options = parseArgv( process.argv.slice(1) );

    // TODO: check if exists
    // if ( FIRE_DATA_PATH )

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
        if ( !_options.dev ) {
            var crashReporter = require('crash-reporter');
            crashReporter.start({ 
                productName: 'Fireball-x', 
                companyName: 'FireBox', 
                submitUrl: 'https://fireball-x.im/crash-report',
                autoSubmit: false,
            });
        }
    });

    if ( _options.disableDirectWrite ) {
        App.commandLine.appendSwitch('disable-direct-write');
    }

    //
    App.on('ready', function() {
        registerProtocol();
        initFireApp();
        Fire.info("Welcome to Fireball-x! The next-gen html5 game engine.");

        // check if project valid
        try {
            if ( _options.project ) {
                var Fireball = require( Fire.url('editor-core://fireball') );
                Fireball.open(_options);
            }
            else {
                var Dashboard = require( Fire.url('editor-core://dashboard') );
                Dashboard.open();
            }
        }
        catch ( error ) {
            Fire.Console.error(error.stack || error);
            App.terminate();
        }
    });
}

// starts the app
start();
