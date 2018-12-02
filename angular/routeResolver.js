"use strict";

define([], function() {
  var routeResolver = function() {
    this.$get = function() {
      return this;
    };

    this.routeConfig = (function() {
      var viewsDirectory = "/html/",
        controllersDirectory = "/angular/controller/",
        setBaseDirectories = function(viewsDir, controllersDir) {
          viewsDirectory = viewsDir;
          controllersDirectory = controllersDir;
        },
        getViewsDirectory = function() {
          return viewsDirectory;
        },
        getControllersDirectory = function() {
          return controllersDirectory;
        };

      return {
        setBaseDirectories: setBaseDirectories,
        getControllersDirectory: getControllersDirectory,
        getViewsDirectory: getViewsDirectory
      };
    })();

    this.route = (function(routeConfig) {
      var resolve = function(baseName, title, path, secure) {
          if (!path) path = "app.client.stage.";

          baseName = baseName.replace(/([A-Z])/g, (g) => `.${g[0].toLowerCase()}`);

          var routeDef = {};
          routeDef.templateUrl =
            routeConfig.getViewsDirectory() + path + baseName + ".html";
          routeDef.controller = baseName + "Ctrl";
          routeDef.title = title;
          routeDef.secure = secure ? secure : false;
          routeDef.resolve = {
            load: [
              "$q",
              "$rootScope",
              function($q, $rootScope) {
                var dependencies = [
                  routeConfig.getControllersDirectory() + "app.client.ctrl." + baseName + ".js"
                ];
                return resolveDependencies($q, $rootScope, dependencies);
              }
            ]
          };

          return routeDef;
        },
        resolveDependencies = function($q, $rootScope, dependencies) {
          var defer = $q.defer();
          require(dependencies, function() {
            defer.resolve();
            $rootScope.$apply();
          });

          return defer.promise;
        };

      return {
        resolve: resolve
      };
    })(this.routeConfig);
  };

  var servicesApp = angular.module("routeResolverServices", []);

  //Must be a provider since it will be injected into module.config()
  servicesApp.provider("routeResolver", routeResolver);
});
