var Path = require('fire-path');
var Ipc = require('ipc');
var gulp = require('gulp');

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');

function nicifyError (error) {
    function matchFormat (str, prefix, suffix) {
        if (str.substring(0, prefix.length) === prefix && str.substring(str.length - suffix.length) === suffix) {
            return str.substring(prefix.length, str.length - suffix.length);
        }
        return "";
    }
    var msg = error.message;
    if (msg) {
        var path = matchFormat(msg, "ENOENT, open '", ".js'");
        var module;
        if (path) {
            // ENOENT, open '/Users/**/temp/scripts/**/*.js', then means 'module not found'
            module = Path.basenameNoExt(path);
            return Format("'require': Cannot find module '%s'.\nDetails: " + msg, module);
        }
        path = matchFormat(msg, "ENOENT: no such file or directory, open '", ".js'");
        if (path) {
            // ENOENT: no such file or directory, open '/Users/**/temp/scripts/**/*js', then means 'module not found'
            module = Path.basenameNoExt(path);
            return Format("'require': Cannot find module '%s'.\nDetails: " + msg, module);
        }
        else if (matchFormat(msg, "Cannot find module '", "'")) {
            return "'require': " + msg;
        }
        else {
            return "Compile error: " + msg;
        }
    }
    else {
        return error;
    }
}

Ipc.on('browserify', function (options, srcPaths, destDir, destFile) {
    // https://github.com/substack/node-browserify#methods
    var b = new browserify(options);
    for (var i = 0; i < srcPaths.length; ++i) {
        var file = srcPaths[i];
        file = Path.join(options.basedir, file);
        b.add(file);
        // expose the filename so as to avoid specifying relative path in require()
        var moduleName = Path.basenameNoExt(file);
        b.require(file, {
            expose: moduleName
        });
    }
    var bundle = b.bundle()
        .on('error', function (error) {
            error = nicifyError(error);
            Editor.sendToCore('browserify:compile-error:' + destFile, error);
        })
        .pipe(source(destFile));

    if ( !options.debug ) {
        bundle = bundle.pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify())
            .pipe(sourcemaps.write('./'));
    }
    var result = bundle.pipe(gulp.dest(destDir));//.on('end', function () {console.log('end', destFile);});
    result.on('end', function () {
        Editor.sendToCore('browserify:end:' + destFile);
    });
    result.on('error', function (error) {
        Editor.sendToCore('browserify:unexpected-error:' + destFile, error);
    });
});
