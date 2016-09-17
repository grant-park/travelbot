(function(){
"use strict";
angular.module('Site', ['ngAnimate','times.tabletop','ngSanitize','luegg.directives'])

    .config(['TabletopProvider', function(TabletopProvider){
        // Tabletop setup
        TabletopProvider.setTabletopOptions({
            key: '1nWRFI2iLEt8onPB_5HSjTBjLZ_wfRaEdmsa7CeFUiLE',
            simple_url: true
        });
    }])        

    .factory('DialoguePortfolioParser',[function(){
        var api = {
            parse: function(data){
                var parsedObj = {};
                parsedObj.dialogue = [];
                _.each(data[0].Dialogue.elements,function(el) {
                    parsedObj.dialogue.push({
                        possibleInputs: el.possibleInputs.split(','),
                        response: el.response
                    });
                });
                parsedObj.portfolio = data[0].Portfolio.elements;
                return parsedObj;
            }
        };
        return api;
    }])

    .factory('GrantsAge',[function(){
        var date = new Date(),
        month = date.getMonth() + 1,
        year = date.getFullYear(),
        day = date.getDay(),
        diff = year - 1995;
        if (12 > month) {
            diff -= 1;
        } else {
            if (2 > day) {
                diff -= 1;
            }
        }
        return diff.toString();
    }])

    .factory('GetLocation',['$http','$q',function($http,$q){
        var deferred = $q.defer();
        var location;
        var locationPromise = $http({method: 'JSONP', url: "https://geoip-db.com/json/geoip.php?jsonp=JSON_CALLBACK"}).success(function(response){
            location = response.city + ', ' + response.state + ', ' + response.country_name;
        }).error(function(errorMsg){
            location = 'unknown';
        });
        var resolve = function(){
            deferred.resolve(location);
        };
        if (location) {
            resolve();
        } else {
            locationPromise.then(function(){
                resolve();
            });
        }
        return deferred.promise;
    }])

    .factory('Weather',['$http','$q',function($http,$q){
        var deferred = $q.defer();
        var weather;
        var weatherPromise = $http.get("http://api.wunderground.com/api/c1ea49b3e06dc3b3/geolookup/conditions/q/MA/Amherst.json").then(function(response){
            var data = response.data;
            var location = data.location.city,
            currentTemp = data.current_observation.temp_f;
            weather = "The current temperature in " + location + " is: " + currentTemp + "&deg;F &#128513;";
            if (50 > currentTemp) {
                weather = "Brrr! The current temperature in " + location + " is: " + currentTemp + "&deg:F &#128559;";
            }
        },function(errorMsg){
            console.error(errorMsg);
            weather = "I don't have a clue actually...";
        });
        var resolve = function(){
            deferred.resolve(weather);
        };
        if (weather) {
            resolve();
        } else {
            weatherPromise.then(function(){
                resolve();
            });
        }
        return deferred.promise;
    }])

    .controller('Dialogue', ['$sce','$element','$timeout','$q','$scope','Tabletop','DialoguePortfolioParser','Weather','GetLocation','GrantsAge',function($sce,$element,$timeout,$q,$scope,Tabletop,DialoguePortfolioParser,Weather,GetLocation,GrantsAge) {

        var parsedData, dialogue;
        var waitingForResponse;
        // Returns response promise based on input
        var dialogueResponse = function(input){
            var deferred = $q.defer();
            for (var i=0;i<dialogue.length;i++){
                for (var j=0;j<dialogue[i].possibleInputs.length;j++){
                    if (input.toLowerCase().indexOf(dialogue[i].possibleInputs[j].toLowerCase()) !== -1) {
                        deferred.resolve({ response: dialogue[i].response, i: i, j: j });
                        return deferred.promise;
                    }
                }
            }
            deferred.reject("Sorry, I can't respond to that.");
            return deferred.promise;
        };

        $scope.lock = false;
        // Add to message queue
        var registerMessage = function(msg,sender,/*optional*/ status){
            var deferred = $q.defer();
            if (!sender && !$scope.lock) {
                $scope.lock = true;
                $timeout(function(){
                    $scope.messageQueue.push({ sender: sender ? sender : 'Grant', message: msg, status: status });
                    deferred.resolve();
                },900).then(function(){
                    $scope.lock = false;
                }); 
            } else {
                if (!$scope.lock) {
                    $scope.messageQueue.push({ sender: sender ? sender : 'Grant', message: msg });
                    deferred.resolve();
                }
            }
            return deferred.promise;
        };

        $scope.trustAsHtml = function(string){
            return $sce.trustAsHtml(string); 
        };

        // Initial screen is dialogue
        $scope.dialogue = true;
        $scope.buttonClicked = function(){
            // do nothing
        };

        $scope.currentUser = { text: '' };

        // Send filtered response
        $scope.messageQueue = [];
        $scope.send = function(input) {
            if (!$scope.lock && input) {
                if (waitingForResponse) {
                    registerMessage(input, 'user');
                    $element.find('input').val('');
                    $scope.currentUser.text = null;
                    waitingForResponse = false;

                    // do stuff with input now
                    console.log("testing");
                    registerMessage("Response received.");

                } else {
                    registerMessage(input, 'user');
                    $element.find('input').val('');
                    $scope.currentUser.text = null;
                    dialogueResponse(input).then(function(data){
                        switch (data.response) {
                            case "E.AGE":
                                registerMessage(GrantsAge);
                                break;
                            case "E.WEATHER":
                                Weather.then(function(resp){
                                    registerMessage(resp);
                                });
                                break;
                            default:
                                registerMessage(data.response);
                        }
                    },function(notFoundMsg){
                        registerMessage(notFoundMsg);
                    });
                }
            }
        };

        // Waking Google spreadsheets up...
        Tabletop.then(function(data){
            var deferred = $q.defer();
            if (data) {
                deferred.resolve(data);
            } else {
                deferred.reject("Could not retrieve data");
            }
            return deferred.promise;
        }).then(function(data){
            parsedData = DialoguePortfolioParser.parse(data);
            dialogue = parsedData.dialogue;
        },function(msg){console.error(msg);});

        registerMessage("Hi, I'm TravelBot. What's your name?").then(function(){
            // wait for response
            waitingForResponse = true;
            console.log("waiting for response");
        });


        $timeout(function(){
            $element.addClass('loaded'); 
        },1250);
    }]);
})(); 
