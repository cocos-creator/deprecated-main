/**
 * Simple express app to run user build app
 * Created by nantas on 15/3/13.
 */

var express = require('express');
var app = express();
app.use(express.static('public'));
var server = app.listen(3000, function () {
    console.log('build app running at http://localhost:3000');
});
