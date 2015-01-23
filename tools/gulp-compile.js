var Path = require('path');
var Fs = require('fs');
var Readable = require('stream').Readable;
var Format = require('util').format;

var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');

var es = require('event-stream');
var browserify = require('browserify');
var source = require('vinyl-source-stream');

var Nomnom = require('nomnom');

//var bufferify = require('vinyl-buffer');

//var rename = require('gulp-rename');
//var concat = require('gulp-concat');
//var jshint = require('gulp-jshint');
//var stylish = require('jshint-stylish');
//var uglify = require('gulp-uglify');
//var fb = require('gulp-fb');


/////////////////////////////////////////////////////////////////////////////
// parse args
/////////////////////////////////////////////////////////////////////////////

Nomnom.script('gulp --gulpfile gulp-compile.js');
Nomnom.option('project', {
    string: '-p PROJECT, --project=PROJECT',
    help: 'the project to compile',
    required: true,
});
Nomnom.option('platform', {
    string: '--platform=PLATFORM',
    help: 'the target platform to compile',
    'default': 'editor',
});
Nomnom.option('dest', {
    string: '--dest=DEST',
    help: 'the path for the output files',
    'default': 'library/bundle.js',
});
Nomnom.option('debug', {
    string: '-d, --debug',
    help: 'script debugging',
    flag: true,
});

var opts = Nomnom.parse();
var debug = opts.debug;
var platform = opts.platform;

/////////////////////////////////////////////////////////////////////////////
// configs
/////////////////////////////////////////////////////////////////////////////

function getScriptGlob(dir) {
    return [
        Path.join(dir, '**/*.js'),
        '!' + Path.join(dir, '**/{Editor,editor}/**'),   // 手工支持大小写，详见下面注释
    ];
}

var paths = {
    src: getScriptGlob('assets'),
    pluginSettings: 'settings/plugin-settings.json',
    tmpdir: 'temp',

    dest: opts.dest,
    proj: Path.resolve(opts.project),
};

paths.pluginSettings = Path.join(paths.proj, paths.pluginSettings);
paths.tmpdir = Path.join(paths.proj, paths.tmpdir);
//paths.tmpdir = Path.join(require('os').tmpdir(), 'fireball')
paths.dest = Path.resolve(paths.proj, paths.dest);

console.log('Compiling ' + paths.proj);
console.log('Output ' + paths.dest);

