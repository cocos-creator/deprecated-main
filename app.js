// init your app
var Fs = require('fire-fs');
var Path = require('fire-path');

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
            recentlyOpened: [],
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

