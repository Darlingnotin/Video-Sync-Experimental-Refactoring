(function () {
    var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
    var videoSyncInterface = Script.resolvePath("assets/videoSyncInterface.html");
    var videoSyncServerScriptUrl = Script.resolvePath("videoSyncServerScript.js");
    var volumeSliderSourceUrl = Script.resolvePath("assets/volumeSlider.html");
    var uuid;
    var script = this;
    var entity;
    var _entityID;
    var sourceUrl = Script.resolvePath("videoSync.html");
    var leaveButtonFbxUrl = Script.resolvePath("assets/leave.fbx");
    var playButtonFbxUrl = Script.resolvePath("assets/playButton.fbx");
    var pauseButtonURL = Script.resolvePath("assets/pauseButton.fbx");
    var volumeButtonPlusUrl = Script.resolvePath("assets/volumeButtonPlus.fbx");
    var videoInterfaceButton = Script.resolvePath("assets/videoInterfaceButton.fbx");
    var volumeButtonPlus;
    var volumeButtonMinus;
    var playButtonUuid;
    var pauseButtonUuid;
    var leaveButtonUuid;
    var videoInterfaceButtonUuid;
    var volumeSliderUuid;
    var buttonsAreActive = false;
    var hasInteractedWithWebPage = false;
    var webPanelTimeStamp;
    var interfaceButtonActive = false;
    var videoPlayerChannel;
    var tabletOpen = false;
    var gatewayUserData = {
        "useGatewayServer": false,
        "wsUrl": "",
        "serverConnected": false
    };

    function openVideoInter() {
        if (buttonsAreActive || interfaceButtonActive) {
            tablet.gotoWebScreen(videoSyncInterface);
        }
    };

    tablet.webEventReceived.connect(onTabletWebEvent);

    function onTabletWebEvent(event) {
        var webEventData = JSON.parse(event);
        console.log(JSON.stringify(webEventData));
        if (webEventData.tabletId == videoPlayerChannel) {
            if (webEventData.action == "nowVideoFromTablet") {
                sendMessage(event);
            } else if (webEventData.action == "play") {
                Messages.sendMessage(videoPlayerChannel, event);
            }
        } else if (webEventData.action == "RequestVideoLengthAndTimeStamp") {
            if (tabletOpen) {
                tabletOpen = false;
                sendMessage(event);
            }
        } else if (webEventData.action == "videoSyncGateway") {
            if (webEventData.useGatewayServer) {
                /*
                gatewayUserData.wsUrl = "ws://" + webEventData.gatewayIp + ":7080";
                gatewayUserData.useGatewayServer = true;
                Entities.editEntity(_entityID, {
                    userData: JSON.stringify(gatewayUserData)
                });
                */
                Messages.sendMessage(videoPlayerChannel, event);
            }
        }
    }

    script.preload = function (entityID) {
        videoPlayerChannel = entityID;
        Messages.subscribe(videoPlayerChannel);
        entity = Entities.getEntityProperties(entityID, ["position", "dimensions", "rotation", "serverScripts", "userData"]);
        Entities.editEntity(entityID, {
            sourceUrl: sourceUrl,
            dpi: 8,
            maxFPS: 60,
            grab: {
                "grabbable": false,
            }
        });
        try {
            entityUserData = Object(JSON.parse(entity.userData));
        } catch (e) {
            Entities.editEntity(entityID, {
                userData: JSON.stringify(gatewayUserData)
            });
        }
        if (entity.serverScripts == "") {
            Entities.editEntity(entityID, {
                serverScripts: videoSyncServerScriptUrl
            });
        }
        _entityID = entityID;
        Entities.webEventReceived.connect(onWebEvent);
        addButtons();
    }

    function onWebEvent(uuid, event) {
        if (uuid == _entityID || volumeSliderUuid == uuid) {
            var messageData = JSON.parse(event);
            console.log("Web Event " + JSON.stringify(messageData));
            if (messageData.action == "requestSync") {
                webPanelTimeStamp = messageData.myTimeStamp;
            } else if (messageData.action == "RequestVideoLengthAndTimeStampResponse") {
                var entityUserData = Entities.getEntityProperties(videoPlayerChannel, ["userData"]);
                var UserData = JSON.parse(entityUserData.userData);
                messageData.tabletId = videoPlayerChannel;
                messageData.useGatewayServer = UserData.useGatewayServer;
                messageData.serverConnected = UserData.serverConnected;
                messageData.wsUrl = UserData.wsUrl;
                console.log(JSON.stringify(messageData));
                tablet.emitScriptEvent(JSON.stringify(messageData));
                return;
            } else if (messageData.action == "volumeSlider") {
                sendMessage(event);
                return;
            }
            Messages.sendMessage(videoPlayerChannel, event);
        }
    }

    function onMessageReceived(channel, message, sender, localOnly) {
        if (channel != videoPlayerChannel) {
            return;
        }
        var messageData = JSON.parse(message);
        console.log("Message Received " + JSON.stringify(messageData));
        if (messageData.action == "sync" && webPanelTimeStamp == messageData.myTimeStamp) {
            if (messageData.videoUrl != "") {
                buttonsAreActive = true;
                hideAndRevealButtons(buttonsAreActive);
            } else if (messageData.videoUrl == "") {
                hasInteractedWithWebPage = true;
                interfaceButtonActive = true;
                addInterfaceButton();
            }
        } else if (messageData.action == "now" && hasInteractedWithWebPage) {
            buttonsAreActive = true;
            hideAndRevealButtons(buttonsAreActive);
        } else if (messageData.action == "webSocketConnected") {
            tablet.emitScriptEvent(message);
            return;
        }
        sendMessage(message);
    }

    function sendMessage(message) {
        Entities.emitScriptEvent(_entityID, message);
    }

    function addButtons() {
        leaveButtonUuid = Entities.addEntity({
            type: "Model",
            modelURL: leaveButtonFbxUrl,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.2, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            dimensions: {
                "x": 0.22840283811092377,
                "y": 0.22654350101947784,
                "z": 0.019338179379701614
            },
            grab: {
                "grabbable": false,
            },
            visible: false
        }, "local");
        Script.addEventHandler(leaveButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);

        pauseButtonUuid = Entities.addEntity({
            type: "Model",
            modelURL: pauseButtonURL,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.8, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            dimensions: {
                "x": 0.22840283811092377,
                "y": 0.22654350101947784,
                "z": 0.019338179379701614
            },
            grab: {
                "grabbable": false,
            },
            visible: false
        }, "local");
        Script.addEventHandler(pauseButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);

        playButtonUuid = Entities.addEntity({
            type: "Model",
            modelURL: playButtonFbxUrl,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.5, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            dimensions: {
                "x": 0.22840283811092377,
                "y": 0.22654350101947784,
                "z": 0.019338179379701614
            },
            grab: {
                "grabbable": false,
            },
            visible: false
        }, "local");
        Script.addEventHandler(playButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);

        volumeButtonMinus = Entities.addEntity({
            type: "Model",
            modelURL: leaveButtonFbxUrl,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 0.2, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            dimensions: {
                "x": 0.2284,
                "y": 0.0779,
                "z": 0.0193
            },
            grab: {
                "grabbable": false,
            },
        }, "local");
        Script.addEventHandler(volumeButtonMinus, "mousePressOnEntity", evaluateWhichButtonPressed);

        volumeButtonPlus = Entities.addEntity({
            type: "Model",
            modelURL: volumeButtonPlusUrl,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 0.5, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            dimensions: {
                "x": 0.22840283811092377,
                "y": 0.22654350101947784,
                "z": 0.019338179379701614
            },
            grab: {
                "grabbable": false,
            },
        }, "local");
        Script.addEventHandler(volumeButtonPlus, "mousePressOnEntity", evaluateWhichButtonPressed);

        videoInterfaceButtonUuid = Entities.addEntity({
            type: "Model",
            modelURL: videoInterfaceButton,
            parentID: _entityID,
            triggerable: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x + 0.5, y: entity.dimensions.y / 2 + 0.4, z: 0 })),
            grab: {
                "grabbable": false,
            },
            visible: false
        }, "local");
        Script.addEventHandler(videoInterfaceButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);

        volumeSliderUuid = Entities.addEntity({
            type: "Web",
            dpi: 8,
            sourceUrl: volumeSliderSourceUrl,
            parentID: _entityID,
            //visible: false,
            dimensions: {
                "x": 1.3687,
                "y": 0.3429,
                "z": 0.0010
            },
            registrationPoint: {
                "x": 0.5,
                "y": 0.5,
                "z": 0
            },
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 1.4, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            rotation: entity.rotation
        }, "local");
    }

    function evaluateWhichButtonPressed(mousePressEntityID, event) {
        switch (mousePressEntityID) {
            case pauseButtonUuid:
                console.log("PauseButtonUuid Yes");
                actOnButtonPressed("pause");
                break;
            case leaveButtonUuid:
                console.log("LeaveButtonUuid Yes");
                actOnButtonPressed("leave");
                buttonsAreActive = false;
                interfaceButtonActive = false;
                hideAndRevealButtons(buttonsAreActive);
                break;
            case playButtonUuid:
                console.log("playButtonUuid Yes");
                actOnButtonPressed("play");
                break;
            case volumeButtonMinus:
                console.log("volumeButtonMinus Yes");
                actOnButtonPressed("volumeButtonMinus");
                break;
            case volumeButtonPlus:
                console.log("volumeButtonPlus Yes");
                actOnButtonPressed("volumeButtonPlus");
                break;
            case videoInterfaceButtonUuid:
                console.log("videoInterfaceButton Yes");
                tabletOpen = true;
                openVideoInter();
                break;
        }
    }

    function addInterfaceButton() {
        Entities.editEntity(videoInterfaceButtonUuid, {
            visible: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x + 0.5, y: entity.dimensions.y / 2 + 0.4, z: 0 }))
        });
        Entities.editEntity(leaveButtonUuid, {
            visible: true,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.2, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });
    }

    function hideAndRevealButtons(hideOrReveal) {
        entity = Entities.getEntityProperties(_entityID, ["position", "dimensions", "rotation"]);
        Entities.editEntity(leaveButtonUuid, {
            visible: hideOrReveal,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.2, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });

        Entities.editEntity(pauseButtonUuid, {
            visible: hideOrReveal,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.8, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });

        Entities.editEntity(playButtonUuid, {
            visible: hideOrReveal,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x - -0.5, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });

        Entities.editEntity(volumeButtonMinus, {
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 0.2, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });

        Entities.editEntity(volumeButtonPlus, {
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 0.5, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 }))
        });

        Entities.editEntity(videoInterfaceButtonUuid, {
            visible: hideOrReveal,
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - entity.dimensions.x + 0.5, y: entity.dimensions.y / 2 + 0.4, z: 0 }))
        });

        Entities.editEntity(volumeSliderUuid, {
            position: Vec3.sum(entity.position, Vec3.multiplyQbyV(entity.rotation, { x: entity.dimensions.x / 2 - 1.4, y: entity.dimensions.y / 2 - entity.dimensions.y - 0.2, z: 0 })),
            rotation: entity.rotation
        });
    }

    function actOnButtonPressed(buttonAction) {
        var readyEvent = {
            "action": "buttonAction",
            "buttonAction": buttonAction
        };
        sendMessage(JSON.stringify(readyEvent));
    }

    function removeButtons() {
        Entities.deleteEntity(leaveButtonUuid);
        Entities.deleteEntity(pauseButtonUuid);
        Entities.deleteEntity(playButtonUuid);
        Entities.deleteEntity(volumeButtonMinus);
        Entities.deleteEntity(volumeButtonPlus);
        Entities.deleteEntity(videoInterfaceButtonUuid);
        Entities.deleteEntity(volumeSliderUuid);
        Script.removeEventHandler(videoInterfaceButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);
        Script.removeEventHandler(volumeButtonPlus, "mousePressOnEntity", evaluateWhichButtonPressed);
        Script.removeEventHandler(volumeButtonMinus, "mousePressOnEntity", evaluateWhichButtonPressed);
        Script.removeEventHandler(leaveButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);
        Script.removeEventHandler(pauseButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);
        Script.removeEventHandler(playButtonUuid, "mousePressOnEntity", evaluateWhichButtonPressed);
    }

    Messages.messageReceived.connect(onMessageReceived);
    script.unload = function (entityID) {
        Messages.unsubscribe(videoPlayerChannel);
        Entities.deleteEntity(uuid);
        Messages.messageReceived.disconnect(onMessageReceived);
        Entities.webEventReceived.disconnect(onWebEvent);
        tablet.webEventReceived.disconnect(onTabletWebEvent);
        removeButtons();
    }
});
