var gulp = require('gulp');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var uglify = require('gulp-uglify');
var stylus = require('gulp-stylus');
var del = require('del');

var paths = {
    main: [
        'main.js'
    ],
    launch_js: [
        'launch.js',
    ],
    launch_css: [
        'launch.styl'
    ],
    tools: [
        'tools/**/*',
    ],
    static: [ 
        'static/**/*',
    ],
};

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
task_js('launch_js');

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

// static-dev
gulp.task('static-dev', function() {
    return gulp.src(paths.static)
    .pipe(gulp.dest('bin/dev/static'))
    ;
});

// static-min
gulp.task('static-min', ['static-dev'], function() {
    return gulp.src(paths.static)
    .pipe(gulp.dest('bin/min/static'))
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

/////////////////////////////////////////////////////////////////////////////
// tasks
/////////////////////////////////////////////////////////////////////////////

// watch
gulp.task('watch', function() {
    gulp.watch(paths.main, ['main-dev']).on( 'error', gutil.log );
    gulp.watch(paths.launch_js, ['launch_js-dev']).on( 'error', gutil.log );
    gulp.watch(paths.launch_css, ['launch_css-dev']).on( 'error', gutil.log );
    gulp.watch(paths.static, ['static-dev']).on( 'error', gutil.log );
    gulp.watch(paths.tools, ['tools-dev']).on( 'error', gutil.log );
});
gulp.task('watch-self', function() {
    gulp.watch(paths.main, ['main-dev']).on( 'error', gutil.log );
    gulp.watch(paths.launch_js, ['launch_js-dev']).on( 'error', gutil.log );
    gulp.watch(paths.launch_css, ['launch_css-dev']).on( 'error', gutil.log );
    gulp.watch(paths.static, ['static-dev']).on( 'error', gutil.log );
    gulp.watch(paths.tools, ['tools-dev']).on( 'error', gutil.log );
});

gulp.task('dev', ['main-dev', 'launch_js-dev', 'launch_css-dev', 'static-dev', 'tools-dev'] );
gulp.task('default', ['main-min', 'launch_js-min', 'launch_css-min', 'static-min', 'tools-min'] );
