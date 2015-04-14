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
        'main.js'
    ],
    page_init_js: [
        'page-init.js',
    ],
    panel_ready_js: [
        'panel-ready.js',
    ],
    metrics_js: [
        'metrics.js'
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
        src_basic: [['core', 'core'], ['engine', 'engine'], ['runtime/basic', 'runtime']],

        //cocos: {
        //    SRC: [['core', 'core'], ['engine', 'engine'], ['runtime/cocos', 'runtime']],
        //    src_min:
        //    src_dev:
        //    dest_min:
        //    dest_dev:
        //},

        shares: [
            build_base + 'platforms/shares/**/*'
        ],

        dest_dev: [
            'web-desktop/template-dev/firaball-x.dev.js',
            'web-mobile/template-dev/firaball-x.dev.js',
        ],
        dest_min: [
            'web-desktop/template/firaball-x.js',
            'web-mobile/template/firaball-x.js',
        ],
    },
};

paths.build_publish.src_min = paths.build_publish.src_basic.map(function (item) {
    return Path.join('..', item[0], 'bin', item[1] + '.player.js');
});
paths.build_publish.src_dev = paths.build_publish.src_basic.map(function (item) {
    return Path.join('..', item[0], 'bin', item[1] + '.player.dev.js');
});

/////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////

// clean
gulp.task('clean', function() {
    del('bin/');
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
task_js('metrics_js');

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
 * @param {string} templateVersion - dev or min
 * @param {string} editorVersion - dev or min
 */
function task_build_publish_js(templateVersion, editorVersion) {
    var src = paths.build_publish['src_' + templateVersion];
    var taskname = 'build-publish-js-' + templateVersion + '_' + editorVersion;
    // register task
    gulp.task(taskname, function () {
        var stream = gulp.src(src)
                         .pipe(concat('blabla.js'));
        for (var i = 0, dests = paths.build_publish['dest_' + templateVersion]; i < dests.length; i++) {
            var dest = Path.join('bin', editorVersion, build_base, 'platforms', dests[i]);
            stream = stream.pipe(rename(Path.basename(dest))).pipe(gulp.dest('bin'));
            if (templateVersion === 'min') {
                stream = stream.pipe(uglifyjs());
            }
            stream = stream.pipe(gulp.dest(Path.dirname(dest)));
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

function task_copy_shares(templateVersion, editorVersion) {
    var src = paths.build_publish.shares;
    var taskname = 'copy-shares-' + templateVersion + '_' + editorVersion;
    // register task
    gulp.task(taskname, function () {
        var stream = gulp.src(src);
        var i, dest;
        for (i = 0, dests = paths.build_publish['dest_' + templateVersion]; i < dests.length; i++) {
            dest = Path.join('bin', editorVersion, build_base, 'platforms', dests[i]);
            stream = stream.pipe(gulp.dest(Path.dirname(dest)));
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
    task_build_publish_js('dev', 'dev'),
    task_build_publish_js('min', 'dev'),
    task_copy_shares('dev', 'dev'),
    task_copy_shares('min', 'dev'),
]);
gulp.task('build-publish-min', [
    task_build_publish_js('dev', 'min'),
    task_build_publish_js('min', 'min'),
    task_copy_shares('dev', 'min'),
    task_copy_shares('min', 'min'),
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
    gulp.watch(paths.metrics_js, ['metrics_js-dev']).on('error', gutil.log);
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

gulp.task('dev', ['main-dev', 'page_init_js-dev', 'metrics_js-dev', 'panel_ready_js-dev', 'launch_css-dev', 'static-dev', 'tools-dev', 'build-publish-dev', 'copy-license-dev'] );
gulp.task('min', ['main-min', 'page_init_js-min', 'metrics_js-min', 'panel_ready_js-min', 'launch_css-min', 'static-min', 'tools-min', 'build-publish-min', 'copy-license-min'] );
gulp.task('default',['copy-min']);
gulp.task('all', ['default'] );
