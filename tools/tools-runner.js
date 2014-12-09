var Spawn = require('child_process').spawn;
var Path = require('path');

var WinCMDTools = ['gulp'];

var cwd;
var standalone = typeof Fire === 'undefined';
if (standalone) {
    Fire = require('../src/core/core.dev');
    FIRE_PATH = Path.dirname(__dirname);
    cwd = process.cwd();
}
else {
    cwd = FIRE_PATH;
}

var ToolsRunner = {

    /**
     * @param {function} [callback]
     */
    spawn: function (command, args, callback) {
        if (!standalone) {
            Fire.log('Running: ' + cwd + '>' + command + ' ' + args.join(' '));
        }
        
        // spawn process

        if (Fire.isWin32 && WinCMDTools.indexOf(command) !== -1) {
            command += '.cmd';
        }
        var childProcess = Spawn(command, args, {
            cwd: cwd
        });
        childProcess.stderr.on('data', function (buf) {
            // error
            Fire.error(buf.toString().trimRight());
        });
        childProcess.stdout.on('data', function (buf) {
            // log
            console.log(buf.toString().trimRight());
        });
        childProcess.on('close', function (code) {
            // close
            console.log('%s exited with code %s', command, code);
            var succeeded = (code === 0);
            if (callback) {
                callback(succeeded);
            }
        });
    },

    gulp: function (gulpfile, args, callback) {
        args.unshift('--gulpfile', gulpfile);
        args.unshift('--cwd', cwd);   // to prevent cwd changed by --gulpfile
        this.spawn('gulp', args, callback);
    },
};

module.exports = ToolsRunner;
