"use strict";

define(["app.client"], function(client) {
  client.controller("settingsCtrl", function(
    $rootScope,
    $scope,
    $location,
    $http,
    $window,
    $cookies,
    $httpParamSerializer,
    $interval
  ) {
    $scope.sources = [];
    $scope.sourceConnectedWrapper = {};
    $scope.profile = {
      firstname: "",
      lastname: "",
      email: "",
      password: ""
    };
    $rootScope.user(
      user => {
        $scope.user = user;
        $.get("api/user/" + user.uid + "/navigation").done(navigation => {
          $rootScope.navButtons = navigation;
          $scope.$apply();
        });
        $rootScope.sources(
          sources => {
            $scope.sources = sources;
            sources.forEach(source => {
              $scope.sourceConnectedWrapper = Object.assign(
                $scope.sourceConnectedWrapper,
                {
                  [source.id]: user.connectedSources.includes(source.id)
                }
              );
            });
            $scope.$apply();
          },
          () => {}
        );
        $scope.profile.firstname = $scope.user.profile.firstname;
        $scope.profile.lastname = $scope.user.profile.lastname;
        $scope.profile.email = $scope.user.email;
      },
      () => {
        $location.url(
          "/login?" + $httpParamSerializer({ callback: $location.url() })
        );
        $location.replace();
      }
    );
    $scope.confirmSourceToggle = [];
    $scope.toggleSource = function(source) {
      if (!$scope.confirmSourceToggle.includes(source.id)) {
        $scope.confirmSourceToggle.push(source.id);
        $interval(
          () => {
            if ($scope.confirmSourceToggle.includes(source.id)) {
              $scope.confirmSourceToggle.splice(
                $scope.confirmSourceToggle.indexOf(source.id),
                1
              );
            }
          },
          3000,
          1
        );
        return;
      } else {
        $scope.confirmSourceToggle.splice(
          $scope.confirmSourceToggle.indexOf(source.id),
          1
        );
      }
      if ($rootScope.user().connectedSources.includes(source.id)) {
        $.post("api/source/" + source.id + "/disconnect", {
          uid: $rootScope.user().uid
        })
          .done(user => {
            $rootScope.loggedInUser = user;
            $scope.user = user;
            $scope.sourceConnectedWrapper[source.id] = false;
            $scope.$apply();
          })
          .fail(function(xhr, textStatus, error) {
            console.log(JSON.parse(xhr.responseText));
          });
      } else {
        $http
          .post("api/source/" + source.id + "/begin_connect", {
            uid: $rootScope.user().uid,
            forceUpdate: false
          })
          .then(
            response => {
              if (response.status == 206) {
                $cookies.put(
                  "app.client.data." + source.id + ".callback",
                  $location.url()
                );
                $window.open(response.data, "_self");
              } else {
                $rootScope.showPopup(
                  "info",
                  source.name + " is already connected"
                );
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
      }
    };
    $scope.confirmAccessLevel = [];
    $scope.setAccessLevel = function(newAccessLevel) {
      if ($rootScope.user().accessLevel != newAccessLevel) {
        if (!$scope.confirmAccessLevel.includes(newAccessLevel)) {
          $scope.confirmAccessLevel.push(newAccessLevel);
          $interval(
            () => {
              if ($scope.confirmAccessLevel.includes(newAccessLevel)) {
                $scope.confirmAccessLevel.splice(
                  $scope.confirmAccessLevel.indexOf(newAccessLevel),
                  1
                );
              }
            },
            3000,
            1
          );
          return;
        } else {
          $scope.confirmAccessLevel.splice(
            $scope.confirmAccessLevel.indexOf(newAccessLevel),
            1
          );
        }
        $.post("api/user/" + $rootScope.user().uid + "/set_access_level", {
          newAccessLevel: newAccessLevel
        })
          .done(res => {
            $rootScope.loggedInUser = res.user;
            $scope.user = res.user;
            $scope.sources.forEach(source => {
              $scope.sourceConnectedWrapper = Object.assign(
                $scope.sourceConnectedWrapper,
                {
                  [source.id]: $rootScope
                    .user()
                    .connectedSources.includes(source.id)
                }
              );
            });
            $scope.$apply();
            if (res.failedSources.length > 0) {
              $rootScope.showPopup(
                "error",
                "The following sources could not be updated:",
                res.failedSources.join(", ")
              );
            }
          })
          .fail(function(xhr, textStatus, error) {
            $rootScope.showPopup(
              "error",
              "Failed to change your access level settings"
            );
            console.log(xhr.responseText);
          });
      }
    };
    $scope.updateProfile = function() {
      $.post("api/user/" + $rootScope.user().uid + "/update_profile", {
        profile: {
          firstname: $scope.profile.firstname,
          lastname: $scope.profile.lastname
        }
      }).done(user => {
        $rootScope.loggedInUser = user;
        $scope.profileStatus = "Profile Updated!";
        $scope.$apply();
        $interval(
          () => {
            $scope.profileStatus = null;
          },
          5000,
          1
        );
      });
    };
    $scope.emailError = {
      exists: false
    };
    $scope.postEmailError = function(message) {
      $scope.emailError.exists = true;
      $scope.emailStatus = message;
    };
    $scope.onEmailExit = function() {
      $scope.emailError.exists = false;
      if (!$rootScope.validateEmail($scope.profile.email)) {
        $scope.postEmailError("Please enter a valid email address.");
      } else {
        $scope.emailStatus = null;
      }
    };
    $scope.updateEmail = function() {
      $scope.emailError.exists = false;
      if (!$rootScope.validateEmail($scope.profile.email)) {
        $scope.emailStatus = "Please enter a valid email address.";
        return;
      }
      if ($scope.profile.password == "") {
        return;
      }
      if ($scope.profile.email != $rootScope.user().email) {
        var oldEmailAddress = $rootScope.user().email;
        $.post("api/user/" + $rootScope.user().uid + "/update_email", {
          newEmail: $scope.profile.email,
          password: $scope.profile.password
        })
          .done(user => {
            $rootScope.loggedInUser = user;
            $scope.emailStatus = "Email Updated!";
            $scope.$apply();
            $interval(
              () => {
                $scope.emailStatus = null;
              },
              5000,
              1
            );
            $.post("api/email/emailChanged/send", {
              uid: user.uid,
              placeholders: {
                oldEmailAddress: oldEmailAddress,
                newEmailAddress: user.profile.email
              }
            });
          })
          .fail((xhr, textStatus, error) => {
            switch (xhr.status) {
              case 403:
                $scope.emailStatus = "That email is already taken";
                break;
              case 401:
                $scope.emailStatus = "Incorrect password";
                break;
              default:
                $scope.emailStatus = "Something went wrong, please try again.";
                console.log(xhr.responseText);
                break;
            }
            $scope.$apply();
            $interval(
              () => {
                $scope.emailStatus = null;
              },
              5000,
              1
            );
          });
      } else {
        $scope.emailStatus = "Your email address is unchanged.";
      }
    };
  });
});
