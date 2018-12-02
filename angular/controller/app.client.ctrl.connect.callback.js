"use strict";

define(["app.client"], function(client) {
  client.controller("connectCallbackCtrl", function(
    $scope,
    $rootScope,
    $routeParams,
    $location,
    $cookies,
    $httpParamSerializer
  ) {
    $scope.resultPending = true;
    $scope.isConnected = false;

    var sourceId = $routeParams.sourceId;

    $rootScope.user(
      user => {
        if ($routeParams.code) {
          $rootScope.sources(
            sources => {
              for (let i in sources) {
                if (sources[i].id == sourceId) {
                  $scope.source = sources[i];
                  $scope.$apply();
                  break;
                }
              }
            },
            () => {}
          );
          $.post("api/source/" + sourceId + "/finish_connect", {
            uid: user.uid,
            code: $routeParams.code
          })
            .done(data => {
              $rootScope.loggedInUser = data;
              $scope.resultPending = false;
              $scope.isConnected = true;
              $scope.$apply();
            })
            .fail((xhr, textStatus, error) => {
              $scope.resultPending = false;
              console.log(xhr.responseText);
              $scope.$apply();
            });
        } else {
          $scope.resultPending = false;
        }
      },
      () => {
        $location.url("/login?callback=connect");
        $location.replace();
        $scope.$apply();
      }
    );

    $scope.onSuccess = function() {
      var callback = $cookies.get("app.client.data." + sourceId + ".callback");
      if (callback) {
        $cookies.remove("app.client.data." + sourceId + ".callback");
        $location.url(callback);
      } else {
        $location.url(
          "/connect?" + $httpParamSerializer({ forceUpdate: true })
        );
      }
      $location.replace();
    };
    $scope.onFail = function() {
      $location.url(
        "/connect?" +
          $httpParamSerializer({ forceUpdate: true, updateSources: sourceId })
      );
      $location.replace();
    };
  });
});
