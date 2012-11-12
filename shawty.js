#!/usr/bin/env node

var winston = require('winston'),
    fs = require('fs'),
    util = require('util');

var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
      version: '0.1',
      addHelp:true,
      description: 'Pluggable URL Shortener using optional pluggable DB backend and Node.js'
});

parser.addArgument([ '-l', '--log-level' ], 
        {help: 'Set the logger log level.',
         defaultValue: 'info',
         type:'string'});

parser.addArgument([ '-f', '--logfilepath' ], 
        {help: 'The log file path to use.',
         defaultValue: '/var/log/shwaty/',
         type: 'string'});

parser.addArgument([ '-s', '--host' ], 
        {help: 'The host name to run the HTTP server under.',
         defaultValue: '127.0.0.1',
         type: 'string'});

parser.addArgument([ '-p', '--port' ], 
        {help: 'The port to run the HTTP server under.',
         defaultValue: 80,
         type: 'int'});

parser.addArgument([ '-t', '--db-host' ], 
        {help: 'The host IP of the machine hosting the database.',
         defaultValue: '127.0.0.1',
         type: 'string'});

parser.addArgument([ '-r', '--db-port' ], 
        {help: 'The port the database is running under.',
         defaultValue: 27017,
         type: 'int'});

parser.addArgument([ '-n', '--db-name' ], 
        {help: 'The name of the database instance to connect to.',
         defaultValue: 'default',
         type: 'string'});

parser.addArgument([ '-o', '--plugin-options' ], 
        {help: 'Extra options for the plugin you are using. '+
               'Should be in proper JSON strng format.',
         defaultValue: '{"server": {"auto_reconnect":true},' +
                       ' "general": {"collection_name":"mongo-shawty-collection"},' +
                       ' "db": {"safe":true}}',
         type: 'string'});

parser.addArgument([ '-P', '--plugin-file' ], 
        {help: 'The plugin file to use to run the server.',
         defaultValue: "./plugins/mongodb.js",
         type: 'string'});

parser.addArgument([ '-T', '--template-path' ], 
        {help: 'The path to use to find templates',
         defaultValue: "./templates/",
         type: 'string'});

parser.addArgument([ '-i', '--index-page' ], 
        {help: 'The page to return for the index page. '+
               'Should be in path specified by --template-path. '+
               'If not specified, returns 404.',
         defaultValue: undefined,
         type: 'string'});

parser.addArgument([ '-R', '--permanent-redirect' ], 
        {action: 'storeTrue',
         help: 'Specify this to use permanent redirects instead of temporary',
         defaultValue: false,
         type: 'string'});

parser.addArgument([ '-d', '--trusted-domains' ], 
        {help: 'A comma-delimited strign containing all trusted domains that can make AJAX calls.',
         defaultValue: '',
         type: 'string'});

var args = parser.parseArgs();

args.plugin_options = JSON.parse(args.plugin_options);

function setup_logger(args){
    transports = [new (winston.transports.Console)({ level: args.log_level })]
    if (args.logfile)
    {
        if (!fs.exists(args.logfilepath))
        {
            fs.mkdir(args.logfilepath);
        }

        transports.push(new (winston.transports.File)({
            filename: args.logfilepath + "shawty.log", 
            maxsize: 9999999, 
            maxFiles: 10,
            level: args.log_level
        }));
    }
    var logger = new (winston.Logger)({ transports: transports });

    // Fixes the insane default log levels in winston
    logger.setLevels(winston.config.syslog.levels);

    return logger;
}

args.logger = setup_logger(args)

args.logger.info(util.format("Starting Shawty webserver @ %s:%s", args.host, args.port))

var ShawtyServer = require(args.plugin_file).ShawtyServer
server = new ShawtyServer(args)
server.run_server()