function getUserHome () {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

paths.globalPluginDir = Path.join(getUserHome(), '.fireball-x');
paths.builtinPluginDir = Path.resolve('builtin-plugins');


/////////////////////////////////////////////////////////////////////////////
// tasks
/////////////////////////////////////////////////////////////////////////////

// config
var tempScriptDir = paths.tmpdir + '/scripts';

// shared variable
var precompiledPaths = null;

// clean
gulp.task('clean', function (done) {
    var patternToDel = tempScriptDir + '/**/*'; // IMPORTANT
    del(patternToDel, { force: true }, function (err) {
        if (err) {
            done(err);
            return;
        }
        del(paths.dest, { force: true });
        done();
    });
});

var projectScripts;
gulp.task('parseProjectPlugins', function () {
    projectScripts = [];
    return gulp.src('assets/**/package.json.meta', { cwd: paths.proj })
        .pipe(es.through(function write (file) {
            var data = JSON.parse(file.contents);
            if ( !data.enable ) {
                projectScripts.push('!assets/' + Path.dirname(file.relative) + '/**');
            }
        }));
});

var externScripts;
gulp.task('getExternScripts', function (callback) {
    externScripts = [];
    // read plugin settings
    function parse (entries, pluginDir) {
        for (var name in entries) {
            var entry = entries[name];
            if (entry.enable) {
                var dir = Path.join(pluginDir, name);
                externScripts = externScripts.concat(getScriptGlob(dir));
            }
        }
    }
    Fs.readFile(paths.pluginSettings, function (err, data) {
        if (err) {
            // console.warn('Failed to load', paths.pluginSettings);
        }
        else {
            var setting = JSON.parse(data);
            parse(setting.builtin, paths.builtinPluginDir);
            parse(setting.global, paths.globalPluginDir);
        }
        callback();
    })
});

var scriptList;
gulp.task('getScriptList', ['parseProjectPlugins', 'getExternScripts'], function () {
    scriptList = paths.src.concat(projectScripts, externScripts);
});

function addMetaData () {
    var footer = "\nFire._RFpop();";
    var newLineFooter = '\n' + footer;
    return es.map(function (file, callback) {
        if (file.isStream()) {
            callback(new gutil.PluginError('addMetaData', 'Streaming not supported'));
            return;
        }
        if (file.isNull()) {
            callback();
            return;
        }
        //console.log('JS >>> ', file.path);

        // read uuid
        Fs.readFile(file.path + '.meta', function (err, data) {
            if (err) {
                callback(new gutil.PluginError('addMetaData', err));
                return;
            }
            var uuid = '';
            try {
                uuid = JSON.parse(data).uuid || '';
            }
            catch (e) {
            }
            uuid = uuid.replace(/-/g, '');

            var contents = file.contents.toString();
            var header;
            if (platform === 'editor') {
                var script = Path.basename(file.path, Path.extname(file.path));
                header = Format("Fire._RFpush('%s', '%s');\n// %s\n", uuid, script, file.relative);
            }
            else {
                header = Format("Fire._RFpush('%s');\n// %s\n", uuid, file.relative);
            }
            var startsWithNewLine = (contents[0] === '\n' || contents[0] === '\r');
            if ( !startsWithNewLine ) {
                header += '\n'; // nicify
            }
            var endsWithNewLine = (contents[contents.length - 1] === '\n' || contents[contents.length - 1] === '\r');
            file.contents = new Buffer(header + contents + (endsWithNewLine ? footer : newLineFooter));
            callback(null, file);
        });
    });
}

/**
 * pre-compile
 * 以单文件为单位，将文件进行预编译，将编译后的文件存放到 tempScriptDir，将文件列表放到 precompiledPaths
 */
gulp.task('pre-compile', ['clean', 'getScriptList'], function () {
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#options
    // https://github.com/isaacs/node-glob#options
    var GlobOptions = {
        cwd: paths.proj,
        //nodir: true,  // not worked
        //nocase = true;  // Windows 上用不了nocase，会有bug: https://github.com/isaacs/node-glob/issues/123
        //nonull: true,
    };
    //console.log(scriptList);
    precompiledPaths = [];
    var stream = gulp.src(scriptList, GlobOptions)
        .pipe(addMetaData())
        .pipe(gulp.dest(tempScriptDir))
        .pipe(es.through(function write(file) {
            // TODO: 检查 utf-8 bom 文件头否则会不支持require中文路径
            var encodingValid = true;
            if (!encodingValid) {
                this.emit('error', new gutil.PluginError('precompile', 'Sorry, encoding must be utf-8 (BOM): ' + file.relative, { showStack: false }));
                return;
            }
            precompiledPaths.push(file.relative);
        }));
    return stream;
});

// browserify
gulp.task('browserify', ['pre-compile'], function() {
    //function getMain() {
    //    // The main script just require all scripts to make them all loaded by engine.
    //    var content = "";
    //    for (var i = 0; i < precompiledPaths.length; ++i) {
    //        var file = precompiledPaths[i];         // eg: xxx\sss.js
    //        //var cmd = file.substring(0, file.length - Path.extname(file).length);  // eg: xxx\sss
    //        //cmd = cmd.replace(/\\/g, '/');          // eg: xxx/sss
    //        //cmd = "require('./" + cmd + "');\n";    // eg: require('./xxx/sss');
    //        var cmd = Path.basename(file, Path.extname(file));
    //        cmd = "require('" + cmd + "');\n";      // eg: require('sss');
    //        content += cmd;
    //    }
    //    //precompiledPaths = null;
    //    if (content.length === 0) {
    //        content = '/* no script */';
    //    }
    //    return content;
    //}
    //function toStream( content ) {
    //    var s = new Readable();
    //    s._read = function () {
    //        this.push(content);
    //        this.push(null);
    //    };
    //    return s;
    //}

    //var main = getMain();
    var opts = {
        debug: debug,
        basedir: tempScriptDir,
    };
    //var stream = toStream(main);

    // https://github.com/substack/node-browserify#methods
    var b = browserify(opts);
    for (var i = 0; i < precompiledPaths.length; ++i) {
        var file = precompiledPaths[i];
        b.add('./' + file);
        // expose the filename so as to avoid specifying relative path in require()
        opts.expose = Path.basename(file, Path.extname(file));
        b.require('./' + file, opts);
    }
    var bundle = b.bundle();
    return bundle.on('error', function (error) {
            console.error(gutil.colors.red('Browserify Error'), error.message);
            process.exit(1);
        })
        .pipe(source(Path.basename(paths.dest)))
        //.pipe(bufferify())
        .pipe(gulp.dest(Path.dirname(paths.dest)))
        ;
});

// default
gulp.task('default', ['browserify']);
