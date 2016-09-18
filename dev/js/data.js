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
            location = response;
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

    .controller('Dialogue', ['$sce','$element','$timeout','$q','$scope','Tabletop','DialoguePortfolioParser','Weather','GetLocation','GrantsAge','$http',function($sce,$element,$timeout,$q,$scope,Tabletop,DialoguePortfolioParser,Weather,GetLocation,GrantsAge, $http) {
        var bot = new cleverbot("WQGo50NC6sORT6S7", "kuPeHqs35Qmri0A0Zywx3O3VkxhXLA7O");
        var ranAlready = true;
        bot.create(function (err, session) {
            window.load = function(name){
                return angular.element(document.body).injector().get(name);
            }
            var parsedData, dialogue;
            var waitingForResponse;
            var currentResponseCategory;

            var userDefaults = {};

            const consumerKey = "0AUrbvhzjfJK2qMF8icRQg";
            const consumerSecret = "xaPE05PudxXyU8pOKTmqrK5xtig";
            const token = "w-OadXdo_jEomxZHw8HClmRExZJhVYSO";
            const tokenSecret = "KGf-o-UdPhcJps_NghLwaDJqTMQ";
            const URL = "http://api.yelp.com/v2/search?callback=JSON_CALLBACK";

            GetLocation.then(function(resp){
                userDefaults.originalCountry = resp.country_code;
            });

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
            var registerMessage = function(msg,sender,/*optional*/ waitingObj){
                if (waitingObj) {
                    // wait for response
                    waitingForResponse = true;
                    currentResponseCategory = waitingObj.category;
                }
                var deferred = $q.defer();
                if (!sender && !$scope.lock) {
                    $scope.lock = true;
                    $timeout(function(){
                        $scope.messageQueue.push({ sender: sender ? sender : 'Grant', message: msg });
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


            var randomString = function(length) {
                var text = "";
                var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                for(var i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            }

            // Send filtered response
            $scope.messageQueue = [];
            $scope.send = function(input) {
                if (!$scope.lock && input) {
                    if (waitingForResponse) {
                        if (input === "more") {
                            if (window.moreString === undefined || window.moreString === null) {
                                registerMessage("Sorry, there are no more results.");
                                return;
                            } else {
                                registerMessage("Here are more suggestions for where to go" + ".<br/ style='margin-bottom:5px;'>" + window.moreString.join(''));
                                waitingForResponse = false;
                                currentResponseCategory = null;
                                window.moreString = null;

                                // plug the exchange rate
                                // var currencies = {"BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "BGN", "BA": "BAM", "BB": "BBD", "WF": "XPF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BT": "BTN", "JM": "JMD", "BV": "NOK", "BW": "BWP", "WS": "WST", "BQ": "USD", "BR": "BRL", "BS": "BSD", "JE": "GBP", "BY": "BYR", "BZ": "BZD", "RU": "RUB", "RW": "RWF", "RS": "RSD", "TL": "USD", "RE": "EUR", "TM": "TMT", "TJ": "TJS", "RO": "RON", "TK": "NZD", "GW": "XOF", "GU": "USD", "GT": "GTQ", "GS": "GBP", "GR": "EUR", "GQ": "XAF", "GP": "EUR", "JP": "JPY", "GY": "GYD", "GG": "GBP", "GF": "EUR", "GE": "GEL", "GD": "XCD", "GB": "GBP", "GA": "XAF", "SV": "USD", "GN": "GNF", "GM": "GMD", "GL": "DKK", "GI": "GIP", "GH": "GHS", "OM": "OMR", "TN": "TND", "JO": "JOD", "HR": "HRK", "HT": "HTG", "HU": "HUF", "HK": "HKD", "HN": "HNL", "HM": "AUD", "VE": "VEF", "PR": "USD", "PS": "ILS", "PW": "USD", "PT": "EUR", "SJ": "NOK", "PY": "PYG", "IQ": "IQD", "PA": "PAB", "PF": "XPF", "PG": "PGK", "PE": "PEN", "PK": "PKR", "PH": "PHP", "PN": "NZD", "PL": "PLN", "PM": "EUR", "ZM": "ZMK", "EH": "MAD", "EE": "EUR", "EG": "EGP", "ZA": "ZAR", "EC": "USD", "IT": "EUR", "VN": "VND", "SB": "SBD", "ET": "ETB", "SO": "SOS", "ZW": "ZWL", "SA": "SAR", "ES": "EUR", "ER": "ERN", "ME": "EUR", "MD": "MDL", "MG": "MGA", "MF": "EUR", "MA": "MAD", "MC": "EUR", "UZ": "UZS", "MM": "MMK", "ML": "XOF", "MO": "MOP", "MN": "MNT", "MH": "USD", "MK": "MKD", "MU": "MUR", "MT": "EUR", "MW": "MWK", "MV": "MVR", "MQ": "EUR", "MP": "USD", "MS": "XCD", "MR": "MRO", "IM": "GBP", "UG": "UGX", "TZ": "TZS", "MY": "MYR", "MX": "MXN", "IL": "ILS", "FR": "EUR", "IO": "USD", "SH": "SHP", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NA": "NAD", "VU": "VUV", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NZ": "NZD", "NP": "NPR", "NR": "AUD", "NU": "NZD", "CK": "NZD", "XK": "EUR", "CI": "XOF", "CH": "CHF", "CO": "COP", "CN": "CNY", "CM": "XAF", "CL": "CLP", "CC": "AUD", "CA": "CAD", "CG": "XAF", "CF": "XAF", "CD": "CDF", "CZ": "CZK", "CY": "EUR", "CX": "AUD", "CR": "CRC", "CW": "ANG", "CV": "CVE", "CU": "CUP", "SZ": "SZL", "SY": "SYP", "SX": "ANG", "KG": "KGS", "KE": "KES", "SS": "SSP", "SR": "SRD", "KI": "AUD", "KH": "KHR", "KN": "XCD", "KM": "KMF", "ST": "STD", "SK": "EUR", "KR": "KRW", "SI": "EUR", "KP": "KPW", "KW": "KWD", "SN": "XOF", "SM": "EUR", "SL": "SLL", "SC": "SCR", "KZ": "KZT", "KY": "KYD", "SG": "SGD", "SE": "SEK", "SD": "SDG", "DO": "DOP", "DM": "XCD", "DJ": "DJF", "DK": "DKK", "VG": "USD", "DE": "EUR", "YE": "YER", "DZ": "DZD", "US": "USD", "UY": "UYU", "YT": "EUR", "UM": "USD", "LB": "LBP", "LC": "XCD", "LA": "LAK", "TV": "AUD", "TW": "TWD", "TT": "TTD", "TR": "TRY", "LK": "LKR", "LI": "CHF", "LV": "EUR", "TO": "TOP", "LT": "LTL", "LU": "EUR", "LR": "LRD", "LS": "LSL", "TH": "THB", "TF": "EUR", "TG": "XOF", "TD": "XAF", "TC": "USD", "LY": "LYD", "VA": "EUR", "VC": "XCD", "AE": "AED", "AD": "EUR", "AG": "XCD", "AF": "AFN", "AI": "XCD", "VI": "USD", "IS": "ISK", "IR": "IRR", "AM": "AMD", "AL": "ALL", "AO": "AOA", "AQ": "", "AS": "USD", "AR": "ARS", "AU": "AUD", "AT": "EUR", "AW": "AWG", "IN": "INR", "AX": "EUR", "AZ": "AZN", "IE": "EUR", "ID": "IDR", "UA": "UAH", "QA": "QAR", "MZ": "MZN"};
                                // var xeURL = "https://hackthenorth069:Waterloo31969@xecdapi.xe.com/v1/convert_from.json/?from=" + currencies[userDefaults.originalCountry] + "&to=" + currencies[userDefaults.destinationCountry] + "&amount=100";
                                // console.log(xeURL);
                                // $http.get(xeURL, {params: parameters}).success(function(response){
                                //     console.log("omg?", response);
                                // });
                                return;
                            }
                        }
                        registerMessage(input, 'user');
                        $element.find('input').val('');
                        $scope.currentUser.text = null;

                        // do stuff with input now
                        if (currentResponseCategory) {
                            input = input.replace(/[^A-Za-z0-9\s]/g,"").replace(/\s{2,}/g, " ");
                            switch (currentResponseCategory) {
                                case "name":
                                    currentResponseCategory = null;
                                    if (input.toLowerCase().indexOf('is') !== -1) {
                                        input = input.substring(input.indexOf('is') + 3, input.length);
                                    } else if (input.toLowerCase().indexOf('im') !== -1) {
                                        input = input.substring(input.indexOf('im') + 3, input.length);
                                    } else if (input.toLowerCase().indexOf('names') !== -1) {
                                        input = input.substring(input.indexOf('names') + 6, input.length);
                                    }
                                    userDefaults.username = input;
                                    registerMessage("Hello " + input + "!" + " How are you today?", null, { category: "feeling" });
                                    break;
                                case "feeling":
                                    currentResponseCategory = null;
                                    // sentiment analysis
                                    var tokenized = "https://text-analytics-demo.azurewebsites.net/Demo/Analyze?inputText=" + input.toLowerCase().replace( /(?!\s+$)\s+/g, "+" ) + "%0D%0A&X-Requested-With=XMLHttpRequest&_=1474159910360";
                                    $http.get(tokenized, {params: parameters}).success(function(response){
                                        var tokenz = response.indexOf('"sentiment": {"documents":[{"score":') + 36;
                                        var tokenz2 = response.substring(tokenz, tokenz + 5);
                                        var tokenz3 = parseFloat(tokenz2);
                                        console.log(tokenz3);
                                        userDefaults.feeling = tokenz3;
                                        if (tokenz3 > 0.5) {
                                            registerMessage("Awesome!").then(function(){
                                                $timeout(function(){
                                                    registerMessage("Where are you headed " + userDefaults.username + "?", null, { category: "location" });
                                                },300);
                                            });
                                        } else {
                                            registerMessage("Sorry to hear that " + userDefaults.username + "! Here are a few fun facts to cheer up your day." + "<br/><br/><b>1) </b> Every cow has their own best friend that they hang around every day." + "<br/><b>2) </b> There’s an island called Ōkunoshima in Japan that’s filled with tame bunnies. " + "<br/><b>3) </b>Each year, hundreds of trees grow because squirrels forget where they buried their food.").then(function(){
                                                $timeout(function(){
                                                    registerMessage("By the way, where are you headed " + userDefaults.username + "?", null, { category: "location" });
                                                },300);
                                            });
                                        }
                                    }).catch(function(){
                                        registerMessage("Awesome!").then(function(){
                                            $timeout(function(){
                                                registerMessage("Where are you headed " + userDefaults.username + "?", null, { category: "location" });
                                            },300);
                                        });
                                    });
                                    break;
                                case "location":
                                    currentResponseCategory = null;
                                    userDefaults.location = input;

                                    var date = new Date();
                                    var timestamp = date.getTime();

                                    var httpMethod = 'GET',
                                        parameters = {
                                            callback: 'angular.callbacks._0',
                                            oauth_consumer_key : consumerKey,
                                            location: userDefaults.location,
                                            oauth_token : token,
                                            oauth_nonce : randomString(10),
                                            oauth_timestamp : timestamp,
                                            oauth_signature_method : 'HMAC-SHA1',
                                            oauth_version : '1.0',
                                        },
                                        signature = oauthSignature.generate(httpMethod, URL, parameters, consumerSecret, tokenSecret,
                                            { encodeSignature: false});

                                    parameters['oauth_signature'] = signature;

                                    registerMessage("Great!");
                                    $http.jsonp(URL, {params: parameters}).success(function(response){
                                        console.dir(response);
                                        userDefaults.destinationCountry = response.businesses[0].location.country_code;
                                        var buildString = [];
                                        for(var i=0; i< (response.businesses.length > 3 ? 3 : response.businesses.length); i++) {
                                            buildString.push("<a target='_blank' href='" + response.businesses[i].url + "'><br/><img style='border-radius:5px;border:1px solid white;margin-bottom:-10px;margin-top:-10px;margin-left:45px;' src='" + response.businesses[i].image_url + "' />" + "<p style='margin-bottom:10px;text-align:center;'>" + response.businesses[i].name + "</p></a>");
                                        }
                                        $timeout(function(){
                                            console.log("should run now");
                                            registerMessage("Okay, here are some suggestions for where to go." + "<br/ style='margin-bottom:5px;'>" + buildString.join('') + "<br/>Try 'more' for more options.");
                                        },600);
                                        var moreString = [];
                                        for(var i=buildString.length; i < (response.businesses.length); i++) {
                                            moreString.push("<a target='_blank' href='" + response.businesses[i].url + "'><br/><img style='border-radius:5px;border:1px solid white;margin-bottom:-10px;margin-top:-10px;margin-left:45px;' src='" + response.businesses[i].image_url + "' />" + "<p style='margin-bottom:10px;text-align:center;'>" + response.businesses[i].name + "</p></a>");
                                        }
                                        window.moreString = moreString;
                                    }).catch(function(data){
                                        console.log('data',data);
                                        $timeout(function(){
                                            registerMessage("Sorry, I can't find any places at that destination.");
                                        },2000);
                                    });
                                    break;
                                default:
                                    currentResponseCategory = null;
                                    // if response can't be recognized, just registerMessage("Sorry, I can't respond to that.")
                                    registerMessage("Sorry, I can't respond to that.");
                                    console.log("whaaaaat");
                            }
                        }
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
                                    bot.ask(input, function (err, response) {
                                        $timeout(function(){
                                            registerMessage(response);
                                        },500);
                                    });
                            }
                        },function(notFoundMsg){
                            bot.ask(input, function (err, response) {
                                $timeout(function(){
                                    registerMessage(response);
                                },500);
                            });
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
            if (!ranAlready) {
                registerMessage("Hi, I'm Eve, your personal travel assistant. What's your name?", null, { category: "name" });
            }
            if (ranAlready) {
                ranAlready = false;
            }
            $timeout(function(){
                $element.addClass('loaded');
            },1250);
        });
    }]);
})(); 
