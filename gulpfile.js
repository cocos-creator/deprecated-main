var Path = require('path');

var gulp = require('gulp');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var uglifyjs = require('gulp-uglifyjs');
var uglify = require('gulp-uglify');
var stylus = require('gulp-stylus');
var del = require('del');

var build_base = 'tools/build/';

var paths = {
    main: [
        'main.js',
        'app.js',
    ],
    page_init_js: [
        'page-init.js',
    ],
    panel_ready_js: [
        'panel-ready.js',
    ],
    cookie_js: [
        'cookie.js'
    ],
    launch_css: [
        'launch.styl'
    ],
    tools: [
        'tools/**/*',
        '!' + build_base + 'platforms/shares/',
        '!' + build_base + 'platforms/shares/**/*'
    ],
    static: [
        'static/**/*',
        'templates/**/*',
    ],
    build_publish: {
        runtimes: {
            basic: {
                src_tmpl: [['core', 'core'], ['engine', 'engine'], ['runtime/basic', 'runtime']]
            },
            cocos: {
                src_tmpl: [['core', 'core'], ['engine', 'engine'], ['runtime/cocos', 'runtime']]
            },
        },
        dest_dev: 'fireball.dev.js',
        dest_min: 'fireball.js',
        shares: [
            build_base + 'platforms/shares/**/*'
        ],
        dest_shares: [
            'web-desktop/template-dev',
            'web-mobile/template-dev',
            'web-desktop/template',
            'web-mobile/template',
        ],
    },
};

// 生成 src_min 和 src_dev
for (var runtime in paths.build_publish.runtimes) {
    var profile = paths.build_publish.runtimes[runtime];
    profile.src_min = profile.src_tmpl.map(function (item) {
        return Path.join('..', item[0], 'bin', item[1] + '.player.js');
    });
    profile.src_dev = profile.src_tmpl.map(function (item) {
        return Path.join('..', item[0], 'bin', item[1] + '.player.dev.js');
    });
}

/////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////

// clean
gulp.task('clean', function(cb) {
    del('bin/', cb);
});

var task_js = function ( name ) {
    // name-jshint
    gulp.task(name+'-jshint', function() {
        return gulp.src(paths[name])
        .pipe(jshint({
            forin: false,
            multistr: true,
        }))
        .pipe(jshint.reporter(stylish))
        ;
    });

    // name-dev
    gulp.task(name+'-dev', [name+'-jshint'], function() {
        return gulp.src(paths[name])
        .pipe(gulp.dest('bin/dev/'))
        ;
    });

    // name-min
    gulp.task(name+'-min', [name+'-dev'], function() {
        return gulp.src(paths[name])
        .pipe(uglify())
        .pipe(gulp.dest('bin/min/'))
        ;
    });
};

task_js('main');
task_js('page_init_js');
task_js('panel_ready_js');
task_js('cookie_js');

// launch-css-dev
gulp.task( 'launch_css-dev', function() {
    return gulp.src( paths.launch_css)
    .pipe(stylus({
        compress: true,
        include: 'src'
    }))
    .pipe(gulp.dest('bin/dev/'));
});

// launch-css-min
gulp.task( 'launch_css-min', ['launch_css-dev'], function() {
    return gulp.src( paths.launch_css)
    .pipe(stylus({
        compress: true,
        include: 'src'
    }))
    .pipe(gulp.dest('bin/min/'));
});

/**
 * @param {string} playerVersion - dev or min
 * @param {string} editorVersion - dev or min
 * @param {string} runtime
 */
function task_build_publish_js(playerVersion, editorVersion, runtime) {
    var src = paths.build_publish.runtimes[runtime]['src_' + playerVersion];
    var taskname = 'build-publish-js-' + runtime + '-' + playerVersion + '_' + editorVersion;
    // register task
    gulp.task(taskname, function () {
        var dest = paths.build_publish['dest_' + playerVersion]; // dest_min / dest_dev
        dest = Path.join('bin', editorVersion, build_base, 'engine', runtime, dest);
        //console.log('src', src);
        //console.log('dest', dest);
        var stream = gulp.src(src)
                         .pipe(concat(Path.basename(dest)));
        if (playerVersion === 'min') {
            stream = stream.pipe(uglifyjs({
                //compress: {
                //    dead_code: true,
                //    unused: true
                //}
            }));
        }
        stream = stream.pipe(gulp.dest(Path.dirname(dest)));
        return stream;
    });
    // register watch
    if (editorVersion === 'dev') {
        gulp.tasks[taskname].watch = function () {
            gulp.watch(src, [taskname]).on('error', gutil.log);
        };
    }
    //
    return taskname;
}

