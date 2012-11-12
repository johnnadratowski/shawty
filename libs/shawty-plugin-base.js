var sys = require('sys'),
    Server = require('http').Server,
    events = require('events'),
    url_mod = require('url'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    shawty_utils = require("./shawty-utils.js")

var ServerBase = exports.ServerBase = function(args){
    this.args = args;
    this.logger = args.logger;
    this.host = this.args.host;
    this.port = this.args.port;
    this.db_host = this.args.db_host;
    this.db_port = this.args.db_port;
    this.db_name = this.args.db_name;
    Server.call(this,function(req, res){
        server.handle_request(this, req, res)
    });
}

util.inherits(ServerBase, Server);

ServerBase.prototype.run_server = function(server){

    if (!server)
        server = this;

    // Entry point for starting the shortener server
    server.listen(server.port, server.host);

    server.logger.info(
            util.format('Shawty webserver started successfully @ %s:%s', 
                        server.host, 
                        server.port)
    );
}

ServerBase.prototype.handle_request = function(server, req, res){
    // Base method to handle requests
    try
    {
        server.logger.debug("Request recieved for URL: " + req.headers.host + req.url)

        var parsed = url_mod.parse(req.url, true);

        if (shawty_utils.url_query(parsed)) {
            // ?shorten= in query - get shortened URL
            server.logger.debug("URL in query - getting shorted URL.")

            var shorten = shawty_utils.get_shorten(req, parsed)

            server.logger.debug("URLs to shorten: " + shorten.toString())

            server.handle_shorten_request(server, req, res, parsed, shorten);

        } else {
            // There's no ?shorten= in the query. The client is
            // either requesting a short URL (in which case we
            // redirect to the long URL) or we respond without redirect
            server.logger.debug("No URL in query - Redirecting if short or handling other request.")

            server.emit('before_regular_request', server, req, res, parsed);

            server.handle_regular_request(server, req, res, parsed);

            server.emit('after_regular_request', server, req, res, parsed);
        }
    }
    catch(e)
    {
        debugger;
        
        if (e.action == 'kill') {
            server.logger.crit(
                    'Error occurred handling request. SERVER GOING DOWN. Error: ' + e.msg
                    + "\n\n Stacktrace: \n\n" + e.stack
            );
            process.exit()
        }
        else if (e.action == '404'){
            server.logger.warning(
                    'Error occurred handling request. Sending 404. Error: ' + e.msg
                    + "\n\n Stacktrace: \n\n" + e.stack
            );

            server.emit('before_404_response', server, req, res);

            shawty_utils.send_404(res);

            server.emit('after_404_response', server, req, res);
        }
        else if (e.action == '500'){
            server.logger.error(
                    'Error occurred handling request. Sending 500. Error: ' + e.msg
                    + "\n\n Stacktrace: \n\n" + e.stack
            );

            server.emit('before_500_response', server, req, res);

            shawty_utils.send_500(res, e.msg);

            server.emit('after_500_response', server, req, res);
        }
        else {
            server.logger.error(
                    'Unknown Error occurred handling request. Sending 500. Error: ' + e.toString()
                    + "\n\n Stacktrace: \n\n" + e.stack
            );

            server.emit('before_500_response', server, req, res);

            shawty_utils.send_500(res, e.msg);

            server.emit('after_500_response', server, req, res);
        }

    }
}

ServerBase.prototype.handle_shorten_request = function(server, req, res, parsed, shorten){
    // Handles all queries with ?shorten= in the get parameters
    throw new shawty_utils.ShawtyError("NotImplementedError", 
                                       "kill", 
                                       "handle_shorten_request must be overridden in plugin");
}

ServerBase.prototype.get_short_id = function(server, id, long_url){
    // Method to get the short ID for a NEW long URL
    return shawty_utils.base_encode(id);
}

ServerBase.prototype.build_short_url = function(server, req, short_id){
    // Method that takes a short id and builds the full short url from it

    if (req.headers.host) {
        var short_url =  'http://' + req.headers.host;
    }
    else {
        var short_url =  'http://' + server.host;
        if (server.port != 80)
            short_url += ":" + server.port
    }

    short_url += '/' + short_id
    return short_url
}

ServerBase.prototype.send_shorten_response = function(server, req, res, parsed, response_json){
    // Given a response JSON for a request to shorten URLs, this returns
    // the proper JSON response

    server.emit('before_shorten_response', server, req, res, parsed, response_json);

    shawty_utils.send_shorten_response(res, response_json);

    server.emit('after_shorten_response', server, req, res, parsed, response_json);
}

ServerBase.prototype.handle_regular_request = function(server, req, res, parsed){
    // Handles all queries WITHOUT ?shorten= in the get parameters

    // Remove the leading slash from the pathname.
    var short_id = parsed.pathname.replace(/^\//, '');

    if (parsed.pathname.substring(0,3) == '/t/') {
        // We're serving up a static file from the template_path

        server.logger.debug("Serving up a static file from the template directory");

        var template = path.resolve(server.args.template_path) + "/";
        template += parsed.pathname.slice(3);

        server.logger.debug("Attempting to open index page at path: " + template)

        server.emit('before_template_response', server, req, res, parsed);

        shawty_utils.send_html(server, res, template);

        server.emit('after_template_response', server, req, res, parsed);

        server.logger.debug("Template page returned to client. Template: " + template);
    }
    else if (short_id) { 

        if (short_id && shawty_utils.has_invalid_chars(short_id, shawty_utils.KEYSTR)){
            server.logger.debug("Short ID contains invalid characters. Returning 404.");
            shawty_utils.send_404(res, "Invalid Short URL Format");
            return;
        }

        server.logger.debug("Parsed Short ID: " + short_id)

        // The request is for a shortened URL
        server.handle_shortened_redirect(server, req, res, parsed, short_id);

    } else { 

        server.logger.debug("No short path for redirect. " + 
                            "Returning default response (usually index page)")

        // this request is for /
        if (server.args.index_page)
            server.handle_index_request(server, req, res, parsed);
        else
            server.handle_unknown_request(server, req, res, parsed, short_id);
    }
}

ServerBase.prototype.handle_index_request = function(server, req, res, parsed){
    // Handles requests to the index page

    var index_page = path.resolve(server.args.template_path) + "/";
    index_page += server.args.index_page;

    server.logger.debug("Attempting to open index page at path: " + index_page)

    server.emit('before_index_response', server, req, res, parsed);

    shawty_utils.send_html(server, res, index_page);

    server.emit('after_index_response', server, req, res, parsed);

    server.logger.debug("Index page returned to client")
}

ServerBase.prototype.handle_shortened_redirect = function(server, req, res, parsed, short_id){
    // Handes a request for a shortened url
    throw new shawty_utils.ShawtyError("NotImplementedError", 
                                       "kill", 
                                       "handle_shortened_redirect must be overridden in plugin");
}

ServerBase.prototype.redirect_to_long_url = function(server, req, res, parsed, short_id, long_url){
    // Redirects the user to the given long url
    
    server.emit('before_short_redirect_response', server, req, res, parsed, short_id, long_url);

    if (server.args.permanent_redirect)
        shawty_utils.send_301(res, long_url);
    else
        shawty_utils.send_302(res, long_url);

    server.emit('after_short_redirect_response', server, req, res, parsed, short_id, long_url);
}

ServerBase.prototype.handle_unknown_request = function(server, req, res, parsed, short_id){
    // Handles any requests to unknown paths

    server.emit('before_404_response', server, req, res);

    shawty_utils.send_404(res);

    server.emit('after_404_response', server, req, res);
}

