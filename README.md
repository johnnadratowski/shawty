# shawty

A URL shortener based on Node.JS with a pluggable backend architecture

## Requirements

[Node.js](http://nodejs.org)

[Node MongoDB](https://github.com/christkv/node-mongodb-native)

[Winston](https://github.com/indexzero/winston-mongodb)

[argparse](https://github.com/nodeca/argparse)

I included all of the requirements in the node modules folder, but these could be 
removed at a later date to ensure the most up-to-date sources.

## Usage

Start the server:

    $ node shawty.js

The server will start by default on 127.0.0.1:80.

Shorten a URL by sending a request to http://127.0.0.1?shorten=(urls-to-shorten)
where urls-to-shorten is a JSON list containing the urls that you wan to shorten

The server will respond with a JSON response containing a JSON dictionary with the keys being 
the long urls and the values being the short URLS.

## Plugins

Shawty supports a pluggable architecture to use for the DB backend.  Out of the box it comes 
with support for both MongoDB and local memory backends, however, the default configurations are
based on the Mongo architecture.  The plugins are stored in the ./plugins/ folder, but they can
reside anywhere.  You can specify the plugin to use with the -P option, supplying a path to
the plugin.

The plugin itself should export an object named ShawtyServer, which should contain a run\_server
method and take the args passed into the application. To help with the implementation, a base
server prototype has been provided in ./libs/shawty-plugin-base.js.  You can implement the 
ServerBase prototype to implement your backend.  The plugins provided should be a fairly 
straightforward documentation of how to do so.

## Extra Notes

I know this documentation is fairly sparse at this point, hopefully I can come back and
document more when I have time.  However, please feel free to post any questions or email me 
at john@unifiedsocial.com.

This was originally forked from [little](https://github.com/bycoffe/little), but has been pretty
much completely re-written.  However, I still think the original project should be recognized,
and I'm sure there are some places in the code where the original code is present.

