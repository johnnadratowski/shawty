var sys = require('sys'),
    http = require('http'),
    url_mod = require('url'),
    mongo = require('mongodb'),
    util = require('util'),
    shawty_utils = require("../libs/shawty-utils.js")
    ServerBase = require("../libs/shawty-plugin-base.js").ServerBase

var COLLECTION_NAME = 'shawty-mongo-collection'
var SHORT_ID_KEY = 'short-id'
var URL_KEY = 'url'
var COUNTER_KEY = 'shawty-counter'

var ShawtyServer = exports.ShawtyServer = function(args){

    ServerBase.call(this, args);

    if (args.plugin_options.general) {
        this.collection_name = args.plugin_options.collection_name || COLLECTION_NAME;

        if (args.plugin_options.general.log_request_info == undefined || 
            args.plugin_options.general.log_request_info)
            // If we are logging request information, set up the event
            this.on('after_short_redirect_response', this.log_short_request_info);
    }

    this.mongo_server = new mongo.Server(args.db_host, args.db_port, args.plugin_options.server);

    this.mongo_db = new mongo.Db(args.db_name, this.mongo_server, args.plugin_options.db);
}

util.inherits(ShawtyServer, ServerBase);

ShawtyServer.prototype.run_server = function(){

    server = this;

    server.logger.debug(util.format(
            'Connecting to Mongo DB %s @ %s:%s.', 
            server.args.db_name, server.args.db_host, server.args.db_port)
    );

    this.mongo_db.open(function(err, db){
        server.db_open_callback(server, err, db);
    });

}

ShawtyServer.prototype.db_open_callback = function (server, err, db) {
    // This callback occurs after Mongo DB connection is opened

    if (err) {
        var msg = util.format(
                'Error connecting to Mongo DB %s @ %s:%s. %s', 
                server.args.db_name, server.args.db_host, server.args.db_port, err        
        );
        server.logger.crit(msg);
        throw new shawty_utils.ShawtyError("DBOpenError", "kill", msg);
    }
    else {

        server.logger.debug(
            util.format(
                'Successfully opened Mongo DB %s @ %s:%s.', 
                server.args.db_name, server.args.db_host, server.args.db_port)
        );

        server.logger.debug(
            util.format(
                'Opening collection %s in Mongo DB %s @ %s:%s.', 
                server.collection_name, server.args.db_name, 
                server.args.db_host, server.args.db_port)
        );

        db.collection(server.collection_name, function(err, collection){
            server.db_open_collection(server, err, collection);
        });
    }
}

ShawtyServer.prototype.db_open_collection = function (server, err, collection) {
    // This callback occurs after the collection is retrieved from the DB.
    // A lot of the initialization for the server to work occurs here

    if (err) {
        // If there is an error getting the collection, log and kill server
        var msg = util.format(
                'Error getting collection "%s" from Mongo DB %s @ %s:%s. %s', 
                server.collection_name, server.args.db_name, 
                server.args.db_host, server.args.db_port, err
        );
        server.logger.crit(msg);
        throw new shawty_utils.ShawtyError("CollectionOpenError", "kill", msg);
    }

    server.logger.debug(
        util.format(
            'Collection "%s" retrieved from Mongo DB %s @ %s:%s.', 
            server.collection_name, server.args.db_name, 
            server.args.db_host, server.args.db_port)
    );

    // Add collection to server object to pass to functions
    server.collection = collection;

    server.logger.debug('Ensuring index on collection.');

    var index = {};
    index[SHORT_ID_KEY] = 1;
    index[URL_KEY] = 1;

    // Add indexes to the short url keys and long url keys
    collection.ensureIndex(index, {safe:true}, function(err, idx_name){

        if (err) {
            // Error ensuring index - log and kill server
            var msg = util.format(
                'Error ensuring index in collection "%s" in Mongo DB %s @ %s:%s. %s', 
                server.collection_name, server.args.db_name, 
                server.args.db_host, server.args.db_port, err
            );
            server.logger.crit(msg);
            throw new shawty_utils.ShawtyError("EnsureIndexError", "kill", msg);
        }

        server.logger.debug('Getting counter key for creating short URLs.');

        // Get the ID_KEY that we will use to store a counter of the shortened URLs
        collection.findOne({_id:COUNTER_KEY}, function(err, item){

            if (err) {
                // If there is an error, log and kill server
                var msg = util.format(
                    'Error getting URL COUNTER from key %s in collection ' +
                    '"%s" in Mongo DB %s @ %s:%s. %s', 
                    COUNTER_KEY, server.collection_name, server.args.db_name, 
                    server.args.db_host, server.args.db_port, err
                );
                server.logger.crit(msg);
                throw new shawty_utils.ShawtyError("GetShawtyCounterError", "kill", msg);
            }

            if (!item){
                // If no original counter key is created, create one
                
                server.logger.debug("Counter Key NOT created - Creating it now.");

                var doc = {_id:COUNTER_KEY, counter:0};
                server.collection.insert(doc, {safe:true}, function(err, result){
                    if (err) {
                        // If there was an error creating counter document, log and kill server
                        var msg = util.format(
                                'Error inserting new document for Shawty ID counter' +
                                'into collection "%s" ' + 
                                'in Mongo DB %s @ %s:%s. %s', 
                                server.collection_name, server.db_name, 
                                server.db_host, server.db_port, err)

                        server.logger.crit(msg);

                        throw new shawty_utils.ShawtyError("InsertShawtyCounterError", 
                                                            "kill", 
                                                            msg);
                    }

                    server.logger.debug("Counter key successfully created. Running server.");

                    ServerBase.prototype.run_server.call(this, server);
                });
            }

            else {
                // Counter key was already created - just run the server
                server.logger.debug("Counter Key already created - Running server.");
                ServerBase.prototype.run_server.call(this, server);
            }
        });
    });
}

