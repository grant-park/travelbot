(function() {
  "use strict";

  var inNodeJS = false;
  if (typeof process !== 'undefined' && !process.browser) {
    inNodeJS = true;
    var request = require('request'.trim()); //prevents browserify from bundling the module
  }

  var supportsCORS = false;
  var inLegacyIE = false;
  try {
    var testXHR = new XMLHttpRequest();
    if (typeof testXHR.withCredentials !== 'undefined') {
      supportsCORS = true;
    } else {
      if ("XDomainRequest" in window) {
        supportsCORS = true;
        inLegacyIE = true;
      }
    }
  } catch (e) { }

  // Create a simple indexOf function for support
  // of older browsers.  Uses native indexOf if 
  // available.  Code similar to underscores.
  // By making a separate function, instead of adding
  // to the prototype, we will not break bad for loops
  // in older browsers
  var indexOfProto = Array.prototype.indexOf;
  var ttIndexOf = function(array, item) {
    var i = 0, l = array.length;
    
    if (indexOfProto && array.indexOf === indexOfProto) return array.indexOf(item);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };
  
  /*
    Initialize with Tabletop.init( { key: '0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc' } )
      OR!
    Initialize with Tabletop.init( { key: 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key=0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc&output=html&widget=true' } )
      OR!
    Initialize with Tabletop.init('0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc')
  */

  var Tabletop = function(options) {
    // Make sure Tabletop is being used as a constructor no matter what.
    if(!this || !(this instanceof Tabletop)) {
      return new Tabletop(options);
    }
    
    if(typeof(options) === 'string') {
      options = { key : options };
    }

    this.callback = options.callback;
    this.wanted = options.wanted || [];
    this.key = options.key;
    this.simpleSheet = !!options.simpleSheet;
    this.parseNumbers = !!options.parseNumbers;
    this.wait = !!options.wait;
    this.reverse = !!options.reverse;
    this.postProcess = options.postProcess;
    this.debug = !!options.debug;
    this.query = options.query || '';
    this.orderby = options.orderby;
    this.endpoint = options.endpoint || "https://spreadsheets.google.com";
    this.singleton = !!options.singleton;
    this.simple_url = !!options.simple_url;
    this.callbackContext = options.callbackContext;
    // Default to on, unless there's a proxy, in which case it's default off
    this.prettyColumnNames = typeof(options.prettyColumnNames) == 'undefined' ? !options.proxy : options.prettyColumnNames;
    
    if(typeof(options.proxy) !== 'undefined') {
      // Remove trailing slash, it will break the app
      this.endpoint = options.proxy.replace(/\/$/,'');
      this.simple_url = true;
      this.singleton = true;
      // Let's only use CORS (straight JSON request) when
      // fetching straight from Google
      supportsCORS = false;
    }
    
    this.parameterize = options.parameterize || false;
    
    if(this.singleton) {
      if(typeof(Tabletop.singleton) !== 'undefined') {
        this.log("WARNING! Tabletop singleton already defined");
      }
      Tabletop.singleton = this;
    }
    
    /* Be friendly about what you accept */
    if(/key=/.test(this.key)) {
      this.log("You passed an old Google Docs url as the key! Attempting to parse.");
      this.key = this.key.match("key=(.*?)(&|#|$)")[1];
    }

    if(/pubhtml/.test(this.key)) {
      this.log("You passed a new Google Spreadsheets url as the key! Attempting to parse.");
      this.key = this.key.match("d\\/(.*?)\\/pubhtml")[1];
    }

    if(!this.key) {
      this.log("You need to pass Tabletop a key!");
      return;
    }

    this.log("Initializing with key " + this.key);

    this.models = {};
    this.model_names = [];

    this.base_json_path = "/feeds/worksheets/" + this.key + "/public/basic?alt=";

    if (inNodeJS || supportsCORS) {
      this.base_json_path += 'json';
    } else {
      this.base_json_path += 'json-in-script';
    }
    
    if(!this.wait) {
      this.fetch();
    }
  };

  // A global storage for callbacks.
  Tabletop.callbacks = {};

  // Backwards compatibility.
  Tabletop.init = function(options) {
    return new Tabletop(options);
  };

  Tabletop.sheets = function() {
    this.log("Times have changed! You'll want to use var tabletop = Tabletop.init(...); tabletop.sheets(...); instead of Tabletop.sheets(...)");
  };

  Tabletop.prototype = {

    fetch: function(callback) {
      if(typeof(callback) !== "undefined") {
        this.callback = callback;
      }
      this.requestData(this.base_json_path, this.loadSheets);
    },
    
    /*
      This will call the environment appropriate request method.
      
      In browser it will use JSON-P, in node it will use request()
    */
    requestData: function(path, callback) {
      if (inNodeJS) {
        this.serverSideFetch(path, callback);
      } else {
        //CORS only works in IE8/9 across the same protocol
        //You must have your server on HTTPS to talk to Google, or it'll fall back on injection
        var protocol = this.endpoint.split("//").shift() || "http";
        if (supportsCORS && (!inLegacyIE || protocol === location.protocol)) {
          this.xhrFetch(path, callback);
        } else {
          this.injectScript(path, callback);
        }
      }
    },

    /*
      Use Cross-Origin XMLHttpRequest to get the data in browsers that support it.
    */
    xhrFetch: function(path, callback) {
      //support IE8's separate cross-domain object
      var xhr = inLegacyIE ? new XDomainRequest() : new XMLHttpRequest();
      xhr.open("GET", this.endpoint + path);
      var self = this;
      xhr.onload = function() {
        var json;
        try {
          json = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error(e);
        }
        callback.call(self, json);
      };
      xhr.send();
    },
    
    /*
      Insert the URL into the page as a script tag. Once it's loaded the spreadsheet data
      it triggers the callback. This helps you avoid cross-domain errors
      http://code.google.com/apis/gdata/samples/spreadsheet_sample.html

      Let's be plain-Jane and not use jQuery or anything.
    */
    injectScript: function(path, callback) {
      var script = document.createElement('script');
      var callbackName;
      
      if(this.singleton) {
        if(callback === this.loadSheets) {
          callbackName = 'Tabletop.singleton.loadSheets';
        } else if (callback === this.loadSheet) {
          callbackName = 'Tabletop.singleton.loadSheet';
        }
      } else {
        var self = this;
        callbackName = 'tt' + (+new Date()) + (Math.floor(Math.random()*100000));
        // Create a temp callback which will get removed once it has executed,
        // this allows multiple instances of Tabletop to coexist.
        Tabletop.callbacks[ callbackName ] = function () {
          var args = Array.prototype.slice.call( arguments, 0 );
          callback.apply(self, args);
          script.parentNode.removeChild(script);
          delete Tabletop.callbacks[callbackName];
        };
        callbackName = 'Tabletop.callbacks.' + callbackName;
      }
      
      var url = path + "&callback=" + callbackName;
      
      if(this.simple_url) {
        // We've gone down a rabbit hole of passing injectScript the path, so let's
        // just pull the sheet_id out of the path like the least efficient worker bees
        if(path.indexOf("/list/") !== -1) {
          script.src = this.endpoint + "/" + this.key + "-" + path.split("/")[4];
        } else {
          script.src = this.endpoint + "/" + this.key;
        }
      } else {
        script.src = this.endpoint + url;
      }
      
      if (this.parameterize) {
        script.src = this.parameterize + encodeURIComponent(script.src);
      }
      
      document.getElementsByTagName('script')[0].parentNode.appendChild(script);
    },
    
    /* 
      This will only run if tabletop is being run in node.js
    */
    serverSideFetch: function(path, callback) {
      var self = this;
      request({url: this.endpoint + path, json: true}, function(err, resp, body) {
        if (err) {
          return console.error(err);
        }
        callback.call(self, body);
      });
    },

    /* 
      Is this a sheet you want to pull?
      If { wanted: ["Sheet1"] } has been specified, only Sheet1 is imported
      Pulls all sheets if none are specified
    */
    isWanted: function(sheetName) {
      if(this.wanted.length === 0) {
        return true;
      } else {
        return (ttIndexOf(this.wanted, sheetName) !== -1);
      }
    },
    
    /*
      What gets send to the callback
      if simpleSheet === true, then don't return an array of Tabletop.this.models,
      only return the first one's elements
    */
    data: function() {
      // If the instance is being queried before the data's been fetched
      // then return undefined.
      if(this.model_names.length === 0) {
        return undefined;
      }
      if(this.simpleSheet) {
        if(this.model_names.length > 1 && this.debug) {
          this.log("WARNING You have more than one sheet but are using simple sheet mode! Don't blame me when something goes wrong.");
        }
        return this.models[ this.model_names[0] ].all();
      } else {
        return this.models;
      }
    },

    /*
      Add another sheet to the wanted list
    */
    addWanted: function(sheet) {
      if(ttIndexOf(this.wanted, sheet) === -1) {
        this.wanted.push(sheet);
      }
    },
    
    /*
      Load all worksheets of the spreadsheet, turning each into a Tabletop Model.
      Need to use injectScript because the worksheet view that you're working from
      doesn't actually include the data. The list-based feed (/feeds/list/key..) does, though.
      Calls back to loadSheet in order to get the real work done.

      Used as a callback for the worksheet-based JSON
    */
    loadSheets: function(data) {
      var i, ilen;
      var toLoad = [];
      this.googleSheetName = data.feed.title.$t;
      this.foundSheetNames = [];

      for(i = 0, ilen = data.feed.entry.length; i < ilen ; i++) {
        this.foundSheetNames.push(data.feed.entry[i].title.$t);
        // Only pull in desired sheets to reduce loading
        if( this.isWanted(data.feed.entry[i].content.$t) ) {
          var linkIdx = data.feed.entry[i].link.length-1;
          var sheet_id = data.feed.entry[i].link[linkIdx].href.split('/').pop();
          var json_path = "/feeds/list/" + this.key + "/" + sheet_id + "/public/values?alt=";
          if (inNodeJS || supportsCORS) {
            json_path += 'json';
          } else {
            json_path += 'json-in-script';
          }
          if(this.query) {
            json_path += "&sq=" + this.query;
          }
          if(this.orderby) {
            json_path += "&orderby=column:" + this.orderby.toLowerCase();
          }
          if(this.reverse) {
            json_path += "&reverse=true";
          }
          toLoad.push(json_path);
        }
      }

      this.sheetsToLoad = toLoad.length;
      for(i = 0, ilen = toLoad.length; i < ilen; i++) {
        this.requestData(toLoad[i], this.loadSheet);
      }
    },

    /*
      Access layer for the this.models
      .sheets() gets you all of the sheets
      .sheets('Sheet1') gets you the sheet named Sheet1
    */
    sheets: function(sheetName) {
      if(typeof sheetName === "undefined") {
        return this.models;
      } else {
        if(typeof(this.models[ sheetName ]) === "undefined") {
          // alert( "Can't find " + sheetName );
          return;
        } else {
          return this.models[ sheetName ];
        }
      }
    },

    sheetReady: function(model) {
      this.models[ model.name ] = model;
      if(ttIndexOf(this.model_names, model.name) === -1) {
        this.model_names.push(model.name);
      }

      this.sheetsToLoad--;
      if(this.sheetsToLoad === 0)
        this.doCallback();
    },
    
    /*
      Parse a single list-based worksheet, turning it into a Tabletop Model

      Used as a callback for the list-based JSON
    */
    loadSheet: function(data) {
      var that = this;
      var model = new Tabletop.Model( { data: data, 
                                        parseNumbers: this.parseNumbers,
                                        postProcess: this.postProcess,
                                        tabletop: this,
                                        prettyColumnNames: this.prettyColumnNames,
                                        onReady: function() {
                                          that.sheetReady(this);
                                        } } );
    },

    /*
      Execute the callback upon loading! Rely on this.data() because you might
        only request certain pieces of data (i.e. simpleSheet mode)
      Tests this.sheetsToLoad just in case a race condition happens to show up
    */
    doCallback: function() {
      if(this.sheetsToLoad === 0) {
        this.callback.apply(this.callbackContext || this, [this.data(), this]);
      }
    },

    log: function(msg) {
      if(this.debug) {
        if(typeof console !== "undefined" && typeof console.log !== "undefined") {
          Function.prototype.apply.apply(console.log, [console, arguments]);
        }
      }
    }

  };

  /*
    Tabletop.Model stores the attribute names and parses the worksheet data
      to turn it into something worthwhile

    Options should be in the format { data: XXX }, with XXX being the list-based worksheet
  */
  Tabletop.Model = function(options) {
    var i, j, ilen, jlen;
    this.column_names = [];
    this.name = options.data.feed.title.$t;
    this.tabletop = options.tabletop;
    this.elements = [];
    this.onReady = options.onReady;
    this.raw = options.data; // A copy of the sheet's raw data, for accessing minutiae

    if(typeof(options.data.feed.entry) === 'undefined') {
      options.tabletop.log("Missing data for " + this.name + ", make sure you didn't forget column headers");
      this.original_columns = [];
      this.elements = [];
      this.onReady.call(this);
      return;
    }
    
    for(var key in options.data.feed.entry[0]){
      if(/^gsx/.test(key))
        this.column_names.push( key.replace("gsx$","") );
    }

    this.original_columns = this.column_names;
    
    for(i = 0, ilen =  options.data.feed.entry.length ; i < ilen; i++) {
      var source = options.data.feed.entry[i];
      var element = {};
      for(j = 0, jlen = this.column_names.length; j < jlen ; j++) {
        var cell = source[ "gsx$" + this.column_names[j] ];
        if (typeof(cell) !== 'undefined') {
          if(options.parseNumbers && cell.$t !== '' && !isNaN(cell.$t))
            element[ this.column_names[j] ] = +cell.$t;
          else
            element[ this.column_names[j] ] = cell.$t;
        } else {
            element[ this.column_names[j] ] = '';
        }
      }
      if(element.rowNumber === undefined)
        element.rowNumber = i + 1;
      if( options.postProcess )
        options.postProcess(element);
      this.elements.push(element);
    }
    
    if(options.prettyColumnNames)
      this.fetchPrettyColumns();
    else
      this.onReady.call(this);
  };

  Tabletop.Model.prototype = {
    /*
      Returns all of the elements (rows) of the worksheet as objects
    */
    all: function() {
      return this.elements;
    },
    
    fetchPrettyColumns: function() {
      if(!this.raw.feed.link[3])
        return this.ready();
      var cellurl = this.raw.feed.link[3].href.replace('/feeds/list/', '/feeds/cells/').replace('https://spreadsheets.google.com', '');
      var that = this;
      this.tabletop.requestData(cellurl, function(data) {
        that.loadPrettyColumns(data);
      });
    },
    
    ready: function() {
      this.onReady.call(this);
    },
    
    /*
     * Store column names as an object
     * with keys of Google-formatted "columnName"
     * and values of human-readable "Column name"
     */
    loadPrettyColumns: function(data) {
      var pretty_columns = {};

      var column_names = this.column_names;

      var i = 0;
      var l = column_names.length;

      for (; i < l; i++) {
        if (typeof data.feed.entry[i].content.$t !== 'undefined') {
          pretty_columns[column_names[i]] = data.feed.entry[i].content.$t;
        } else {
          pretty_columns[column_names[i]] = column_names[i];
        }
      }

      this.pretty_columns = pretty_columns;

      this.prettifyElements();
      this.ready();
    },
    
    /*
     * Go through each row, substitutiting
     * Google-formatted "columnName"
     * with human-readable "Column name"
     */
    prettifyElements: function() {
      var pretty_elements = [],
          ordered_pretty_names = [],
          i, j, ilen, jlen;

      for(j = 0, jlen = this.column_names.length; j < jlen ; j++) {
        ordered_pretty_names.push(this.pretty_columns[this.column_names[j]]);
      }

      for(i = 0, ilen = this.elements.length; i < ilen; i++) {
        var new_element = {};
        for(j = 0, jlen = this.column_names.length; j < jlen ; j++) {
          var new_column_name = this.pretty_columns[this.column_names[j]];
          new_element[new_column_name] = this.elements[i][this.column_names[j]];
        }
        pretty_elements.push(new_element);
      }
      this.elements = pretty_elements;
      this.column_names = ordered_pretty_names;
    },

    /*
      Return the elements as an array of arrays, instead of an array of objects
    */
    toArray: function() {
      var array = [],
          i, j, ilen, jlen;
      for(i = 0, ilen = this.elements.length; i < ilen; i++) {
        var row = [];
        for(j = 0, jlen = this.column_names.length; j < jlen ; j++) {
          row.push( this.elements[i][ this.column_names[j] ] );
        }
        array.push(row);
      }
      return array;
    }
  };

  if(typeof module !== "undefined" && module.exports) { //don't just use inNodeJS, we may be in Browserify
    module.exports = Tabletop;
  } else if (typeof define === 'function' && define.amd) {
    define(function () {
        return Tabletop;
    });
  } else {
    window.Tabletop = Tabletop;
  }

})();

