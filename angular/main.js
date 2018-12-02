require.config({
  baseUrl: "/angular"
});

require([
  "https://ajax.googleapis.com/ajax/libs/angularjs/1.7.2/angular.min.js",
  "https://ajax.googleapis.com/ajax/libs/jquery/3.2.0/jquery.min.js"
], function() {
  console.log("loaded1");
  require([
    "https://ajax.googleapis.com/ajax/libs/angularjs/1.7.2/angular-route.js",
    "https://ajax.googleapis.com/ajax/libs/angularjs/1.7.2/angular-cookies.js",,
    "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js",
    "../modules/angular-bootstrap-contextmenu/contextMenu.js",
    "../modules/angular-inview/angular-inview.js",
    "controller/app.client.ctrl.connect",
    "controller/app.client.ctrl.dashboard",
    "controller/app.client.ctrl.files",
    "controller/app.client.ctrl.login",
    "controller/app.client.ctrl.settings",
    "controller/app.client.ctrl.welcome",
    "routeResolver"
  ], function() {
    console.log("loaded2");
    angular.bootstrap(document, ["client"]);
  });
});
