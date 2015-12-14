var gulp = require('gulp');
var shell = require('gulp-shell');

gulp.task('docs', shell.task([
    './node_modules/jsdoc/jsdoc.js '+
    '-c ./node_modules/ink-docstrap/template/jsdoc.conf.json '+   // config file
    '-t ./node_modules/ink-docstrap/template '+   // template file
    '-d ./jsdoc_build/docs '+                           // output directory
    ' README.md ' +                            // to include README.md as index contents
    './'  //+                 // source code directory
    // '-u tutorials'                              // tutorials directory
]));

