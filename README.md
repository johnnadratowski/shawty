# shawty

A URL shortener based on Node.JS with a pluggable backend architecture

## Requirements

[Node.js](http://nodejs.org)

## Usage

Start the server:

    $ node shawty.js

Shorten a URL by sending a request to http://localhost:8080?shorten=['http://example.com', 'http://foo.com']

The server will respond with a JSON response containing a JSON dictionary with the keys being 
the long urls and the values being the short URLS.
