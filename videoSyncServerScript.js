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
    var videoPlayerChannel;
    var wsUrl;
    var ws;
    var useGatewayServer = false;
    var gatewayServerConnected = false;
    var connectionAttempts = 0;
    var gatewayUserData = {
        "useGatewayServer": false,
        "wsUrl": "",
        "serverConnected": false,
    };

    function openWebSocket() {
        var entityUserData = Entities.getEntityProperties(videoPlayerChannel, ["userData"]);
        var UserData = JSON.parse(entityUserData.userData);
        ws = new WebSocket(wsUrl);
        ws.onopen = function () {
            gatewayServerConnected = true;
            connectionAttempts = 0;
            UserData.serverConnected = true;
            Entities.editEntity(videoPlayerChannel, {
                userData: JSON.stringify(UserData)
            });
        }
        ws.onmessage = function (evt) {
            var wsMessageData = JSON.parse(evt.data);
            if (wsMessageData.action == "requestSync") {
                var readyEvent = {
                    action: "sync",
                    timeStamp: timeStamp,
                    videoUrl: videoUrl,
                    nowVideo: "false",
                    videoPlaying: intervalIsRunning,
                    myTimeStamp: wsMessageData.myTimeStamp
                };
                ws.send(JSON.stringify(readyEvent));
            }
        }
        ws.onclose = function () {
            gatewayServerConnected = false;
            UserData.serverConnected = false;
            Entities.editEntity(videoPlayerChannel, {
                userData: JSON.stringify(UserData)
            });
            if (useGatewayServer) {
                Script.setTimeout(function () {
                    connectionAttempts++;
                    openWebSocket();
                    if (connectionAttempts >= 5) {
                        useGatewayServer = false;
                        gatewayUserData = {
                            "useGatewayServer": false,
                            "wsUrl": "",
                            "serverConnected": false,
                        };
                        Script.setTimeout(function () {
                            Entities.editEntity(videoPlayerChannel, {
                                userData: JSON.stringify(gatewayUserData)
                            });
                        }, 6000);
                    }
                }, 1000);
            }
        }
    }

    this.preload = function (entityID) {
        var entityUserData = Entities.getEntityProperties(entityID, ["userData"]);
        var UserData = JSON.parse(entityUserData.userData);
        wsUrl = UserData.wsUrl;
        videoPlayerChannel = entityID;
        Messages.subscribe(videoPlayerChannel);
        if (UserData.useGatewayServer) {
            useGatewayServer = true;
            openWebSocket();
        }
    };

    function onMessageReceived(channel, message, sender, localOnly) {
        if (channel != videoPlayerChannel) {
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
            var wsNow = {
                "action": "now",
                "videoUrl": messageData.videoUrl,
                "timeStamp": messageData.timeStamp
            };
            if (useGatewayServer && gatewayServerConnected) {
                ws.send(JSON.stringify(wsNow));
            }
        } else if (messageData.action == "play") {
            timeStamp = messageData.timeStamp;
            if (intervalIsRunning) {
                Script.clearInterval(timeStampInterval);
            }
            intervalIsRunning = true;
            videoPlaying = true;
            ping();
            var wsPlay = {
                "action": "play",
                "timeStamp": messageData.timeStamp
            };
            if (useGatewayServer && gatewayServerConnected) {
                ws.send(JSON.stringify(wsPlay));
            }
        } else if (messageData.action == "pause") {
            Script.clearInterval(timeStampInterval);
            intervalIsRunning = false;
            var wsPause = {
                "action": "pause",
                "timeStamp": messageData.timeStamp
            };
            if (useGatewayServer && gatewayServerConnected) {
                ws.send(JSON.stringify(wsPause));
            }
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
                Messages.sendMessage(videoPlayerChannel, message);
            }, 600);
        } else if (messageData.action == "videoSyncGateway") {
            gatewayUserData.wsUrl = "ws://" + messageData.gatewayIp + ":7080";
            gatewayUserData.useGatewayServer = true;
            Entities.editEntity(videoPlayerChannel, {
                userData: JSON.stringify(gatewayUserData)
            });
            useGatewayServer = true;
            wsUrl = "ws://" + messageData.gatewayIp + ":7080";
            connectionAttempts = 0;
            openWebSocket();
        }
    }

    function ping() {
        timeStampInterval = Script.setInterval(function () {
            timeStamp = timeStamp + 1;
            pingTimer = pingTimer + 1;
            if (timeStamp > videoLength) {
                Script.clearInterval(timeStampInterval);
                videoUrl = "";
                videoPlaying = false;
                intervalIsRunning = false;
                var readyEvent = {
                    action: "videoEnd"
                };
                var message = JSON.stringify(readyEvent);
                Messages.sendMessage(videoPlayerChannel, message);
            }
            if (pingTimer == 60) {
                pingTimer = 0;
                messageData.timeStamp = timeStamp;
                messageData.action = "ping";
                var message = JSON.stringify(messageData);
                Messages.sendMessage(videoPlayerChannel, message);
                if (useGatewayServer && gatewayServerConnected) {
                    ws.send(message);
                }
            }
        }, 1000);
    }

    Messages.messageReceived.connect(onMessageReceived);

    this.unload = function () {
        Messages.unsubscribe(videoPlayerChannel);
        Messages.messageReceived.disconnect(onMessageReceived);
        if (intervalIsRunning) {
            Script.clearInterval(timeStampInterval);
        }
    }
});
