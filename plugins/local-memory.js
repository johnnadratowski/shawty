var sys = require('sys'),
    http = require('http'),
    events = require('events'),
    url_mod = require('url'),
    util = require('util'),
    shawty_utils = require("../libs/shawty-utils.js")
    ServerBase = require("../libs/shawty-plugin-base.js").ServerBase

var ShawtyServer = exports.ShawtyServer = function(args){
    ServerBase.call(this, args);
}

util.inherits(ShawtyServer, ServerBase);

ShawtyServer.prototype.run_server = function(){

    this.short_keys = {}
    this.long_keys = {}

    ServerBase.prototype.run_server.call(this);
}

ShawtyServer.prototype.handle_shorten_request = function(server, req, res, parsed, shorten){
    // Handles all queries with ?shorten= in the get parameters

    response_json = {}
    for (var idx in shorten) {

        long_url = shorten[idx];

        // Check for whether there's a key for this URL.
        // This is so we don't store duplicates.
        short_id = server.long_keys[long_url];
        if (!short_id) {

            server.logger.debug("Short ID not found. Creating new short ID for URL: " + long_url);

            // This is a new URL.
            count = Object.keys(server.short_keys).length + 1;
            short_id = server.get_short_id(server, count, long_url);
            server.long_keys[long_url] = short_id;
            server.short_keys[short_id] = long_url;

            server.logger.debug("Short ID " + short_id + " created for URL: " + long_url);
        }
        else {
            server.logger.debug("Short ID " + short_id + 
                                " found. NOT creating short ID for URL: " + long_url);
        }

        response_json[long_url] = server.build_short_url(server, short_id);
    }

    server.send_shorten_response(server, req, res, parsed, response_json);
}

ShawtyServer.prototype.handle_shortened_redirect = function(server, req, res, parsed, short_id){
    // This will handle all calls that do not have the ?shorten= get query

    long_url = server.short_keys[short_id]
    if (long_url) { 
        server.logger.debug(
            util.format(
                'Short ID %s FOUND. Redirecting to %s', 
                short_id, long_url)
            );

        // A corresponding long URL exists.
        server.redirect_to_long_url(server, req, res, parsed, short_id, long_url);
    } 

    else {

        server.logger.debug(util.format( 'Short ID %s NOT FOUND', short_id));
        
        server.handle_unknown_request(server, req, res, parsed, short_id);
    }
    
}
