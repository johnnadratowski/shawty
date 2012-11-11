var util = require('util'),
    fs = require('fs');

var KEYSTR = exports.KEYSTR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

var ShawtyError = exports.ShawtyError = function(name, action, msg){
    this.name = name;
    this.action = action;
    this.msg = msg;
}
ShawtyError.prototype = new Error();

// Check whether a URL is in the request URI's querystring.
var url_query = exports.url_query = function(parsed) {
    if ('query' in parsed) {
        if ('shorten' in parsed.query) {
            return true;
        }
    }
    return false;
}

// Sends a 200 ok response giving the host and shorted location
var send_200 = exports.send_200 = function(res, header, body){
    res.writeHeader(200, header);
    res.write(body);
    res.end();
}

var send_html = exports.send_html = function(server, res, file){
    fs.readFile(file, function (err, body) {
        if (err) {
            var msg = 'Error opening template in path ' + file + '. Exception: ' + err.toString();
            server.logger.crit(msg);
            throw new ShawtyError("TemplateNotFoundError", "404", msg);
        }       
        send_200(res, {'Content-Type': 'text/html'}, body);
    });
}

// Sends a 301 redirect to the specified location
var send_301 = exports.send_301 = function(res, loc){
    res.writeHeader(301, {'Location': loc}); // Redirect to the long URL.
    res.end();
}

// Sends a 302 redirect to the specified location
var send_302 = exports.send_302 = function(res, loc){
    res.writeHeader(302, {'Location': loc}); // Redirect to the long URL.
    res.end();
}

// Sends a 404 response
var send_404 = exports.send_404 = function(res, msg) {
    res.writeHeader(404, msg);
    res.end();
}

// Sends a 500 response
var send_500 = exports.send_500 = function(res, err) { 
    res.writeHeader(500, err);
    res.end();
}

var send_shorten_response = exports.send_shorten_response = function(res, json_response){
    res.writeHeader(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(json_response));
    res.end();
}

var has_invalid_chars = exports.has_invalid_chars = function(str, valid_chars){
    // checks to ensure all characters in str are specified in the list of valid_chars
    for (i=0; i<str.length; i++){
        if ( valid_chars.indexOf(str[i]) == -1 )
            return true;
    }
    return false;
}

// Gets the url from the parsed url string
var get_shorten = exports.get_shorten = function(req, parsed){
    var shorten_urls = parsed.query.shorten;

    try
    {
        try
        {
            var json_urls = JSON.parse(shorten_urls);
        }
        catch(e)
        {
            var json_urls = [shorten_urls]
        }

        for (i=0; i<json_urls.length; i++)
        {
            var url = json_urls[i]
            // If the URL doesn't start with http, add it.
            if (url.search(/^http/) == -1) {
                url = 'http://' + url;
                json_urls[i] = url;
            }
        }
    }
    catch(e)
    {
        throw new ShawtyError("ShortenParsingError", 
                              "500", 
                              "Could not parse short url string: " + shorten_urls)
    }

    return json_urls
}

var base_encode = exports.base_encode = function(input){
    // Returns a base 64 encoded string. However, instead of using the
    // standard last two characters for base 64 encoding, it replaces 
    // (/, +) with (-, _) respectively. This is to have proper URLs.
    // Also, any equals signs are removed, as they are just padding for base64 encodings
    var encoded = new Buffer(input.toString()).toString('base64');
    return encoded.replace(/\//g, "-").replace(/\+/g, "_").replace(/=/g, "")
}

/*
 * Adapted from http://www.webtoolkit.info/javascript-base64.html
 *
 * Encode a string as Base n, where n = KEYSTR.length
 */
var old_base_encode = exports.old_base_encode = function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & (KEYSTR.length-1);

        if (isNaN(chr2)) {
            enc3 = enc4 = KEYSTR.length;
        } else if (isNaN(chr3)) {
            enc4 = KEYSTR.length;
        }

        output = output +
        KEYSTR.charAt(enc1) + KEYSTR.charAt(enc2) +
        KEYSTR.charAt(enc3) + KEYSTR.charAt(enc4);
    }

    return output;
}

