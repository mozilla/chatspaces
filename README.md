# Chatspaces

## What this is

Chatspaces is a private chat app for sending messages to your contacts. It currently requires Persona for authentication.

## Project Information

### Current development stage

* Adding in v.1 features and design/interface iterations for MWC (Mobile World Congress)

### Features for v.1 (No new features will be added/discussed until post-MWC)

* Search for, add, remove and block users from your contacts list
* Ability to send animated GIFs and static images with messages via WebRTC
* Websocket and SimplePush notification support of unread/new messages
* The ability to send a message to multiple contacts via broadcasting

### Features that may be considered/discussed for post-MWC

* Encryption of messages
* Adding contacts from your phonebook
* Cordova integration
* Authenticating through third-party services like Facebook/Twitter
* Integration with Firefox Accounts
* Integration with Presence
* Third-party developer API support

### Filing bugs

* Bugs should be filed only for v.1 features for now on [https://github.com/mozilla/chatspaces/issues?state=open](https://github.com/mozilla/chatspaces/issues?state=open)

### On IRC

* Please contact us on [irc://irc.mozilla.org/apps](irc://irc.mozilla.org/apps)
* For main project questions talk to ednapiranha
* For image generation (GIFs, static JPG), local caching questions talk to sole
* For UX/UI/design questions talk to mhanratty or tsmuse
* For anything else, talk to ednapiranha or wenzel

### Via email

Email me at [jfong@mozilla.com](mailto:jfong@mozilla.com)

Thanks!

## Supported browsers

* Firefox
* Chrome

## Installation instructions

Clone the repository

    > git clone git://github.com/mozilla/chatspaces.git

Install node by using brew or through the website http://nodejs.org/#download

Install redis via brew and make sure the server is running

    > npm -g install nodemon bower
    > cd chatspaces
    > npm install
    > bower install
    > cp local.json-dist local.json
    > npm start

Open your browser at the following URL [http://localhost:3000](http://localhost:3000)
