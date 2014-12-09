var Path = require('path');

var gulp = require('gulp');
var gutil = require('gulp-util');
//var del = require('del');

//var through = require('through');

var ToolsRunner = require('./tools-runner');

var BuildPrefix = 'build-';


/////////////////////////////////////////////////////////////////////////////
// parse args
/////////////////////////////////////////////////////////////////////////////

var proj = gutil.env.project;
if (!proj || typeof proj !== 'string') {
    console.error('Use "--project OOXX" to specify the project to build');
    process.exit(1);
}

var platform = gutil.env.platform;
if (!platform || typeof platform !== 'string') {
    console.error('Use "--platform OOXX" to specify the target platform to build');
    process.exit(1);
}

var debug = gutil.env.debug;

/////////////////////////////////////////////////////////////////////////////
// configs
/////////////////////////////////////////////////////////////////////////////

var paths = {
    src: Path.join(proj, 'assets/**/*.js'),
    srcbase: undefined,
    //tmpdir: Path.join(require('os').tmpdir(), 'fireball'),
    tmpdir: Path.join(proj, 'temp'),
    dest: Path.join(proj, 'library/bundle.js'),
};

/////////////////////////////////////////////////////////////////////////////
// tasks
/////////////////////////////////////////////////////////////////////////////

gulp.task('compile', function (done) {
    var args = [
        '--project', proj,
        '--build',
    ];
    if (debug) {
        args.push('--debug');
    }
    
    // run!
    ToolsRunner.gulp('tools/gulp-compile.js', args, function (succeeded) {
        if (succeeded) {
            done();
        }
        else {
            console.error('Failed to build');
            process.exit(1);
        }
    });
});
    
gulp.task(BuildPrefix + 'web-desktop', ['compile'], function () {

});

// default
gulp.task('default', ['build']);

/////////////////////////////////////////////////////////////////////////////
// check platform
/////////////////////////////////////////////////////////////////////////////

var buildTask = BuildPrefix + platform;
if (buildTask in gulp.tasks) {
    // redirect your platform
    gulp.task('build', [buildTask]);
}
else {
    var availables = [];
    for (var key in gulp.tasks) {
        if (key.indexOf(BuildPrefix) === 0) {
            availables.push(key.substring(BuildPrefix.length));
        }
    }
    console.error('Not support %s platform, available platform currently: %s', platform, availables);
    process.exit(1);
}