ShawtyServer.prototype.handle_shorten_request = function(server, req, res, parsed, shorten){
    // Handles all queries with ?shorten= in the get parameters

    server.logger.debug("Getting all long urls in requested long url list from Mongo");

    var query = {};
    query[URL_KEY] = {$in:shorten};
    // Get all of the keys that match the URLS to shorten - if we already shortened them
    // they are just returned instead of creating duplicates
    server.collection.find(query).toArray(function(err, docs){
        if (err) {
            // if there is an error, log it and send a 500 error, then return
            server.logger.crit(
                util.format(
                    'Error getting short url from collection "%s" in Mongo DB %s @ %s:%s. %s', 
                    server.collection_name, server.db_name, 
                    server.db_host, server.db_port, err)
                );
            shawty_utils.send_500(res, err.toString());
            return;
        }

        server.logger.debug("Looping through all long urls and building response");

        var response_json = {};
        for (var idx in shorten){
            // Loop through all of the URLs to shorten, and get the corresponding
            // shortened URL to return to the client
            long_url = shorten[idx];
            short_id = server.get_url_short_id_from_doc(long_url, docs);

            // Check for whether there's a key for this URL.
            // This is so we don't store duplicates.
            if (!short_id) { 
                // This is a new URL. Build a short URL for it and add it to the response
                server.logger.debug("Short ID not found. " + 
                                    "Creating new short ID for URL: " + long_url);

                // Get the counter key and increment it. This is base 64 encoded to the short URL.
                server.collection.findAndModify({_id:COUNTER_KEY}, 
                                                [], 
                                                {$inc:{counter:1}}, 
                                                function(err, doc){
                    if (err) {
                        // if there is an error, log it and send a 500 error, then return
                        var msg = util.format(
                            'Error getting URL COUNTER from key %s in collection ' +
                            '"%s" in Mongo DB %s @ %s:%s. %s', 
                            COUNTER_KEY, server.collection_name, server.args.db_name, 
                            server.args.db_host, server.args.db_port, err
                        );
                        server.logger.crit(msg);
                        throw new shawty_utils.ShawtyError("GetShawtyCounterError", 
                                                            "500", 
                                                            msg);
                    }

                    counter = doc['counter'];
                    // Create new short id for this URL
                    short_id = server.get_short_id(server, counter, long_url);

                    new_doc = {};
                    new_doc[URL_KEY] = long_url;
                    new_doc[SHORT_ID_KEY] = short_id;

                    // Insert the new short url doc into Mongo
                    server.collection.insert(new_doc, {safe:true}, function(err, result){
                        if (err) {
                            // If there is an error inserting the doc, log and return 500
                            var msg = util.format(
                                'Error inserting document with long url %s ' +
                                'and short id %s into collection "%s" ' + 
                                'in Mongo DB %s @ %s:%s. %s', 
                                long_url, short_id, 
                                server.collection_name, server.db_name, 
                                server.db_host, server.db_port, err)
                            server.logger.crit(msg);
                            throw new shawty_utils.ShawtyError("InsertNewShortURLDocError", 
                                                                "500", 
                                                                msg);
                        }
                        server.logger.debug(
                            util.format(
                                'Successfully inserted document with long url %s ' +
                                'and short id %s into collection "%s" ' + 
                                'in Mongo DB %s @ %s:%s. %s', 
                                long_url, short_id, 
                                server.collection_name, server.db_name, 
                                server.db_host, server.db_port, err)
                            );

                        server.logger.debug("Short ID " + short_id + " created for URL: " + long_url);

                        server.send_shorten_response(server, req, res, parsed, 
                                                     response_json, long_url, short_id, shorten);
                    });

                });
            } 
            else {
                server.logger.debug("Short ID " + short_id + 
                                    " found. NOT creating short ID for URL: " + long_url);
                server.send_shorten_response(server, req, res, parsed, 
                                             response_json, long_url, short_id, shorten);
            }
        }
    });
}

