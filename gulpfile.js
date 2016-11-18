var gulp = require('gulp'),
    rimraf = require('rimraf'),
    Builder = require('systemjs-builder'),
    runSequence = require('run-sequence'),
    htmlMinifier = require('html-minifier'),
    inlineNg2Template = require('gulp-inline-ng2-template'),
    plugins = require('gulp-load-plugins')({
        lazy: true
    });

var tsProject = plugins.typescript.createProject('tsconfig.json');

var paths = {
    assets: [
        'src/**/*.html',
        'src/**/*.js',
        'src/**/*.css'
    ],
    server:[
        'bin/**',
        'routes/**',
        'app.js',
        'views/**',
        '!views/index.ejs'
    ],
    views:'dist/express/views/',
    vendors: [
        'node_modules/jquery/dist/jquery.js',
        'node_modules/bootstrap/dist/js/bootstrap.js',
        'node_modules/core-js/client/shim.js',
        'node_modules/zone.js/dist/zone.js',
        'node_modules/reflect-metadata/Reflect.js'
    ],
    systemjsConfig: 'src/systemjs.config.js',
    css: [
        'node_modules/bootstrap/dist/css/bootstrap.css',
        'src/css/main.css'
    ],
    prod: 'dist/prod/',
    dev: 'dist/dev/',
    express:'dist/express/',
    tmp: 'dist/tmp/'
};

function minifyTemplate(path, ext, file, cb) {
    try {
        var minifiedFile = htmlMinifier.minify(file, {
            collapseWhitespace: true,
            caseSensitive: true,
            removeComments: true,
            removeRedundantAttributes: true
        });
        cb(null, minifiedFile);
    }
    catch (err) {
        cb(err);
    }
}

gulp.task('inject:index', function () {
    var target = gulp.src('src/index.html');

    var sources = gulp.src([
        'dist/prod/vendors.min.js',
        'dist/prod/app.min.js',
        'dist/prod/styles.min.css'
    ], { read: false });

    return target.pipe(plugins.inject(sources, { ignorePath: paths.prod, addRootSlash: false }))
        .pipe(gulp.dest(paths.prod));
});

gulp.task('inject:index:express', function () {
    var target = gulp.src('views/index.ejs');

    var sources = gulp.src([
        'vendors.min.js',
        'app.min.js',
        'styles.min.css'
    ], { read: false, cwd: __dirname + '/dist/express' });

    return target.pipe(plugins.inject(sources, {  ignorePath: paths.express, addRootSlash: false }))
        .pipe(gulp.dest(paths.views));
});


gulp.task('tsc', function () {
    return gulp.src(['src/**/*.ts'])
        .pipe(plugins.sourcemaps.init())
        .pipe(tsProject())
        .pipe(plugins.sourcemaps.write('/'))
        .pipe(gulp.dest(paths.dev))
        .pipe(plugins.connect.reload());
});

gulp.task('inline-ng2-templates', function () {
    return gulp.src(['src/**/*.ts'])
        .pipe(inlineNg2Template({ base: 'src', UseRelativePaths: true, indent: 0, removeLineBreaks: true, templateProcessor: minifyTemplate }))
        .pipe(tsProject())
        .pipe(gulp.dest(paths.tmp));
});

gulp.task('bundle:css', function() {
    return gulp.src(paths.css)
        .pipe(plugins.concat('styles.min.css'))
        .pipe(plugins.cleanCss())
        .pipe(gulp.dest(paths.prod));
});

gulp.task('bundle:css:express', function() {
    return gulp.src(paths.css)
        .pipe(plugins.concat('styles.min.css'))
        .pipe(plugins.cleanCss())
        .pipe(gulp.dest(paths.express));
});

gulp.task('bundle:vendors', function() {
    return gulp.src(paths.vendors)
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.concat('vendors.min.js'))
        .pipe(plugins.uglify())
        .pipe(plugins.sourcemaps.write('/'))
        .pipe(gulp.dest(paths.prod));
});

gulp.task('bundle:vendors:express', function() {
    return gulp.src(paths.vendors)
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.concat('vendors.min.js'))
        .pipe(plugins.uglify())
        .pipe(plugins.sourcemaps.write('/'))
        .pipe(gulp.dest(paths.express));
});

gulp.task('bundle:app', function() {
    var builder = new Builder(paths.tmp, paths.systemjsConfig);
    return builder.buildStatic('app/main.js', paths.prod + 'app.min.js', { minify: true, sourceMaps: true });
});

gulp.task('bundle:app:express', function() {
    var builder = new Builder(paths.tmp, paths.systemjsConfig);
    return builder.buildStatic('app/main.js', paths.express + 'app.min.js', { minify: true, sourceMaps: true });
});

gulp.task('copy:assets', function() {
    return gulp.src(paths.assets).pipe(gulp.dest(paths.dev)).pipe(plugins.connect.reload());;
});

gulp.task('copy:express', function() {
    return gulp.src(paths.server,{base:"./"}).pipe(gulp.dest(paths.express)).pipe(plugins.connect.reload());;
});

gulp.task('copy:index', function() {
    return gulp.src('src/index.html').pipe(gulp.dest(paths.prod));
});

gulp.task('clean:prod', function(done) {
    rimraf(paths.prod, done);
});

gulp.task('clean:dev', function(done) {
    rimraf(paths.dev, done);
});

gulp.task('clean:tmp', function(done) {
    rimraf(paths.tmp, done);
});

gulp.task('clean:express', function(done) {
    rimraf(paths.express, done);
});

gulp.task('build:prod', function(done) {
    runSequence('clean:prod', 'inline-ng2-templates', 'bundle:css', 'bundle:vendors', 'bundle:app', 'inject:index', 'clean:tmp', done);
});

gulp.task('build:express', function(done) {
    runSequence('clean:express', 'inline-ng2-templates', 'bundle:css:express', 'bundle:vendors:express', 'bundle:app:express', 'clean:tmp', 'copy:express', 'inject:index:express', done);
});


gulp.task('serve:prod', function(done) {
    runSequence('build:prod', ['connect:prod', 'watch'], done);
});

gulp.task('serve:express', function(done) {
    runSequence('build:express', ['connect:express', 'watch'], done);
});

gulp.task('build:dev', function(done) {
    runSequence('clean:dev', 'tsc', 'copy:assets', done);
});

gulp.task('serve:dev', function(done) {
    runSequence('build:dev', ['connect:dev', 'watch'], done);
});

gulp.task('connect:prod', function() {
    plugins.connect.server({
        root: paths.prod,
        port: 3000,
        livereload: true,
        fallback: paths.prod + '/index.html'
    });
});

gulp.task('connect:dev', function() {
    plugins.connect.server({
        root: [paths.dev, './'],
        port: 3000,
        livereload: true,
        fallback: paths.dev + '/index.html'
    });
});

gulp.task('connect:express', function() {
    plugins.connect.server({
        root: paths.express,
        port: 3000,
        livereload: true,
        fallback: paths.express + '/index.html'
    });
});


gulp.task("watch", function () {
    gulp.watch(['src/**/*.ts'], ['tsc']);
    gulp.watch(['src/**/*.html', 'src/**/*.css',  'src/**/*.js'], ['copy:assets']);
});
