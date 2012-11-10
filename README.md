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

Shorten a URL by sending a request to http://localhost:8080?shorten=['http://example.com', 'http://foo.com']

The server will respond with a JSON response containing a JSON dictionary with the keys being 
the long urls and the values being the short URLS.
