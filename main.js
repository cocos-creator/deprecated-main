// ---------------------------
// load modules
// ---------------------------

var App = require('app');
var Path = require('fire-path');
var Fs = require('fire-fs');
var Url = require('fire-url');
var Commander = require('commander');
var Chalk = require('chalk');
var Winston = require('winston');

// this will prevent default atom-shell uncaughtException
process.removeAllListeners('uncaughtException');
process.on('uncaughtException', function(error) {
    if ( Editor && Editor.sendToWindows ) {
        Editor.sendToWindows('console:error', {
            message: error.stack || error
        });
    }
    Winston.uncaught( error.stack || error );
});

// ---------------------------
// initialize minimal Editor
// ---------------------------

global.Editor = {};
global.Fire = {};

Editor.name = App.getName();
Editor.cwd = __dirname;
// NOTE: Editor.dataPath = ~/.{app-name}/
Editor.dataPath = Path.join( App.getPath('home'), '.' + Editor.name );

// initialize ~/.{app-name}
if ( !Fs.existsSync(Editor.dataPath) ) {
    Fs.makeTreeSync(Editor.dataPath);
}

// initialize ~/.fireball/settings/
var settingsPath = Path.join(Editor.dataPath, 'settings');
if ( !Fs.existsSync(settingsPath) ) {
    Fs.mkdirSync(settingsPath);
}

// ---------------------------
// initialize logs/
// ---------------------------

// MacOSX: ~/Library/Logs/{app-name}
// Windows: %APPDATA%, some where like 'C:\Users\{your user name}\AppData\Local\...'

// get log path
var _logpath = '';
if ( process.platform === 'darwin' ) {
    _logpath = Path.join(App.getPath('home'), 'Library/Logs/' + Editor.name );
}
else {
    _logpath = App.getPath('appData');
}

if ( !Fs.existsSync(_logpath) ) {
    Fs.makeTreeSync(_logpath);
}

var _logfile = Path.join(_logpath, Editor.name + '.log');
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
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + text;
    },

    success: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_success(text);
    },

    failed: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_error(text);
    },

    info: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_info(text);
    },

    warn: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_warn.inverse.bold('Warning:') + ' ' + chalk_warn(text);
    },

    error: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_error.inverse.bold('Error:') + ' ' + chalk_error(text);
    },

    fatal: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_error.inverse.bold('Fatal Error:') + ' ' + chalk_error(text);
    },

    uncaught: function ( text ) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        return pid + chalk_error.inverse.bold('Uncaught Exception:') + ' ' + chalk_error(text);
    },
};

Winston.add( Winston.transports.Console, {
    level: 'normal',
    formatter: function (options) {
        var pid = chalk_id('[' + process.pid + ']') + ' ';
        var text = '';
        if ( options.message !== undefined ) {
            text += options.message;
        }
        if ( options.meta && Object.keys(options.meta).length ) {
            text += ' ' + JSON.stringify(options.meta);
        }

        // output log by different level
        var formatter = levelToFormat[options.level];
        if ( formatter ) {
            return formatter(text);
        }

        return text;
    }
});

// ---------------------------
// initialize Commander
// ---------------------------

// DELME
// //
// function _parseArgv( argv ) {
//     Nomnom
//     .script('fire')
//     .option('project', { position: 0, help: 'The fireball project file.' })
//     .option('version', { abbr: 'v', flag: true, help: 'Print the version.',
//             callback: function () { return App.getVersion(); } })
//     .option('help', { abbr: 'h', flag: true, help: 'Print this usage message.' })
//     .option('dev', { abbr: 'd', flag: true, help: 'Run in development mode.' })
//     .option('showDevtools', { abbr: 'D', full: 'show-devtools', flag: true, help: 'Open devtools automatically when main window loaded.' })
//     .option('debug', { full: 'debug', flag: true, help: 'Open in browser context debug mode.' })
//     .option('debugBreak', { full: 'debug-brk', flag: true, help: 'Open in browser context debug mode, and break at first.' })
//     .option('disableDirectWrite', { full: 'disable-direct-write', flag: true, help: 'Disables the DirectWrite font rendering system on windows.' })
//     ;

//     var opts = Nomnom.parse(argv);

//     if ( opts.dev ) {
//         if ( opts._.length < 2 ) {
//             opts.project = null;
//         }
//         else {
//             opts.project = opts._[opts._.length-1];
//         }
//     }

//     return opts;
// }
// DELME

// NOTE: commander only get things done barely in core level,
//       it doesn't touch the page level, so it should not put into App.on('ready')
Commander
    .version(App.getVersion())
    .option('--dev', 'Run in development mode')
    .option('--show-devtools', 'Open devtools automatically when main window loaded')
    .option('--debug <port>', 'Open in browser context debug mode', parseInt )
    .option('--debug-brk <port>', 'Open in browser context debug mode, and break at first.', parseInt)
    ;

Commander
    .usage('[options] <project-path>')
    ;

// finish Commander initialize
Commander.parse(process.argv);

Editor.isDev = Commander.dev;
Editor.showDevtools = Commander.showDevtools;

// DISABLE: http cache only happends afterwhile, not satisefy our demand (which need to happend immediately).
// App.commandLine.appendSwitch('disable-http-cache');
// App.commandLine.appendSwitch('disable-direct-write');

// quit when all windows are closed.
App.on('window-all-closed', function( event ) {
    App.quit();
});

//
App.on('will-finish-launching', function() {
    if ( !Editor.isDev ) {
        var crashReporter = require('crash-reporter');
        crashReporter.start({
            productName: 'Fireball',
            companyName: 'FireBox',
            submitUrl: 'https://fireball-x.com/crash-report',
            autoSubmit: false,
        });
    }
});


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

//
App.on('ready', function() {
    Winston.normal( 'Initializing protocol' );
    require('./src/editor-core/protocol-init');

    Winston.normal( 'Initializing editor' );
    require('./src/editor-core/editor-init');
    require('./src/editor-core/ipc-init');

    Winston.normal( 'Initializing fire' );
    _initFire();

    Editor.registerProfilePath( 'global', Path.join( Editor.dataPath, 'settings' ) );
    Editor.registerProfilePath( 'local', Path.join( Editor.dataPath, 'settings' ) );

    Winston.success('Initial success!');

    // check if project valid
    try {
        Fire.info('Welcome to Fireball! The next-gen html5 game engine.');

        // load ~/.fireball/fireball.json
        Editor.loadProfile( 'fireball', 'global', {
            recentlyOpened: [],
        });

        if ( Commander.args.length > 0 ) {
            var Fireball = require( Editor.url('editor-core://fireball') );
            Fireball.open({
                path: Commander.args[0],
            });
        }
        else {
            var Dashboard = require( Editor.url('editor-core://dashboard') );
            Dashboard.open();
        }
    }
    catch ( error ) {
        Winston.error(error.stack || error);
        App.terminate();
    }
});
