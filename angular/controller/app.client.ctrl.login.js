"use strict";

define(["app.client"], function(client) {
  client.controller("loginCtrl", function(
    $scope,
    $rootScope,
    $routeParams,
    $window,
    $interval,
    $cookies
  ) {
    $rootScope.user(() => {
      $window.location.href = "/dashboard";
    });

    $rootScope.hideNavBar = true;

    $scope.email = "";
    $scope.password = "";
    $scope.error = {
      exists: false,
      message: ""
    };
    $scope.postError = function(message) {
      $scope.error.exists = true;
      $scope.error.message = message;
    };
    $scope.onEmailExit = function() {
      $scope.emailInvalid = false;
      $scope.error.exists = false;
      if (!$rootScope.validateEmail($scope.email)) {
        $scope.emailInvalid = true;
        $scope.postError("Please enter a valid email address.");
      }
    };
    var yearDuration = new Date();
    yearDuration.setFullYear(yearDuration.getFullYear() + 1);
    $scope.loginDurations = [
      ["1 hour", 3600],
      ["1 week", 604800],
      ["1 year", (yearDuration.getTime() - new Date().getTime()) / 1000]
    ];
    $scope.selectedLoginDuration = 0;
    $scope.selectLoginDuration = function(i) {
      $scope.selectedLoginDuration = i;
    };
    if (!!$cookies.get("app.client.data.defaultLoginDuration")) {
      var cookieSetDuration = parseInt(
        $cookies.get("app.client.data.defaultLoginDuration")
      );
      if (cookieSetDuration < $scope.loginDurations[1][1]) {
        $scope.selectedLoginDuration = 0;
      } else if (cookieSetDuration < $scope.loginDurations[2][1]) {
        $scope.selectedLoginDuration = 1;
      } else {
        $scope.selectedLoginDuration = 2;
      }
    }
    $scope.login = function() {
      $scope.error.exists = false;
      if (!$rootScope.validateEmail($scope.email)) {
        $scope.postError("Please enter a valid email address.");
        return;
      }
      if ($scope.password == "") {
        return;
      }
      var expiration = $rootScope.userSessionExpiration(
        $scope.loginDurations[$scope.selectedLoginDuration][1]
      );
      $.post("api/user/login_user", {
        email: $scope.email,
        password: $scope.password,
        expiration: expiration.toUTCString()
      })
        .done(function(data) {
          $rootScope.loggedInUser = data.user;
          $rootScope.userSession(data.user.uid, data.sessionKey, expiration);
          if ($routeParams.callback) {
            $window.location.href = $routeParams.callback;
          } else if (data.user.connectedSources.length > 0) {
            $window.location.href = "/dashboard";
          } else {
            $window.location.href = "/connect";
          }
          $scope.$apply();
        })
        .fail(function(xhr, textStatus, error) {
          $scope.postError("Incorrect username or password.");
          $interval(
            () => {
              $scope.error.exists = false;
            },
            5000,
            1
          );
          $scope.$apply();
        });
    };
  });
});
