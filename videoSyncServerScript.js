(function () {
    var videoSyncServerScriptUrl = Script.resolvePath("videoSyncServerScript.js");
    var sourceUrl = Script.resolvePath("videoSync.html");
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
    var lastUpdated = 0;
    var currentUserData;
    var checkCurrentUserDataTimeout;
    var checkCurrentUserDataTimeoutIsRunning = false;
    var gatewayUserData = {
        "useGatewayServer": false,
        "wsUrl": "",
        "serverConnected": false,
        "lastUpdated": 0
    };

    function openWebSocket() {
        var entityUserData = Entities.getEntityProperties(videoPlayerChannel, ["userData"]);
        var UserData = JSON.parse(entityUserData.userData);
        ws = new WebSocket(wsUrl);
        ws.onopen = function () {
            gatewayServerConnected = true;
            connectionAttempts = 0;
            UserData.serverConnected = true;
            lastUpdated = Date.now();
            UserData.lastUpdated = lastUpdated;
            currentUserData = UserData;
            updateUserData();
            var webSocketConnected = {
                "action": "webSocketConnected",
                "wsUrl": currentUserData.wsUrl
            };
            Messages.sendMessage(videoPlayerChannel, JSON.stringify(webSocketConnected));
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
            lastUpdated = Date.now();
            UserData.lastUpdated = lastUpdated;
            currentUserData = UserData;
            updateUserData();
            if (useGatewayServer) {
                Script.setTimeout(function () {
                    connectionAttempts++;
                    if (connectionAttempts >= 2) {
                        useGatewayServer = false;
                        lastUpdated = Date.now();
                        gatewayUserData = {
                            "useGatewayServer": false,
                            "wsUrl": "",
                            "serverConnected": false,
                            "lastUpdated": lastUpdated
                        };
                        currentUserData = gatewayUserData;
                        currentUserData.lastUpdated = lastUpdated;
                        updateUserData();
                    } else {
                        openWebSocket();
                    }
                }, 3000);
            }
        }
    }

    function updateUserData() {
        Entities.editEntity(videoPlayerChannel, {
            userData: JSON.stringify(currentUserData)
        });
        checkCurrentUserData();
    }

    function checkCurrentUserData() {
        if (checkCurrentUserDataTimeoutIsRunning) {
            clearTimeout(checkCurrentUserDataTimeout);
        }
        checkCurrentUserDataTimeout = Script.setTimeout(function () {
            var entityUserData = Entities.getEntityProperties(videoPlayerChannel, ["userData"]);
            var UserData = JSON.parse(entityUserData.userData);
            if (UserData.lastUpdated != lastUpdated) {
                console.log(currentUserData.lastUpdated + " " + lastUpdated);
                updateUserData();
            }
        }, 6000);
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
            if (!gatewayServerConnected) {
                gatewayUserData.wsUrl = "ws://" + messageData.gatewayIp + ":7080";
                gatewayUserData.useGatewayServer = true;
                currentUserData = gatewayUserData;
                updateUserData();
                useGatewayServer = true;
                wsUrl = "ws://" + messageData.gatewayIp + ":7080";
                connectionAttempts = 0;
                openWebSocket();
            }
        } else if (messageData.action == "reset") {
            var entity = Entities.getEntityProperties(videoPlayerChannel, ["position", "dimensions", "rotation", "locked", "script"]);
            var newVideoSync = Entities.addEntity({
                type: "Web",
                position: entity.position,
                rotation: entity.rotation,
                dimensions: entity.dimensions,
                script: entity.script,
                serverScripts: videoSyncServerScriptUrl,
                sourceUrl: sourceUrl,
                userData: JSON.stringify({
                    "useGatewayServer": false,
                    "wsUrl": "",
                    "serverConnected": false,
                    "lastUpdated": 0
                }),
                grab: {
                    "grabbable": false,
                }
            });
            if (entity.locked) {
                Entities.editEntity(videoPlayerChannel, {
                    locked: false
                });
                Script.setTimeout(function () {
                    Entities.editEntity(newVideoSync, {
                        locked: true
                    });
                    Entities.deleteEntity(videoPlayerChannel);
                }, 3000);
            } else {
                Entities.deleteEntity(videoPlayerChannel);
            }
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
