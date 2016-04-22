var debug = process.env.debug;
var token = process.env.token;
var mjmlEndpoint = process.env.mjmlEndpoint;

if (!token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}
if (!mjmlEndpoint) {
    console.log('Error: Specify mjmlEndpoint in environment');
    process.exit(1);
}
if (!debug) {
    debug = false;
}

var http = require('http');
var Botkit = require('botkit');
var Url = require('url');
var request = require('request');
var os = require('os');

var controller = Botkit.slackbot({
    debug: debug,
});

var bot = controller.spawn({
    token: token
}).startRTM();


// We need a function which handles requests and send response
function handleRequest(request, response) {
    response.end('MJML Slack Bot is online!');
}
// Create a server
var server = http.createServer(handleRequest);
// Lets start our server
var PORT = process.env.PORT || 5000;
server.listen(PORT, function() {
    console.log("Server listening on: http://localhost:%s", PORT);
});

controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message, 'Send me an gist containing MJML markup and I\'ll render it.');
    bot.reply(message, 'Send me code sample with ``` and will do the same.');
});

var mjml = '<mj-body>\
  <mj-section>\
    <mj-column>\
      <mj-image width="100" src="https://mjml.io/assets/img/logo-small.png"></mj-image>\
      <mj-divider border-color="#F45E43"></mj-divider>\
      <mj-text font-size="20px" color="#F45E43" font-family="helvetica">Hello World</mj-text>\
    </mj-column>\
  </mj-section>\
</mj-body>';

controller.hears(['sample'], 'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message, 'Here\'s a sample for you:');
    bot.reply(message, mjml);
});

controller.hears(['//gist.github.com/(.*)/(.*)>', '//mjml.io/(.*)/(.*)>'], 'direct_message,direct_mention,mention', function(bot, message) {

    var Gisty = require('gisty');
    var emails = [];
    getRecipients(message, function(err, response) {
        emails = [
            response.user.profile.email
        ];
    });

    var user = message.match[1];
    var gistId = message.match[2];
    // bot.botkit.debug(message.match, user, gistId);

    // Parse MJML.io urls
    if ('try-it-live' == user) {
        user = 'mjml-tryitlive';
    }

    var gist = new Gisty({
        username: user
    });

    gist.fetch(gistId, function(error, gist) {
        if (error) {
            bot.reply(message, 'Did not get that..');
            return;
        }

        bot.reply(message, 'Here\'s a list of the files:');
        for (filename in gist.files) {
            var gistContent = gist.files[filename].content;

            // renderMjml(gistContent, function(err, httpResponse, body) {
            //     bot.reply(message, '```' + body.html.substring(0,99) + '...' + '```');
            // });

            sendMjml(gistContent, emails, function(err, httpResponse, body) {
                bot.reply(message, 'The rendered MJML from file: *' + filename + '* will be sent to: ' + emails.join());
            });
        }
    });
});


controller.hears(['```'], 'direct_message,direct_mention,mention', function(bot, message) {

    // TODO replace only first and last chars.
    var mjmlContent = message.text.replace('```', '');

    var emails = [];
    getRecipients(message, function(err, response) {
        emails = [
            response.user.profile.email
        ];
    });

    sendMjml(mjmlContent, emails, function(err, httpResponse, body) {
        bot.reply(message, 'The rendered MJML from file: *' + filename + '* will be sent to: ' + emails.join());
    });
    // renderMjml(mjmlContent, function(err, httpResponse, body) {
    //     bot.reply(message, '```' + body.html.substring(0, 99) + '...' + '```');
    // });
});

var fetchFromGist = function(gistUrl, callback) {

    request.get({
        url: gistUrl
    }, callback);
}

var renderMjml = function(mjml, callback) {
    request.post({
        url: mjmlEndpoint + '/render',
        json: {
            mjml: mjml
        }
    }, callback);
}

var sendMjml = function(mjml, recipients, callback) {
    request.post({
        url: mjmlEndpoint + '/render-send-email',
        json: {
            mjml: mjml,
            recipients: recipients
        }
    }, callback);
}

var getRecipients = function(message, callback) {
    bot.api.users.info({
        user: message.user
    }, callback);
}