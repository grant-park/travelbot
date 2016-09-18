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

    .controller('Dialogue', ['$sce','$element','$timeout','$q','$scope','Tabletop','DialoguePortfolioParser','Weather','GetLocation','GrantsAge','$http',function($sce,$element,$timeout,$q,$scope,Tabletop,DialoguePortfolioParser,Weather,GetLocation,GrantsAge, $http) {

        var parsedData, dialogue;
        var waitingForResponse;
        var currentResponseCategory;

        const consumerKey = "0AUrbvhzjfJK2qMF8icRQg";
        const consumerSecret = "xaPE05PudxXyU8pOKTmqrK5xtig";
        const token = "w-OadXdo_jEomxZHw8HClmRExZJhVYSO";
        const tokenSecret = "KGf-o-UdPhcJps_NghLwaDJqTMQ";
        const URL = "http://api.yelp.com/v2/search?callback=JSON_CALLBACK";

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
            if (waitingForResponse)
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
        var userDefaults = {};


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
                    registerMessage(input, 'user');
                    $element.find('input').val('');
                    $scope.currentUser.text = null;

                    // do stuff with input now
                    if (currentResponseCategory) {
                        switch (currentResponseCategory) {
                            case "name":
                                userDefaults.username = input;
                                registerMessage("Hello " + input + "!" + " How are you today?", null, { category: "feeling" });
                                break;
                            case "feeling":
                                // sentiment analysis
                                userDefaults.feeling = input;
                                registerMessage("Awesome!").then(function(){
                                    $timeout(function(){
                                        registerMessage("Where are you headed " + userDefaults.username + "?", null, { category: "location" });
                                    },300);
                                });
                                break;
                            case "location":
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

                                console.log("hi");
                                $http.jsonp(URL, {params: parameters}).success(function(response){
                                    console.dir(response);
                                    console.log(response.businesses[0].location.country_code);
                                    userDefaults.destinationCountry = response.businesses[0].location.country_code;
                                    var buildString = [];
                                    for(var i=0; i< (response.businesses.length > 3 ? 3 : response.businesses.length); i++) {
                                        buildString.push("<a target='_blank' href='" + response.businesses[i].url + "'><br/><img style='border-radius:5px;border:1px solid white;margin-bottom:-10px;' src='" + response.businesses[i].image_url + "' />" + "<p style='margin-bottom:-5px;'>" + response.businesses[i].name + "</p></a>");
                                    }
                                    registerMessage("Okay, here are some suggestions for where to go in " + userDefaults.location + ".<br/><br/>" + buildString.join(''), null, { category: "currency" });
                                });
                                registerMessage("Great!");
                                break;
                            case "currency":
                                var currencies = {"BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "BGN", "BA": "BAM", "BB": "BBD", "WF": "XPF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BT": "BTN", "JM": "JMD", "BV": "NOK", "BW": "BWP", "WS": "WST", "BQ": "USD", "BR": "BRL", "BS": "BSD", "JE": "GBP", "BY": "BYR", "BZ": "BZD", "RU": "RUB", "RW": "RWF", "RS": "RSD", "TL": "USD", "RE": "EUR", "TM": "TMT", "TJ": "TJS", "RO": "RON", "TK": "NZD", "GW": "XOF", "GU": "USD", "GT": "GTQ", "GS": "GBP", "GR": "EUR", "GQ": "XAF", "GP": "EUR", "JP": "JPY", "GY": "GYD", "GG": "GBP", "GF": "EUR", "GE": "GEL", "GD": "XCD", "GB": "GBP", "GA": "XAF", "SV": "USD", "GN": "GNF", "GM": "GMD", "GL": "DKK", "GI": "GIP", "GH": "GHS", "OM": "OMR", "TN": "TND", "JO": "JOD", "HR": "HRK", "HT": "HTG", "HU": "HUF", "HK": "HKD", "HN": "HNL", "HM": "AUD", "VE": "VEF", "PR": "USD", "PS": "ILS", "PW": "USD", "PT": "EUR", "SJ": "NOK", "PY": "PYG", "IQ": "IQD", "PA": "PAB", "PF": "XPF", "PG": "PGK", "PE": "PEN", "PK": "PKR", "PH": "PHP", "PN": "NZD", "PL": "PLN", "PM": "EUR", "ZM": "ZMK", "EH": "MAD", "EE": "EUR", "EG": "EGP", "ZA": "ZAR", "EC": "USD", "IT": "EUR", "VN": "VND", "SB": "SBD", "ET": "ETB", "SO": "SOS", "ZW": "ZWL", "SA": "SAR", "ES": "EUR", "ER": "ERN", "ME": "EUR", "MD": "MDL", "MG": "MGA", "MF": "EUR", "MA": "MAD", "MC": "EUR", "UZ": "UZS", "MM": "MMK", "ML": "XOF", "MO": "MOP", "MN": "MNT", "MH": "USD", "MK": "MKD", "MU": "MUR", "MT": "EUR", "MW": "MWK", "MV": "MVR", "MQ": "EUR", "MP": "USD", "MS": "XCD", "MR": "MRO", "IM": "GBP", "UG": "UGX", "TZ": "TZS", "MY": "MYR", "MX": "MXN", "IL": "ILS", "FR": "EUR", "IO": "USD", "SH": "SHP", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NA": "NAD", "VU": "VUV", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NZ": "NZD", "NP": "NPR", "NR": "AUD", "NU": "NZD", "CK": "NZD", "XK": "EUR", "CI": "XOF", "CH": "CHF", "CO": "COP", "CN": "CNY", "CM": "XAF", "CL": "CLP", "CC": "AUD", "CA": "CAD", "CG": "XAF", "CF": "XAF", "CD": "CDF", "CZ": "CZK", "CY": "EUR", "CX": "AUD", "CR": "CRC", "CW": "ANG", "CV": "CVE", "CU": "CUP", "SZ": "SZL", "SY": "SYP", "SX": "ANG", "KG": "KGS", "KE": "KES", "SS": "SSP", "SR": "SRD", "KI": "AUD", "KH": "KHR", "KN": "XCD", "KM": "KMF", "ST": "STD", "SK": "EUR", "KR": "KRW", "SI": "EUR", "KP": "KPW", "KW": "KWD", "SN": "XOF", "SM": "EUR", "SL": "SLL", "SC": "SCR", "KZ": "KZT", "KY": "KYD", "SG": "SGD", "SE": "SEK", "SD": "SDG", "DO": "DOP", "DM": "XCD", "DJ": "DJF", "DK": "DKK", "VG": "USD", "DE": "EUR", "YE": "YER", "DZ": "DZD", "US": "USD", "UY": "UYU", "YT": "EUR", "UM": "USD", "LB": "LBP", "LC": "XCD", "LA": "LAK", "TV": "AUD", "TW": "TWD", "TT": "TTD", "TR": "TRY", "LK": "LKR", "LI": "CHF", "LV": "EUR", "TO": "TOP", "LT": "LTL", "LU": "EUR", "LR": "LRD", "LS": "LSL", "TH": "THB", "TF": "EUR", "TG": "XOF", "TD": "XAF", "TC": "USD", "LY": "LYD", "VA": "EUR", "VC": "XCD", "AE": "AED", "AD": "EUR", "AG": "XCD", "AF": "AFN", "AI": "XCD", "VI": "USD", "IS": "ISK", "IR": "IRR", "AM": "AMD", "AL": "ALL", "AO": "AOA", "AQ": "", "AS": "USD", "AR": "ARS", "AU": "AUD", "AT": "EUR", "AW": "AWG", "IN": "INR", "AX": "EUR", "AZ": "AZN", "IE": "EUR", "ID": "IDR", "UA": "UAH", "QA": "QAR", "MZ": "MZN"};
                                var parameters = {
                                    callback: 'angular.callbacks._0'
                                }
                                var currencyURL;
                                var location;
                                var locationPromise = $http.jsonp("https://geoip-db.com/json/geoip.php?jsonp=JSON_CALLBACK", {params: parameters}).success(function(response){
                                    location = response.country_code;
                                    var originCurrency = currencies[location];
                                    var targetCurrency = currencies[userDefaults.destinationCountry];
                                    currencyURL = "https://hackthenorth069:Waterloo31969@xecdapi.xe.com/v1/convert_from.json/?from=" + originCurrency + "&to=" + targetCurrency + "&amount=100";
                                    console.log(currencyURL);
                                }).error(function(errorMsg){
                                    console.log(errorMsg);
                                    location = 'unknown';
                                })

                                locationPromise.then(function(){
                                    $http.jsonp(currencyURL, {params: parameters}).success(function(response){
                                    })
                                })
                                break;
                            default:
                                // if response can't be recognized, just registerMessage("Sorry, I can't respond to that.")
                                registerMessage("Sorry, I can't respond to that.");
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

        registerMessage("Hi, I'm TravelBot. What's your name?", null, { category: "name" });


        $timeout(function(){
            $element.addClass('loaded'); 
        },1250);
    }]);
})(); 