function task_copy_shares(editorVersion) {
    var src = paths.build_publish.shares;
    var taskname = 'copy-shares-' + editorVersion;
    // register task
    gulp.task(taskname, function () {
        var stream = gulp.src(src);
        for (var i = 0, dests = paths.build_publish.dest_shares; i < dests.length; i++) {
            var dest = Path.join('bin', editorVersion, build_base, 'platforms', dests[i]);
            stream = stream.pipe(gulp.dest(dest));
        }
        return stream;
    });
    // register watch
    if (editorVersion === 'dev') {
        gulp.tasks[taskname].watch = function () {
            gulp.watch(src, [taskname]).on('error', gutil.log);
        };
    }
    //
    return taskname;
}

// build publish
gulp.task('build-publish-dev', [
    task_build_publish_js('dev', 'dev', 'cocos'),
    task_build_publish_js('min', 'dev', 'cocos'),
    task_build_publish_js('dev', 'dev', 'basic'),
    task_build_publish_js('min', 'dev', 'basic'),
    task_copy_shares('dev'),
]);
gulp.task('build-publish-min', [
    task_build_publish_js('dev', 'min', 'cocos'),
    task_build_publish_js('min', 'min', 'cocos'),
    task_build_publish_js('dev', 'min', 'basic'),
    task_build_publish_js('min', 'min', 'basic'),
    task_copy_shares('min'),
]);

// static-files-dev
gulp.task('static-dev', ['build-publish-dev'], function() {
    return gulp.src(paths.static, {base: './'})
    .pipe(gulp.dest('bin/dev/'))
    ;
});

// static-files-min
gulp.task('static-min', ['build-publish-min'], function() {
    return gulp.src(paths.static, {base: './'})
    .pipe(gulp.dest('bin/min/'))
    ;
});

// tools-dev
gulp.task('tools-dev', function() {
    return gulp.src(paths.tools)
    .pipe(gulp.dest('bin/dev/tools'))
    ;
});

// tools-min
gulp.task('tools-min', ['tools-dev'], function() {
    return gulp.src(paths.tools)
    .pipe(gulp.dest('bin/min/tools'))
    ;
});

// copy min files to dev
gulp.task('copy-min', ['min'], function() {
    del.sync('bin/dev');
    return gulp.src('bin/min/**/*')
        .pipe(gulp.dest('bin/dev/'));
});

// copy license
gulp.task('copy-license-dev', function() {
    return gulp.src('LICENSE')
            .pipe(gulp.dest('bin/dev'));
});

gulp.task('copy-license-min', function() {
    return gulp.src('LICENSE')
            .pipe(gulp.dest('bin/min'));
});

/////////////////////////////////////////////////////////////////////////////
// tasks
/////////////////////////////////////////////////////////////////////////////

// watch
gulp.task('watch', function() {
    gulp.watch(paths.main, ['main-dev']).on( 'error', gutil.log );
    gulp.watch(paths.page_init_js, ['page_init_js-dev']).on( 'error', gutil.log );
    gulp.watch(paths.panel_ready_js, ['panel_ready_js-dev']).on( 'error', gutil.log );
    gulp.watch(paths.cookie_js, ['cookie_js-dev']).on('error', gutil.log);
    gulp.watch(paths.launch_css, ['launch_css-dev']).on( 'error', gutil.log );
    gulp.watch(paths.static, ['static-dev']).on( 'error', gutil.log );
    gulp.watch(paths.tools, ['tools-dev']).on( 'error', gutil.log );

    for (var task in gulp.tasks) {
        var watch = gulp.tasks[task].watch;
        if (watch) {
            watch();
        }
    }
});

gulp.task('dev', ['main-dev', 'page_init_js-dev', 'cookie_js-dev', 'panel_ready_js-dev', 'launch_css-dev', 'static-dev', 'tools-dev', 'build-publish-dev', 'copy-license-dev'] );
gulp.task('min', ['main-min', 'page_init_js-min', 'cookie_js-min', 'panel_ready_js-min', 'launch_css-min', 'static-min', 'tools-min', 'build-publish-min', 'copy-license-min'] );
gulp.task('default',['copy-min']);
gulp.task('all', ['default'] );
