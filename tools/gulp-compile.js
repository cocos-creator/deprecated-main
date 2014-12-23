var Path = require('path');
var Readable = require('stream').Readable;

var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');

var through = require('through');
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
var proj = opts.project;
var debug = opts.debug;
var platform = opts.platform;

proj = Path.resolve(proj);
console.log('Compiling ' + proj);

/////////////////////////////////////////////////////////////////////////////
// configs
/////////////////////////////////////////////////////////////////////////////

var paths = {
    src: [
        Path.join(proj, 'assets/**/*.js'),
        '!**/Editor/**',    // 手工支持大小写，详见 GlobOptions 注释
        '!**/editor/**',
    ],
    srcbase: undefined,
    //tmpdir: Path.join(require('os').tmpdir(), 'fireball'),
    tmpdir: Path.join(proj, 'temp'),
    dest: Path.resolve(proj, opts.dest),
};

console.log('Output ' + paths.dest);

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
        del(paths.dest);
        done();
    });
});

function addDebugInfo () {
    var footer = "Fire._requiringStack.pop();";
    var footerBuf = new Buffer(footer);
    function write (file) {
        if (file.isStream()) {
            this.emit('error', new gutil.PluginError('addDebugInfo', 'Streaming not supported'));
            return;
        }
        if (file.isNull()) {
            return;
        }
        //console.log('JS >>> ', file.path);
        var header = "Fire._requiringStack.push('" +
                     Path.basename(file.path, Path.extname(file.path)) +
                     "');\n";
        file.contents = Buffer.concat([new Buffer(header), file.contents, footerBuf]);
        this.emit('data', file);
    }
    return through(write);
}

/**
 * pre-compile
 * 以单文件为单位，将文件进行预编译，将编译后的文件存放到 tempScriptDir，将文件列表放到 precompiledPaths
 */
gulp.task('pre-compile', ['clean'], function () {
    // https://github.com/gulpjs/gulp/blob/master/docs/API.md#options
    // https://github.com/isaacs/node-glob#options
    var GlobOptions = {
        base: paths.srcbase,
        //nodir: true,  // not worked
        //nocase = true;  // Windows 上用不了nocase，会有bug: https://github.com/isaacs/node-glob/issues/123
        //nonull: true,
    };

    precompiledPaths = [];
    var stream = gulp.src(paths.src, GlobOptions);
    if (debug) {
        stream = stream.pipe(addDebugInfo());
    }
    return stream.pipe(gulp.dest(tempScriptDir))
        .pipe(through(function write(file) {
            // TODO: 检查 utf-8 bom 文件头否则会不支持require中文路径
            var encodingValid = true;
            if (!encodingValid) {
                this.emit('error', new gutil.PluginError('precompile', 'Sorry, encoding must be utf-8 (BOM): ' + file.relative, { showStack: false }));
                return;
            }
            precompiledPaths.push(file.relative);
        }));
});

// browserify
gulp.task('browserify', ['pre-compile'], function() {
    function getMain() {
        // The main script just require all scripts to make them all loaded by engine.
        var content = "";
        for (var i = 0; i < precompiledPaths.length; ++i) {
            var file = precompiledPaths[i];         // eg: xxx\sss.js
            //var cmd = file.substring(0, file.length - Path.extname(file).length);  // eg: xxx\sss
            //cmd = cmd.replace(/\\/g, '/');          // eg: xxx/sss
            //cmd = "require('./" + cmd + "');\n";    // eg: require('./xxx/sss');
            var cmd = Path.basename(file, Path.extname(file));
            cmd = "require('" + cmd + "');\n";      // eg: require('sss');
            content += cmd;
        }
        //precompiledPaths = null;
        if (content.length === 0) {
            content = '/* no script */';
        }
        return content;
    }
    function toStream( content ) {
        var s = new Readable();
        s._read = function () {
            this.push(content);
            this.push(null);
        };
        return s;
    }

    var main = getMain();
    //console.log(main);
    var opts = {
        debug: debug,
        basedir: tempScriptDir,
    };
    var stream = toStream(main);

    // https://github.com/substack/node-browserify#methods
    var b = browserify(stream, opts);
    for (var i = 0; i < precompiledPaths.length; ++i) {
        var file = precompiledPaths[i];
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
