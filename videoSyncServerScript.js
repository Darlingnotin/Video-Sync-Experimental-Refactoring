(function () {
    var timeStamp;
    var messageData;
    var pingTimer = 0;
    var intervalIsRunning = false;
    var videoUrl = "";
    var timeStampInterval;
    var thisTimeout;
    var videoLength;
    var videoPlaying = false;
    var newVideoSent = false;
    var newVideoSender;

    function onMessageReceived(channel, message, sender, localOnly) {
        if (channel != "videoPlayOnEntity") {
            return;
        }
        messageData = JSON.parse(message);
        if (messageData.action == "now") {
            videoPlaying = true;
            newVideoSent = true;
            newVideoSender = messageData.myTimeStamp;
            timeStamp = messageData.timeStamp;
            videoUrl = messageData.videoUrl;
            videoLength = messageData.length;
            if (intervalIsRunning) {
                Script.clearInterval(timeStampInterval);
            }
            intervalIsRunning = true;
            ping();
        } else if (messageData.action == "play") {
            timeStamp = messageData.timeStamp;
            if (intervalIsRunning) {
                Script.clearInterval(timeStampInterval);
            }
            intervalIsRunning = true;
            videoPlaying = true;
            ping();
        } else if (messageData.action == "pause") {
            Script.clearInterval(timeStampInterval);
            intervalIsRunning = false;
        } else if (messageData.action == "sync") {
            timeStamp = messageData.timeStamp;
        } else if (messageData.action == "requestSync") {
            Script.setTimeout(function () {
                var readyEvent = {
                    action: "sync",
                    timeStamp: timeStamp,
                    videoUrl: videoUrl,
                    nowVideo: "false",
                    videoPlaying: intervalIsRunning,
                    myTimeStamp: messageData.myTimeStamp
                };
                var message = JSON.stringify(readyEvent);
                Messages.sendMessage("videoPlayOnEntity", message);
            }, 600);
        }
    }

    function ping() {
        timeStampInterval = Script.setInterval(function () {
            timeStamp = timeStamp + 1;
            pingTimer = pingTimer + 1;
            if (pingTimer == 60) {
                pingTimer = 0;
                messageData.timeStamp = timeStamp;
                messageData.action = "ping";
                var message = JSON.stringify(messageData);
                Messages.sendMessage("videoPlayOnEntity", message);
            }
        }, 1000);
    }

    Messages.subscribe("videoPlayOnEntity");
    Messages.messageReceived.connect(onMessageReceived);

    this.unload = function () {
        Messages.unsubscribe("videoPlayOnEntity");
        Messages.messageReceived.disconnect(onMessageReceived);
        if (intervalIsRunning) {
            Script.clearInterval(timeStampInterval);
        }
    }
});
