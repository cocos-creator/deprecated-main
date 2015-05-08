global.Editor = {};


// load user App definition
Editor.App = require('./app.js');
Editor.cwd = __dirname;

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
        Editor.sendToWindows('console:error', error.stack || error);
    }
    Winston.uncaught( error.stack || error );
});

// ---------------------------
// initialize minimal Editor
// ---------------------------

Editor.name = App.getName();

// mainEntry = absolute path of ./app.js
Editor.mainEntry = Path.join(Editor.cwd, 'app.js');

// NOTE: Editor.dataPath = ~/.{app-name}/
Editor.dataPath = Path.join( App.getPath('home'), '.' + Editor.name );

// initialize ~/.{app-name}
if ( !Fs.existsSync(Editor.dataPath) ) {
    Fs.makeTreeSync(Editor.dataPath);
}

// initialize ~/.{app-name}/settings/
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

// NOTE: commander only get things done barely in core level,
//       it doesn't touch the page level, so it should not put into App.on('ready')
Commander
    .version(App.getVersion())
    .option('--dev', 'Run in development mode')
    .option('--show-devtools', 'Open devtools automatically when main window loaded')
    .option('--debug <port>', 'Open in browser context debug mode', parseInt )
    .option('--debug-brk <port>', 'Open in browser context debug mode, and break at first.', parseInt)
    ;

// EXAMPLE:

// usage
// Commander
//     .usage('[options] <file ...>')
//     ;

// command
// Commander
//     .command('foobar').action( function () {
//         console.log('foobar!!!');
//         process.exit(1);
//     })
//     ;

if ( Editor.App.initCommander ) {
    Editor.App.initCommander(Commander);
}

// finish Commander initialize
Commander.parse(process.argv);

// apply argv to Editor
Editor.isDev = Commander.dev;
Editor.showDevtools = Commander.showDevtools;

// ---------------------------
// Define Editor.App APIs
// ---------------------------

var _editorAppIpc;
function _loadEditorApp () {
    var editorApp = Editor.App;

    if ( editorApp.load ) {
        try {
            Editor.App.load();
        }
        catch (err) {
            Editor.failed( 'Failed to load Editor.App, %s.', err.stack );
            return;
        }
    }

    // register ipcs
    var ipcListener = new Editor.IpcListener();
    for ( var prop in editorApp ) {
        if ( prop.indexOf(':') === -1 )
            continue;

        if ( typeof editorApp[prop] === 'function' ) {
            ipcListener.on( prop, editorApp[prop].bind(editorApp) );
        }
    }
    _editorAppIpc = ipcListener;
}

function _unloadEditorApp () {
    var editorApp = Editor.App;

    // unregister main ipcs
    _editorAppIpc.clear();
    _editorAppIpc = null;

    // unload main
    var cache = require.cache;
    if ( editorApp.unload ) {
        try {
            editorApp.unload();
        }
        catch (err) {
            Editor.failed( 'Failed to unload Editor.App, %s.', err.stack );
        }
    }

    delete cache[Editor.mainEntry];
}

function _reloadEditorApp () {
    _unloadEditorApp();
    Editor.App = require(Editor.mainEntry);
    Editor.App.reload = _reloadEditorApp;
    _loadEditorApp();

    Editor.success('Editor.App reloaded');
}

// ---------------------------
// register App events
// ---------------------------

// DISABLE: http cache only happends afterwhile, not satisefy our demand (which need to happend immediately).
// App.commandLine.appendSwitch('disable-http-cache');
// App.commandLine.appendSwitch('disable-direct-write');

// quit when all windows are closed.
App.on('window-all-closed', function( event ) {
    App.quit();
});

//
App.on('will-finish-launching', function() {
    // if ( !Editor.isDev ) {
    //     var crashReporter = require('crash-reporter');
    //     crashReporter.start({
    //         productName: 'Fireball',
    //         companyName: 'FireBox',
    //         submitUrl: 'https://fireball-x.com/crash-report',
    //         autoSubmit: false,
    //     });
    // }
});


//
App.on('ready', function() {
    Winston.normal( 'Initializing protocol' );
    require('./src/editor-core/protocol-init');

    Winston.normal( 'Initializing editor' );
    require('./src/editor-core/editor-init');

    Editor.registerProfilePath( 'global', Path.join( Editor.dataPath, 'settings' ) );
    Editor.registerProfilePath( 'local', Path.join( Editor.dataPath, 'settings' ) );

    // register package path
    Editor.registerPackagePath( Path.join( Editor.cwd, 'builtin' ) );
    Editor.registerPackagePath( Path.join( Editor.dataPath, 'extends' ) );

    // init user App
    if ( !Editor.App.init ) {
        Winston.error('Can not find function "init" in your App');
        App.terminate();
        return;
    }

    try {
        Editor.App.init(Commander);
    } catch ( error ) {
        Winston.error(error.stack || error);
        App.terminate();
        return;
    }

    // register user App Ipcs
    _loadEditorApp();
    Editor.App.reload = _reloadEditorApp;

    //
    Winston.success('Initial success!');

    // before run the app, we start loading packages
    Winston.normal('Loading packages');
    Editor.loadPackages();

    // run user App
    if ( !Editor.App.run ) {
        Winston.error('Can not find function "run" in your App');
        App.terminate();
        return;
    }

    try {
        Editor.App.run();
    } catch ( error ) {
        Winston.error(error.stack || error);
        App.terminate();
        return;
    }
});
