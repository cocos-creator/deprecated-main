var Path = require('fire-path');
var Fs = require('fs');
//var Readable = require('stream').Readable;
var Format = require('util').format;

var Ipc = require('ipc');
var gulp = require('gulp');

var gutil = require('gulp-util');
var del = require('del');
var es = require('event-stream');

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');

function compileEnd () {
    Editor.sendToCore('compile-worker:end');
}

function compileError (err) {
    Editor.sendToCore('compile-worker:error', err);
}

function getScriptGlob(dir) {
    return [
        Path.join(dir, '**/*.js'),
        '!' + Path.join(dir, '**/{Editor,editor}/**'),   // 手工支持大小写，详见下面注释
    ];
}

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

Ipc.on('compile-worker:start', function (args) {

    var bundleInfos = {
        // the all-in-one bundle for distributing
        "all_in_one": {
            suffix: '',
            subDir: '',
            scriptGlobs: [],
            scripts: []
        },
        // builtin plugin runtime
        "builtin": {
            suffix: '.builtin',     // 编辑器下，插件编译出来的脚本会带上相应的后缀
            subDir: 'builtin',
            scriptGlobs: [],
            scripts: []
        },
        // global plugin runtime
        "global": {
            suffix: '.global',
            subDir: 'global',
            scriptGlobs: [],
            scripts: []
        },
        // project runtime scripts (plugin included)
        "project": {
            suffix: '.project',
            subDir: 'assets',
            scriptGlobs: [],
            scripts: []
        }
    };

    /////////////////////////////////////////////////////////////////////////////
    // parse args
    /////////////////////////////////////////////////////////////////////////////

    var opts = args;
    opts.compileGlobalPlugin = false;
    var dest = opts.dest = opts.dest || 'library/bundle.js';
    var platform = opts.platform = opts.platform || 'editor';
    var debug = opts.debug = !!opts.debug;
    var proj = opts.project;
    var isEditor = platform === 'editor';

    var allModules = {};

    // configs

    var paths = {
        src: getScriptGlob('assets'),
        tmpdir: 'temp',

        dest: opts.dest,
        proj: Path.resolve(opts.project)
    };

    paths.dest = Path.resolve(paths.proj, paths.dest);

    if (paths.proj === process.cwd()) {
        compileError('Compile error: Invalid project path: ' + opts.project);
        return;
    }
    else {
        console.log('Compiling ' + paths.proj);
    }

    console.log('Output ' + paths.dest);

    paths.globalPluginDir = opts.globalPluginDir;
    paths.builtinPluginDir = Path.resolve(Editor.cwd, 'builtin');
    paths.tmpdir = Path.join(paths.proj, paths.tmpdir);
    //paths.tmpdir = Path.join(require('os').tmpdir(), 'fireball')
    var tempScriptDir = paths.tmpdir + '/scripts';

    /////////////////////////////////////////////////////////////////////////////
    // tasks
    /////////////////////////////////////////////////////////////////////////////

    // clean
    gulp.task('clean', function (done) {
        var patternToDel = tempScriptDir + '/**/*'; // IMPORTANT
        del(patternToDel, { force: true }, function (err) {
            if (err) {
                done(err);
                return;
            }
            var destFilePrefix = Path.join(Path.dirname(paths.dest), Path.basenameNoExt(paths.dest));
            var destFileExt = Path.extname(paths.dest);
            for (var taskname in bundleInfos) {
                var info = bundleInfos[taskname];
                var destFile = destFilePrefix + info.suffix + destFileExt;
                del(destFile, { force: true });
            }
            done();
        });
    });

    gulp.task('parseProjectPlugins', function () {
        bundleInfos.project.scriptGlobs = [];
        return gulp.src('assets/**/package.json.meta', { cwd: paths.proj })
            .pipe(es.through(function write (file) {
                var data = JSON.parse(file.contents);
                if ( !data.enable ) {
                    bundleInfos.project.scriptGlobs.push('!assets/' + Path.dirname(file.relative) + '/**');
                }
            }));
    });

    gulp.task('getExternScripts', function (callback) {

        function getExternScripts (setting) {
            function getGlob (entries, pluginDir) {
                var res = [];
                for (var name in entries) {
                    var entry = entries[name];
                    if (entry.enable) {
                        var dir = Path.join(pluginDir, name);
                        res = res.concat(getScriptGlob(dir));
                    }
                }
                return res;
            }
            bundleInfos.builtin.scriptGlobs = getGlob(setting.builtins, paths.builtinPluginDir);
            bundleInfos.global.scriptGlobs = getGlob(setting.globals, paths.globalPluginDir);
            if ( !opts.compileGlobalPlugin ) {
                // PROHIBIT runtime scripts of global plugins
                gulp.src(bundleInfos.global.scriptGlobs, { read: false, nodir: true })
                    .on('data', function (file) {
                        console.warn('Not allowed to include runtime script in global plugin:', file.path,
                            '\nMove the plugin to assets please.');
                    });
                bundleInfos.global.scriptGlobs = [];
            }
            callback();
        }

        function updatePluginSetting (setting, callback) {
            var defaultSetting = {
                enable: true
            };
            function doUpdatePluginSetting (entries, pluginDir, cb) {
                // get available plugins
                gulp.src('*/package.json', { cwd: pluginDir, read: false, nodir: true })
                    .on('data', function (file) {
                        var dir = Path.dirname(file.path);
                        var name = Path.basename(dir);
                        if (!(name in entries)) {
                            console.log('Generate plugin settings for', dir);
                            entries[name] = defaultSetting;
                            dirty = true;
                        }
                    })
                    .on('end', function () {
                        cb();
                    });
            }
            var dirty = false;
            setting.builtins = setting.builtins || {};
            setting.globals = setting.globals || {};
            doUpdatePluginSetting(setting.builtins, paths.builtinPluginDir, function () {
                doUpdatePluginSetting(setting.globals, paths.globalPluginDir, function () {
                    callback(setting);
                    if (dirty) {
                        setting.save();
                    }
                });
            });
        }

        // read plugin settings
        updatePluginSetting(opts.pluginSettings, getExternScripts);
    });

    gulp.task('getScriptGlobs', ['parseProjectPlugins', 'getExternScripts'], function () {
        bundleInfos.project.scriptGlobs = paths.src.concat(bundleInfos.project.scriptGlobs);
        var allInOneGlobs;
        if ( opts.compileGlobalPlugin ) {
            allInOneGlobs = [].concat(bundleInfos.builtin.scriptGlobs,
                bundleInfos.global.scriptGlobs,
                bundleInfos.project.scriptGlobs);
        }
        else {
            allInOneGlobs = [].concat(bundleInfos.builtin.scriptGlobs,
                bundleInfos.project.scriptGlobs);
        }
        bundleInfos.all_in_one.scriptGlobs = allInOneGlobs;
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
                var uuid = '';
                if (err) {
                    if (Path.contains(paths.proj, file.path)) {
                        // project script
                        console.error('Failed to read meta file.');
                        callback(err);
                    }
                    //else {
                    //    external plugin script, no uuid
                    //}
                }
                else {
                    try {
                        uuid = JSON.parse(data).uuid;
                    }
                    catch (e) {
                    }
                    if (!uuid) {
                        callback(new gutil.PluginError('addMetaData', 'Failed to read uuid from meta.'));
                        return;
                    }
                    uuid = Editor.compressUuid(uuid);
                }

                var contents = file.contents.toString();
                var header;
                var script = Path.basename(file.path, Path.extname(file.path));
                if (uuid) {
                    header = Format("Fire._RFpush(module, '%s', '%s');\n// %s\n\n", uuid, script, file.relative);
                }
                else {
                    header = Format("Fire._RFpush(module, '%s');\n// %s\n\n", script, file.relative);
                }
                /* DISABLE to keep source map line offset
                 var startsWithNewLine = (contents[0] === '\n' || contents[0] === '\r');
                 if ( !startsWithNewLine ) {
                 header += '\n'; // nicify
                 }*/
                var endsWithNewLine = (contents[contents.length - 1] === '\n' || contents[contents.length - 1] === '\r');
                file.contents = new Buffer(header + contents + (endsWithNewLine ? footer : newLineFooter));
                callback(null, file);
            });
        });
    }

    /**
     * 以单文件为单位，将文件进行预编译，将编译后的文件存放到 destDir，将文件列表存到 outputFiles
     * @param {string[]} srcGlobs
     * @param {string} destDir
     * @param {string[]} outputFiles
     */
    function precompile (info, destDir) {
        // https://github.com/gulpjs/gulp/blob/master/docs/API.md#options
        // https://github.com/isaacs/node-glob#options
        var GlobOptions = {
            cwd: paths.proj,
            //nodir: true,  // not worked
            //nocase = true;  // Windows 上用不了nocase，会有bug: https://github.com/isaacs/node-glob/issues/123
            //nonull: true,
        };
        info.scripts.length = 0;

        function getModuleInfo (info, file) {
            if (info === bundleInfos.project || info === bundleInfos.all_in_one) {
                return file.relative;
            }
            else if (info === bundleInfos.builtin) {
                return Format("[%s] %s", info.subDir, Path.relative(paths.builtinPluginDir, file.path));
            }
            else if (info === bundleInfos.global) {
                return Format("[%s] %s", info.subDir, Path.relative(paths.globalPluginDir, file.path));
            }
        }

        var dest = Path.join(tempScriptDir, info.subDir);
        var stream = gulp.src(info.scriptGlobs, GlobOptions)
            .pipe(addMetaData())
            .pipe(es.through(function write(file) {
                // check name conflict
                var moduleName = Path.basenameNoExt(file.path);
                var exists = allModules[moduleName];
                if (exists) {
                    var error = Format('Filename conflict, the module "%s" both defined in "%s" and "%s"',
                        moduleName, getModuleInfo(info, file), exists);
                    if (gulp.isRunning) {
                        gulp.stop(error);
                    }
                    else {
                        this.emit('error', error);
                    }
                    return;
                }
                allModules[moduleName] = getModuleInfo(info, file);
                ////
                //// TODO: 检查 utf-8 bom 文件头否则会不支持require中文路径
                //var encodingValid = true;
                //if (!encodingValid) {
                //    this.emit('error', 'Sorry, encoding must be utf-8 (BOM): ' + file.relative);
                //    return;
                //}
                //
                info.scripts.push(Path.join(info.subDir, file.relative));
                this.emit('data', file);
            }))
            .pipe(gulp.dest(dest));
        return stream;
    }

    function browserifyTask (srcPaths, destDir, destFile) {
        var options = {
            debug: debug,
            basedir: tempScriptDir
        };
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
                if (gulp.isRunning) {
                    gulp.stop(nicifyError(error));
                }
                //result.emit('end');     // make this task really stopped in gulp
            })
            .pipe(source(destFile));

        if ( !options.debug ) {
            bundle = bundle.pipe(buffer())
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(uglify())
                .pipe(sourcemaps.write('./'));
        }
        var result = bundle.pipe(gulp.dest(destDir));//.on('end', function () {console.log('end', destFile);});
        return result;
    }

    // create tasks

    function createTask(taskname, info) {
        gulp.task('pre-compile-' + taskname, ['clean', 'getScriptGlobs'], function () {
            return precompile(info, tempScriptDir);
        });
        gulp.task('browserify-' + taskname, ['pre-compile-' + taskname], function (done) {
            //console.log('start', 'browserify-' + taskname);
            var destDir = Path.dirname(paths.dest);
            var destFile = Path.basename(paths.dest);
            if (info.suffix) {
                destFile = Path.basenameNoExt(destFile) + info.suffix + Path.extname(destFile);
            }
            return browserifyTask(info.scripts, destDir, destFile);
        });
    }

    for (var taskname in bundleInfos) {
        var info = bundleInfos[taskname];
        createTask(taskname, info);
    }

    if (isEditor) {
        if ( opts.compileGlobalPlugin ) {
            gulp.task('compile', ['browserify-builtin', 'browserify-global', 'browserify-project']);
        }
        else {
            gulp.task('compile', ['browserify-builtin', 'browserify-project']);
        }
    }
    else {
        gulp.task('compile', ['browserify-all_in_one']);
    }

    /////////////////////////////////////////////////////////////////////////////
    // start
    /////////////////////////////////////////////////////////////////////////////

    gulp.start('compile', function (err) {
        if (err) {
            compileError(err);
        }
        else {
            compileEnd();
        }
    });
});
