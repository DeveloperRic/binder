"use strict";

define(["app.client"], function(client) {
  client.controller("welcomeCtrl", function(
    $scope,
    $rootScope,
    $window
  ) {
    // lets assume that no cookies have been stored (for now)
    // var encrptedUsername = $cookieStore.get("username");
    // console.log(encrptedUsername);
    $rootScope.user(() => {
      $window.location.href = "/dashboard";
    });

    $rootScope.hideNavBar = true;

    $scope.email = "";
    $scope.password = "";
    $scope.passwordconfirm = "";
    $scope.error = {
      exists: false,
      message: []
    };
    $scope.postError = function(message) {
      $scope.error.exists = true;
      $scope.error.message.length = 0;
      if (typeof message != "string") {
        message.forEach(line => $scope.error.message.push(line));
      } else {
        $scope.error.message = [message];
      }
    };
    $scope.onEmailExit = function() {
      $scope.emailInvalid = false;
      $scope.error.exists = false;
      if (!$rootScope.validateEmail($scope.email)) {
        $scope.emailInvalid = true;
        $scope.postError("Please enter a valid email address.");
      }
    };
    $scope.onPasswordExit = function() {
      $scope.error.exists = false;
      var passwordMessage = $rootScope.validatePassword(
        $scope.password,
        $scope.passwordconfirm
      );
      $scope.passwordInvalid = !!passwordMessage;
      if ($scope.passwordInvalid) {
        $scope.postError(passwordMessage);
      }
    };
    $scope.showDisclaimers = function() {
      $scope.error.exists = false;
      $scope.emailInvalid = false;
      $scope.passwordInvalid = false;
      if (!$rootScope.validateEmail($scope.email)) {
        $scope.emailInvalid = true;
        $scope.postError("Please enter a valid email address.");
        return;
      }
      var passwordMessage = $rootScope.validatePassword(
        $scope.password,
        $scope.passwordconfirm
      );
      $scope.passwordInvalid = !!passwordMessage;
      if ($scope.passwordInvalid) {
        $scope.postError(passwordMessage);
        return;
      }
      $scope.disclaimerShown = true;
    };
    $scope.hideDisclaimers = function() {
      $scope.disclaimerShown = false;
    };
    var yearDuration = new Date();
    yearDuration.setFullYear(yearDuration.getFullYear() + 1);
    $scope.loginDurations = [
      ["1 hour", 3600],
      ["1 week", 604800],
      ["1 year", (yearDuration.getTime() - new Date().getTime()) / 1000]
    ];
    $scope.selectedLoginDuration = -1;
    $scope.selectLoginDuration = function(i) {
      $scope.selectedLoginDuration = i;
    };
    $scope.createAccount = function() {
      var expiration = $rootScope.userSessionExpiration(
        $scope.loginDurations[$scope.selectedLoginDuration][1]
      );
      $.post("api/user/new_user", {
        email: $scope.email,
        password: $scope.password,
        expiration: expiration
      })
        .done(function(data) {
          $rootScope.loggedInUser = data.user;
          $rootScope.userSession(data.user.uid, data.sessionKey, expiration);
          $window.location.href = "/connect";
          $scope.$apply();
        })
        .fail(function(xhr, textStatus, error) {
          $scope.postError("That email address is already being used.");
          $scope.$apply();
        });
    };
    $scope.login = function() {
      $window.location.href = "/login";
    };
  });
});
