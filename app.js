'use strict';

var databaseUrl = "mydb";
var collections = ["links"];
var db = require("mongojs").connect(databaseUrl, collections);
var http = require('http');
var util = require('util');
var url = require('url');
var querystring=require('querystring');
var forms = require('forms'),
    fields = forms.fields,
    validators = forms.validators;

// GLOBAL DB KEYS
var SHORT_KEY = 'short';
var LONG_KEY = 'long';

http.createServer(function (req, res) {
    switch(req.method) {
        case 'GET': handleGET(req, res); break;
        case 'POST': handlePOST(req, res); break;
        default:
        sendErrorResponse(res);
    }
}).listen(8080, '127.0.0.1');
console.log('Server running at http://127.0.0.1:8080/');

function handleGET(req, res) {
    switch(req.url) {
        case '/': index(req, res); break;
        default: {
            if (validPath(req.url)) {
                handleValidPaths(req, res);
            } else {
                sendErrorResponse(res);
            }
        }
    }
}

function index(req, res) {
    var create_form = forms.create({
        long: fields.string({required: true, label: 'Enter a long URL to shorten:'}),
        short: fields.string({required: true, label: 'Custom url:'}) 
    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<h1>Shorten Long Url</h1>');
    res.end(
        '<form action="/create" method="post">' + 
        create_form.toHTML() +
        '<input type="submit" value="Shorten"/>' +
        '</form>');
}

function handlePOST(req, res) {
    console.log("Received Post");
    var body = "";
    req.on('data', function(data) {
        body += data;
    });
    req.on('end', function() {
        console.log(util.inspect(querystring.parse(body)));
        var params = querystring.parse(body);
        var longUrl = params.long;
        var shortKey = params.short;
        db.links.findOne(buildSearchParams(shortKey), function(err, link) {
            debug("err", err);
            debug("link", link);
            if (!err && link && link[LONG_KEY]) {
                console.log("send error");
                sendErrorResponse(res, "Custom url /\"" + shortKey + "\" already exists.");
            } else {
                console.log("short url not taken: " + shortKey);
                db.links.save(params, function(err, saved) {
                    if( err || !saved ) {
                        console.log("error saving");
                        sendErrorResponse(res, "Error has occured. Please try again.");
                    } else {
                        res.writeHead(200, {'Content-Type': 'text/html'});
                        res.write('<h1>Shorten URL Created!</h1>');
                        res.write('<b>/' + shortKey + '</b> now takes you to <b>' + longUrl + '</b>');
                        res.end();
                    }
                });
            }
        });
    })
    // debug('long', req.body.long);
    // debug('short', req.body.short);
}

function handleValidPaths(req, res) {
    console.log('Received Get');

    var pathUrl = req.url;
    console.log('Get Pathname: ' + pathUrl);

    var shortKey = getShortKey(pathUrl);
    console.log('ShortKey: ' + shortKey);

    db.links.findOne(buildSearchParams(shortKey), function(err, link) {
        debug("err", err);
        debug("link", link);
        if (!err && link && link[LONG_KEY]) {
            console.log("FORWARD: " + link[LONG_KEY]);
            send302Response(res, link[LONG_KEY]);
        } else {
            console.log("send error");
            sendErrorResponse(res, "No url associated with /\"" + shortKey + "\"");
        }
    });
}

function validPath(pathName) {
    var regex = /^\/\w+$/;
    return regex.test(pathName);
}

function getShortKey(pathUrl) {
    var parsedUrl = url.parse(pathUrl);
    console.log(parsedUrl);
    return parsedUrl.pathname.substring(1);
}

function buildSearchParams(shortKey) {
    var params = {};
    params[SHORT_KEY] = shortKey;
    return params;
}

function send302Response(res, forwardUrl) {
    res.writeHead(302, {'Location': forwardUrl});
    res.end();
    return res;
}

function sendErrorResponse(res, msg) {
    res.writeHead(400,  {'Content-Type': 'text/plain'});
    if (msg)
        res.end('Error: ' + msg);
    else
        res.end('Error');
}

function debug(name, value) {
    if (value != null && value != undefined) {
        console.log(name + ": " + value);
    } else {
        console.log(name + ": undefined");
    }
}