ShawtyServer.prototype.get_url_short_id_from_doc = function(long_url, docs){
    // Given the response from a collection.find, gets the doc that contains the long_url
    // and returns the corresponding short id if found. If not found, returns undefined.
    for (var i in docs){
        item = docs[i];
        if (item[URL_KEY] == long_url){
            return item[SHORT_ID_KEY];
        }
    }
}

ShawtyServer.prototype.send_shorten_response = function(server, req, res, parsed, response_json, 
                                                        long_url, short_id, shorten){

    server.logger.debug("Adding long url " + long_url + 
                        " with short id " + short_id + " to response");

    response_json[long_url] = server.build_short_url(server, req, short_id); 

    for (var idx in shorten) {
        url = shorten[idx];
        if (!response_json[url])
            // If all of the URLs have not been added to the response, do not send response
            return;
    }

    server.logger.debug("All urls have been added to response. Sending to client.");

    // All URLs added to response - sending response
    ServerBase.prototype.send_shorten_response.call(this, server, req, res, parsed, response_json);
}

ShawtyServer.prototype.handle_shortened_redirect = function(server, req, res, parsed, short_id){
    // This will handle all calls that do not have the ?shorten= get query

    server.logger.debug("Getting long URL for Short ID: " + short_id);

    var query = {};
    query[SHORT_ID_KEY] = short_id;
    server.collection.findOne(query, function(err, doc){
        // Using the short ID to get the long URL

        if (err) {
            server.logger.crit(
                util.format(
                    'Error getting short url from collection "%s" in Mongo DB %s @ %s:%s. %s', 
                    server.collection_name, server.db_name, 
                    server.db_host, server.db_port, err)
                );
            shawty_utils.send_500(res, err.toString());
            return;
        }

        if (doc) { 
            // A corresponding long URL exists.

            long_url = doc[URL_KEY];
            server.logger.debug(
                util.format(
                    'Short ID %s FOUND in collection %s. Redirecting to %s.', 
                    short_id, server.collection_name, long_url)
                );

            server.redirect_to_long_url(server, req, res, parsed, short_id, long_url);
        } 

        else {

            server.logger.debug(
                util.format(
                    'Short ID %s NOT FOUND in collection %s.', 
                    short_id, server.collection_name)
                );

            server.handle_unknown_request(server, req, res, parsed, short_id);
        }
        
    });
}

ShawtyServer.prototype.log_short_request_info = function(server, req, res, parsed, 
                                                         short_id, long_url){
    // This callback will record all request information on a given request
    server.logger.debug("Entering callback to log all request information");

    // Log request collection name = collection name + "_request_log"
    var log_collection = server.collection_name + "_request_log";

    server.mongo_db.collection(log_collection, function(err, collection){
        // Get the collection we're using to log requests
        if (err) {
            // If there is an error getting the collection, log and return
            var msg = util.format(
                    'Error getting request log collection "%s" from Mongo DB %s @ %s:%s. %s', 
                    log_collection, server.args.db_name, 
                    server.args.db_host, server.args.db_port, err
            );
            server.logger.error(msg);
            return;
        }

        server.logger.debug(
            util.format(
                'Request log collection "%s" retrieved from Mongo DB %s @ %s:%s.', 
                log_collection, server.args.db_name, 
                server.args.db_host, server.args.db_port)
        );

        var ip = req.headers['x-forwarded-for'];
        if (ip) {
            ip = ip.split(',')[0].trim();
        }
        else{
            ip = req.connection.remoteAddress;
        }

        doc = {'user-agent': req.headers['user-agent'],
               'language': req.headers['accept-language'],
               'requested_url': req.url,
               'redirected_url': long_url,
               'referer': req.headers['referer'],
               'ip': ip,
               'date': Date().toString()};

        collection.insert(doc, function(err, item){
            if (err) {
                // If there is an error saving the item, log and return
                var msg = util.format(
                        'Error saving request log in collection "%s" in Mongo DB %s @ %s:%s. %s', 
                        log_collection, server.args.db_name, 
                        server.args.db_host, server.args.db_port, err
                );
                server.logger.error(msg);
                return;
            }

            server.logger.debug(
                util.format(
                    'Request log saved to collection "%s" in Mongo DB %s @ %s:%s.', 
                    log_collection, server.args.db_name, 
                    server.args.db_host, server.args.db_port)
            );
        });
    });

    server.logger.debug("Leaving callback to log all request information");
}

