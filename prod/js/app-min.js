!function(){"use strict";var e=!1;if("undefined"!=typeof process&&!process.browser){e=!0;var t=require("request".trim())}var n=!1,s=!1;try{var o=new XMLHttpRequest;"undefined"!=typeof o.withCredentials?n=!0:"XDomainRequest"in window&&(n=!0,s=!0)}catch(e){}var i=Array.prototype.indexOf,a=function(e,t){var n=0,s=e.length;if(i&&e.indexOf===i)return e.indexOf(t);for(;n<s;n++)if(e[n]===t)return n;return-1},r=function(t){return this&&this instanceof r?("string"==typeof t&&(t={key:t}),this.callback=t.callback,this.wanted=t.wanted||[],this.key=t.key,this.simpleSheet=!!t.simpleSheet,this.parseNumbers=!!t.parseNumbers,this.wait=!!t.wait,this.reverse=!!t.reverse,this.postProcess=t.postProcess,this.debug=!!t.debug,this.query=t.query||"",this.orderby=t.orderby,this.endpoint=t.endpoint||"https://spreadsheets.google.com",this.singleton=!!t.singleton,this.simple_url=!!t.simple_url,this.callbackContext=t.callbackContext,this.prettyColumnNames="undefined"==typeof t.prettyColumnNames?!t.proxy:t.prettyColumnNames,"undefined"!=typeof t.proxy&&(this.endpoint=t.proxy.replace(/\/$/,""),this.simple_url=!0,this.singleton=!0,n=!1),this.parameterize=t.parameterize||!1,this.singleton&&("undefined"!=typeof r.singleton&&this.log("WARNING! Tabletop singleton already defined"),r.singleton=this),/key=/.test(this.key)&&(this.log("You passed an old Google Docs url as the key! Attempting to parse."),this.key=this.key.match("key=(.*?)(&|#|$)")[1]),/pubhtml/.test(this.key)&&(this.log("You passed a new Google Spreadsheets url as the key! Attempting to parse."),this.key=this.key.match("d\\/(.*?)\\/pubhtml")[1]),this.key?(this.log("Initializing with key "+this.key),this.models={},this.model_names=[],this.base_json_path="/feeds/worksheets/"+this.key+"/public/basic?alt=",e||n?this.base_json_path+="json":this.base_json_path+="json-in-script",void(this.wait||this.fetch())):void this.log("You need to pass Tabletop a key!")):new r(t)};r.callbacks={},r.init=function(e){return new r(e)},r.sheets=function(){this.log("Times have changed! You'll want to use var tabletop = Tabletop.init(...); tabletop.sheets(...); instead of Tabletop.sheets(...)")},r.prototype={fetch:function(e){"undefined"!=typeof e&&(this.callback=e),this.requestData(this.base_json_path,this.loadSheets)},requestData:function(t,o){if(e)this.serverSideFetch(t,o);else{var i=this.endpoint.split("//").shift()||"http";!n||s&&i!==location.protocol?this.injectScript(t,o):this.xhrFetch(t,o)}},xhrFetch:function(e,t){var n=s?new XDomainRequest:new XMLHttpRequest;n.open("GET",this.endpoint+e);var o=this;n.onload=function(){var e;try{e=JSON.parse(n.responseText)}catch(e){console.error(e)}t.call(o,e)},n.send()},injectScript:function(e,t){var n,s=document.createElement("script");if(this.singleton)t===this.loadSheets?n="Tabletop.singleton.loadSheets":t===this.loadSheet&&(n="Tabletop.singleton.loadSheet");else{var o=this;n="tt"+ +new Date+Math.floor(1e5*Math.random()),r.callbacks[n]=function(){var e=Array.prototype.slice.call(arguments,0);t.apply(o,e),s.parentNode.removeChild(s),delete r.callbacks[n]},n="Tabletop.callbacks."+n}var i=e+"&callback="+n;this.simple_url?e.indexOf("/list/")!==-1?s.src=this.endpoint+"/"+this.key+"-"+e.split("/")[4]:s.src=this.endpoint+"/"+this.key:s.src=this.endpoint+i,this.parameterize&&(s.src=this.parameterize+encodeURIComponent(s.src)),document.getElementsByTagName("script")[0].parentNode.appendChild(s)},serverSideFetch:function(e,n){var s=this;t({url:this.endpoint+e,json:!0},function(e,t,o){return e?console.error(e):void n.call(s,o)})},isWanted:function(e){return 0===this.wanted.length||a(this.wanted,e)!==-1},data:function(){if(0!==this.model_names.length)return this.simpleSheet?(this.model_names.length>1&&this.debug&&this.log("WARNING You have more than one sheet but are using simple sheet mode! Don't blame me when something goes wrong."),this.models[this.model_names[0]].all()):this.models},addWanted:function(e){a(this.wanted,e)===-1&&this.wanted.push(e)},loadSheets:function(t){var s,o,i=[];for(this.googleSheetName=t.feed.title.$t,this.foundSheetNames=[],s=0,o=t.feed.entry.length;s<o;s++)if(this.foundSheetNames.push(t.feed.entry[s].title.$t),this.isWanted(t.feed.entry[s].content.$t)){var a=t.feed.entry[s].link.length-1,r=t.feed.entry[s].link[a].href.split("/").pop(),l="/feeds/list/"+this.key+"/"+r+"/public/values?alt=";l+=e||n?"json":"json-in-script",this.query&&(l+="&sq="+this.query),this.orderby&&(l+="&orderby=column:"+this.orderby.toLowerCase()),this.reverse&&(l+="&reverse=true"),i.push(l)}for(this.sheetsToLoad=i.length,s=0,o=i.length;s<o;s++)this.requestData(i[s],this.loadSheet)},sheets:function(e){return"undefined"==typeof e?this.models:"undefined"==typeof this.models[e]?void 0:this.models[e]},sheetReady:function(e){this.models[e.name]=e,a(this.model_names,e.name)===-1&&this.model_names.push(e.name),this.sheetsToLoad--,0===this.sheetsToLoad&&this.doCallback()},loadSheet:function(e){var t=this;new r.Model({data:e,parseNumbers:this.parseNumbers,postProcess:this.postProcess,tabletop:this,prettyColumnNames:this.prettyColumnNames,onReady:function(){t.sheetReady(this)}})},doCallback:function(){0===this.sheetsToLoad&&this.callback.apply(this.callbackContext||this,[this.data(),this])},log:function(e){this.debug&&"undefined"!=typeof console&&"undefined"!=typeof console.log&&Function.prototype.apply.apply(console.log,[console,arguments])}},r.Model=function(e){var t,n,s,o;if(this.column_names=[],this.name=e.data.feed.title.$t,this.tabletop=e.tabletop,this.elements=[],this.onReady=e.onReady,this.raw=e.data,"undefined"==typeof e.data.feed.entry)return e.tabletop.log("Missing data for "+this.name+", make sure you didn't forget column headers"),this.original_columns=[],this.elements=[],void this.onReady.call(this);for(var i in e.data.feed.entry[0])/^gsx/.test(i)&&this.column_names.push(i.replace("gsx$",""));for(this.original_columns=this.column_names,t=0,s=e.data.feed.entry.length;t<s;t++){var a=e.data.feed.entry[t],r={};for(n=0,o=this.column_names.length;n<o;n++){var l=a["gsx$"+this.column_names[n]];"undefined"!=typeof l?e.parseNumbers&&""!==l.$t&&!isNaN(l.$t)?r[this.column_names[n]]=+l.$t:r[this.column_names[n]]=l.$t:r[this.column_names[n]]=""}void 0===r.rowNumber&&(r.rowNumber=t+1),e.postProcess&&e.postProcess(r),this.elements.push(r)}e.prettyColumnNames?this.fetchPrettyColumns():this.onReady.call(this)},r.Model.prototype={all:function(){return this.elements},fetchPrettyColumns:function(){if(!this.raw.feed.link[3])return this.ready();var e=this.raw.feed.link[3].href.replace("/feeds/list/","/feeds/cells/").replace("https://spreadsheets.google.com",""),t=this;this.tabletop.requestData(e,function(e){t.loadPrettyColumns(e)})},ready:function(){this.onReady.call(this)},loadPrettyColumns:function(e){for(var t={},n=this.column_names,s=0,o=n.length;s<o;s++)"undefined"!=typeof e.feed.entry[s].content.$t?t[n[s]]=e.feed.entry[s].content.$t:t[n[s]]=n[s];this.pretty_columns=t,this.prettifyElements(),this.ready()},prettifyElements:function(){var e,t,n,s,o=[],i=[];for(t=0,s=this.column_names.length;t<s;t++)i.push(this.pretty_columns[this.column_names[t]]);for(e=0,n=this.elements.length;e<n;e++){var a={};for(t=0,s=this.column_names.length;t<s;t++){var r=this.pretty_columns[this.column_names[t]];a[r]=this.elements[e][this.column_names[t]]}o.push(a)}this.elements=o,this.column_names=i},toArray:function(){var e,t,n,s,o=[];for(e=0,n=this.elements.length;e<n;e++){var i=[];for(t=0,s=this.column_names.length;t<s;t++)i.push(this.elements[e][this.column_names[t]]);o.push(i)}return o}},"undefined"!=typeof module&&module.exports?module.exports=r:"function"==typeof define&&define.amd?define(function(){return r}):window.Tabletop=r}(),function(){"use strict";angular.module("times.tabletop",[]).provider("Tabletop",function(){var e,t={callback:function(t,n){e.resolve([t,n])}};this.setTabletopOptions=function(e){t=angular.extend(t,e)},this.$get=["$q","$window",function(n,s){return e=n.defer(),s.Tabletop.init(t),e.promise}]})}(),function(){"use strict";angular.module("Site",["ngAnimate","times.tabletop","ngSanitize","luegg.directives"]).config(["TabletopProvider",function(e){e.setTabletopOptions({key:"1nWRFI2iLEt8onPB_5HSjTBjLZ_wfRaEdmsa7CeFUiLE",simple_url:!0})}]).factory("DialoguePortfolioParser",[function(){var e={parse:function(e){var t={};return t.dialogue=[],_.each(e[0].Dialogue.elements,function(e){t.dialogue.push({possibleInputs:e.possibleInputs.split(","),response:e.response})}),t.portfolio=e[0].Portfolio.elements,t}};return e}]).factory("GrantsAge",[function(){var e=new Date,t=e.getMonth()+1,n=e.getFullYear(),s=e.getDay(),o=n-1995;return 12>t?o-=1:2>s&&(o-=1),o.toString()}]).factory("GetLocation",["$http","$q",function(e,t){var n,s=t.defer(),o=e({method:"JSONP",url:"https://geoip-db.com/json/geoip.php?jsonp=JSON_CALLBACK"}).success(function(e){n=e.city+", "+e.state+", "+e.country_name}).error(function(e){n="unknown"}),i=function(){s.resolve(n)};return n?i():o.then(function(){i()}),s.promise}]).factory("Weather",["$http","$q",function(e,t){var n,s=t.defer(),o=e.get("http://api.wunderground.com/api/c1ea49b3e06dc3b3/geolookup/conditions/q/MA/Amherst.json").then(function(e){var t=e.data,s=t.location.city,o=t.current_observation.temp_f;n="The current temperature in "+s+" is: "+o+"&deg;F &#128513;",50>o&&(n="Brrr! The current temperature in "+s+" is: "+o+"&deg:F &#128559;")},function(e){console.error(e),n="I don't have a clue actually..."}),i=function(){s.resolve(n)};return n?i():o.then(function(){i()}),s.promise}]).controller("Dialogue",["$sce","$element","$timeout","$q","$scope","Tabletop","DialoguePortfolioParser","Weather","GetLocation","GrantsAge","$http",function(e,t,n,s,o,i,a,r,l,h,u){var c,d,p,f;const m="0AUrbvhzjfJK2qMF8icRQg",y="xaPE05PudxXyU8pOKTmqrK5xtig",g="w-OadXdo_jEomxZHw8HClmRExZJhVYSO",b="KGf-o-UdPhcJps_NghLwaDJqTMQ",v="http://api.yelp.com/v2/search";var k=function(e){for(var t=s.defer(),n=0;n<d.length;n++)for(var o=0;o<d[n].possibleInputs.length;o++)if(e.toLowerCase().indexOf(d[n].possibleInputs[o].toLowerCase())!==-1)return t.resolve({response:d[n].response,i:n,j:o}),t.promise;return t.reject("Sorry, I can't respond to that."),t.promise};o.lock=!1;var _=function(e,t,i){i&&(p=!0,f=i.category);var a=s.defer();return p&&(t||o.lock?o.lock||(o.messageQueue.push({sender:t?t:"Grant",message:e}),a.resolve()):(o.lock=!0,n(function(){o.messageQueue.push({sender:t?t:"Grant",message:e}),a.resolve()},900).then(function(){o.lock=!1}))),a.promise};o.trustAsHtml=function(t){return e.trustAsHtml(t)},o.dialogue=!0,o.buttonClicked=function(){},o.currentUser={text:""};var w={},S=function(e){for(var t="",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",s=0;s<e;s++)t+=n.charAt(Math.floor(Math.random()*n.length));return t};o.messageQueue=[],o.send=function(e){if(!o.lock&&e)if(p){if(_(e,"user"),t.find("input").val(""),o.currentUser.text=null,f)switch(f){case"name":w.username=e,_("Hello "+e+"! How are you today?",null,{category:"feeling"});break;case"feeling":w.feeling=e,_("Awesome!").then(function(){n(function(){_("Where are you headed "+w.username+"?",null,{category:"location"})},300)});break;case"location":w.location=e;var s=new Date,i=s.getTime(),a="GET",l={callback:"angular.callbacks._0",oauth_consumer_key:m,location:w.location,oauth_token:g,oauth_nonce:S(10),oauth_timestamp:i,oauth_signature_method:"HMAC-SHA1",oauth_version:"1.0"},c=oauthSignature.generate(a,v,l,y,b,{encodeSignature:!1});l.oauth_signature=c,u.jsonp(v,{params:l}).then(function(e){_(e.data)}),_("Great!");break;default:_("Sorry, I can't respond to that.")}}else _(e,"user"),t.find("input").val(""),o.currentUser.text=null,k(e).then(function(e){switch(e.response){case"E.AGE":_(h);break;case"E.WEATHER":r.then(function(e){_(e)});break;default:_(e.response)}},function(e){_(e)})},i.then(function(e){var t=s.defer();return e?t.resolve(e):t.reject("Could not retrieve data"),t.promise}).then(function(e){c=a.parse(e),d=c.dialogue},function(e){console.error(e)}),_("Hi, I'm TravelBot. What's your name?",null,{category:"name"}),n(function(){t.addClass("loaded")},1250)}])}();