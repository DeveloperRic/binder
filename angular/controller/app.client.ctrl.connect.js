"use strict";

define(["app.client"], function(client) {
  client.controller("connectCtrl", function(
    $scope,
    $rootScope,
    $routeParams,
    $http,
    $window,
    $cookies
  ) {
    $rootScope.user(
      user => {
        if (user.connectedSources.length > 0 && !$routeParams.forceUpdate) {
          $window.location.href = "/dashboard";
          $rootScope.$apply();
          return;
        }
        $rootScope.sources(
          sources => {
            sources.forEach(source => {
              $scope.sourceConnected[
                source.id
              ] = user.connectedSources.includes(source.id);
            });
            $scope.hasConnected = user.connectedSources.length > 0;
            if ($routeParams.updateSources) {
              if (typeof $routeParams.updateSources == Array) {
                $routeParams.updateSources.forEach(source => {
                  $scope.sourceConnected[source] = false;
                  $scope.forceUpdate.push(source);
                });
              } else {
                $scope.sourceConnected[$routeParams.updateSources] = false;
                $scope.forceUpdate.push($routeParams.updateSources);
              }
            }
            $rootScope.$apply();
          },
          () => {
            $rootScope.showPopup("error", "Couldn't load sources");
          }
        );
      },
      () => {
        $window.location.href = "/login";
      }
    );

    $scope.redirectReady = false;
    $scope.redirectURL = "";
    $scope.selected = null;
    $scope.onSelect = function(sourceId) {
      $scope.selected = $rootScope.getSource(sourceId);
      $http
        .post("api/source/" + sourceId + "/begin_connect", {
          uid: $rootScope.user().uid,
          forceUpdate: $scope.forceUpdate.includes(sourceId)
        })
        .then(
          response => {
            if (response.status == 206) {
              $scope.redirectReady = true;
              $scope.redirectURL = response.data;
            } else {
              $scope.onConnect();
            }
          },
          error => {
            $rootScope.showPopup(
              "error",
              "Couldn't get connection URL (" + error.status + ")",
              error.data
            );
          }
        );
    };
    $scope.onRedirect = () => {
      $cookies.put(
        "app.client.data." + $scope.selected.id + ".callback",
        "/connect?forceUpdate=true"
      );
      $window.open($scope.redirectURL, "_self");
    };
    $scope.responseReady = false;
    $scope.authcode = "";
    $scope.onResponse = () => {
      $http
        .post("api/source/" + $scope.selected.id + "/finish_connect", {
          uid: $rootScope.user().uid,
          code: $scope.authcode
        })
        .then(
          response => {
            $rootScope.loggedInUser = response.data;
            $scope.onConnect($scope.selected.id);
          },
          error => {
            $rootScope.showPopup(
              "error",
              "Couldn't confirm the connection (" + error.status + ")",
              error.data
            );
          }
        );
    };
    $scope.hasConnected = false;
    $scope.onConnect = function(sourceid) {
      $scope.responseReady = false;
      $scope.authcode = "";
      $scope.redirectReady = false;
      $scope.sourceConnected[sourceid] = true;
      $scope.hasConnected = true;
    };
    $scope.forceUpdate = [];
    $scope.sourceConnected = {
      gdrive: false,
      onedrive: false,
      onedrive365: false
    };
    $scope.onContinue = function() {
      if ($routeParams.callback) {
        $window.location.href = $routeParams.callback;
      } else {
        $window.location.href = "/dashboard";
      }
    };
  });
});