/**
 * @ngdoc service
 * @name times.tabletop.Tabletop
 * @description Provider allowing easy config and return of Tabletop data in Angular.
 */
(function(){
'use strict';

angular.module('times.tabletop', [])
  .provider('Tabletop', function () {
    var tabletopResponse;

    var tabletopOptions = {
      callback: function(data, Tabletop) {
        tabletopResponse.resolve([data, Tabletop]);
      }
    };

    // Public API for configuration
    this.setTabletopOptions = function (opts) {
      tabletopOptions = angular.extend(tabletopOptions, opts);
    };

    // Method for instantiating
    this.$get = ['$q', '$window', function ($q, $window) {
      tabletopResponse = $q.defer();
      $window.Tabletop.init(tabletopOptions);

      return tabletopResponse.promise;
    }];
});
})();

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
                            registerMessage("Here are more suggestions for where to go in " + userDefaults.location + ".<br/ style='margin-bottom:5px;'>" + window.moreString.join(''));
                            waitingForResponse = false;
                            currentResponseCategory = null;
                            window.moreString = null;

                            // plug the exchange rate
                            var currencies = {"BD": "BDT", "BE": "EUR", "BF": "XOF", "BG": "BGN", "BA": "BAM", "BB": "BBD", "WF": "XPF", "BL": "EUR", "BM": "BMD", "BN": "BND", "BO": "BOB", "BH": "BHD", "BI": "BIF", "BJ": "XOF", "BT": "BTN", "JM": "JMD", "BV": "NOK", "BW": "BWP", "WS": "WST", "BQ": "USD", "BR": "BRL", "BS": "BSD", "JE": "GBP", "BY": "BYR", "BZ": "BZD", "RU": "RUB", "RW": "RWF", "RS": "RSD", "TL": "USD", "RE": "EUR", "TM": "TMT", "TJ": "TJS", "RO": "RON", "TK": "NZD", "GW": "XOF", "GU": "USD", "GT": "GTQ", "GS": "GBP", "GR": "EUR", "GQ": "XAF", "GP": "EUR", "JP": "JPY", "GY": "GYD", "GG": "GBP", "GF": "EUR", "GE": "GEL", "GD": "XCD", "GB": "GBP", "GA": "XAF", "SV": "USD", "GN": "GNF", "GM": "GMD", "GL": "DKK", "GI": "GIP", "GH": "GHS", "OM": "OMR", "TN": "TND", "JO": "JOD", "HR": "HRK", "HT": "HTG", "HU": "HUF", "HK": "HKD", "HN": "HNL", "HM": "AUD", "VE": "VEF", "PR": "USD", "PS": "ILS", "PW": "USD", "PT": "EUR", "SJ": "NOK", "PY": "PYG", "IQ": "IQD", "PA": "PAB", "PF": "XPF", "PG": "PGK", "PE": "PEN", "PK": "PKR", "PH": "PHP", "PN": "NZD", "PL": "PLN", "PM": "EUR", "ZM": "ZMK", "EH": "MAD", "EE": "EUR", "EG": "EGP", "ZA": "ZAR", "EC": "USD", "IT": "EUR", "VN": "VND", "SB": "SBD", "ET": "ETB", "SO": "SOS", "ZW": "ZWL", "SA": "SAR", "ES": "EUR", "ER": "ERN", "ME": "EUR", "MD": "MDL", "MG": "MGA", "MF": "EUR", "MA": "MAD", "MC": "EUR", "UZ": "UZS", "MM": "MMK", "ML": "XOF", "MO": "MOP", "MN": "MNT", "MH": "USD", "MK": "MKD", "MU": "MUR", "MT": "EUR", "MW": "MWK", "MV": "MVR", "MQ": "EUR", "MP": "USD", "MS": "XCD", "MR": "MRO", "IM": "GBP", "UG": "UGX", "TZ": "TZS", "MY": "MYR", "MX": "MXN", "IL": "ILS", "FR": "EUR", "IO": "USD", "SH": "SHP", "FI": "EUR", "FJ": "FJD", "FK": "FKP", "FM": "USD", "FO": "DKK", "NI": "NIO", "NL": "EUR", "NO": "NOK", "NA": "NAD", "VU": "VUV", "NC": "XPF", "NE": "XOF", "NF": "AUD", "NG": "NGN", "NZ": "NZD", "NP": "NPR", "NR": "AUD", "NU": "NZD", "CK": "NZD", "XK": "EUR", "CI": "XOF", "CH": "CHF", "CO": "COP", "CN": "CNY", "CM": "XAF", "CL": "CLP", "CC": "AUD", "CA": "CAD", "CG": "XAF", "CF": "XAF", "CD": "CDF", "CZ": "CZK", "CY": "EUR", "CX": "AUD", "CR": "CRC", "CW": "ANG", "CV": "CVE", "CU": "CUP", "SZ": "SZL", "SY": "SYP", "SX": "ANG", "KG": "KGS", "KE": "KES", "SS": "SSP", "SR": "SRD", "KI": "AUD", "KH": "KHR", "KN": "XCD", "KM": "KMF", "ST": "STD", "SK": "EUR", "KR": "KRW", "SI": "EUR", "KP": "KPW", "KW": "KWD", "SN": "XOF", "SM": "EUR", "SL": "SLL", "SC": "SCR", "KZ": "KZT", "KY": "KYD", "SG": "SGD", "SE": "SEK", "SD": "SDG", "DO": "DOP", "DM": "XCD", "DJ": "DJF", "DK": "DKK", "VG": "USD", "DE": "EUR", "YE": "YER", "DZ": "DZD", "US": "USD", "UY": "UYU", "YT": "EUR", "UM": "USD", "LB": "LBP", "LC": "XCD", "LA": "LAK", "TV": "AUD", "TW": "TWD", "TT": "TTD", "TR": "TRY", "LK": "LKR", "LI": "CHF", "LV": "EUR", "TO": "TOP", "LT": "LTL", "LU": "EUR", "LR": "LRD", "LS": "LSL", "TH": "THB", "TF": "EUR", "TG": "XOF", "TD": "XAF", "TC": "USD", "LY": "LYD", "VA": "EUR", "VC": "XCD", "AE": "AED", "AD": "EUR", "AG": "XCD", "AF": "AFN", "AI": "XCD", "VI": "USD", "IS": "ISK", "IR": "IRR", "AM": "AMD", "AL": "ALL", "AO": "AOA", "AQ": "", "AS": "USD", "AR": "ARS", "AU": "AUD", "AT": "EUR", "AW": "AWG", "IN": "INR", "AX": "EUR", "AZ": "AZN", "IE": "EUR", "ID": "IDR", "UA": "UAH", "QA": "QAR", "MZ": "MZN"};
                            var xeURL = "https://hackthenorth069:Waterloo31969@xecdapi.xe.com/v1/convert_from.json/?from=" + currencies[userDefaults.originalCountry] + "&to=" + currencies[userDefaults.destinationCountry] + "&amount=100";
                            console.log(xeURL);
                            $http.get(xeURL, {params: parameters}).success(function(response){
                                console.log("omg?", response);
                            });
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

                                console.log("hi");
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
                                });
                                break;
                            default:
                                currentResponseCategory = null;
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

        registerMessage("Hi, I'm Eve, your personal travel assistant. What's your name?", null, { category: "name" });


        $timeout(function(){
            $element.addClass('loaded'); 
        },1250);
    }]);
})(); 
