"use strict";

define(["routeResolver"], function() {
  var client = angular.module("client", [
    "ngRoute",
    "ngCookies",
    "ui.bootstrap.contextMenu",
    "angular-inview",
    "routeResolverServices"
  ]);

  client.config(function(
    $routeProvider,
    routeResolverProvider,
    $controllerProvider,
    $compileProvider,
    $filterProvider,
    $provide,
    $locationProvider
  ) {
    $locationProvider.html5Mode(true);

    client.register = {
      controller: $controllerProvider.register,
      directive: $compileProvider.directive,
      filter: $filterProvider.register,
      factory: $provide.factory,
      service: $provide.service
    };

    var route = routeResolverProvider.route;

    $routeProvider
      .when("/welcome", route.resolve("welcome", "Get Started on Binder"))
      .when("/login", route.resolve("login", "Login to Binder"))
      .when("/connect", route.resolve("connect", "Connect a source - Binder"))
      .when(
        "/connect/:sourceId",
        route.resolve("connectCallback", "Connecting - Binder")
      )
      .when("/dashboard", route.resolve("dashboard", "Binder"))
      .when("/files", route.resolve("files", "Files - Binder"))
      .when("/files/search", route.resolve("files", "Search - Binder"))
      .when("/settings", route.resolve("settings", "Settings - Binder"))
      .otherwise({
        redirectTo: "/"
      });
  });

  // TODO: Mobile site redirect + support
  // TODO: Broswer website favicon

  const USER_SESSION_EXPIRATION_SECONDS = 3600;

  client.run(function($rootScope, $location, $cookies, $window) {
    $rootScope.$on("$routeChangeSuccess", function(
      event,
      currentRoute,
      previousRoute
    ) {
      //Change page title, based on Route information
      if (
        $location.path().startsWith("/files/search") &&
        !!currentRoute.params.q
      ) {
        $rootScope.title = 'Search "' + currentRoute.params.q + '" - Binder';
      } else if (
        $location.path().startsWith("/files") &&
        !!currentRoute.params.sourceId
      ) {
        $rootScope.sources(sources => {
          for (let i in sources) {
            if (sources[i].id == currentRoute.params.sourceId) {
              $rootScope.title = currentRoute.title.replace(
                "Binder",
                sources[i].name
              );
              break;
            }
          }
        });
      } else {
        $rootScope.title = currentRoute.title;
      }
    });

    $rootScope.$on("$locationChangeSuccess", function() {
      $rootScope.transferAudioToRoot();
    });

    // user session
    $rootScope.userSessionExpiration = function(expirationSeconds) {
      var expiration = new Date();
      var duration = USER_SESSION_EXPIRATION_SECONDS;
      var durationCookieExpiry = new Date();
      durationCookieExpiry.setFullYear(
        durationCookieExpiry.getFullYear() + 1,
        durationCookieExpiry.getMonth() + 1
      );
      if (!!expirationSeconds) {
        duration = expirationSeconds;
      } else if (!!$cookies.get("app.client.data.defaultLoginDuration")) {
        duration = parseInt(
          $cookies.get("app.client.data.defaultLoginDuration")
        );
      }
      $cookies.put("app.client.data.defaultLoginDuration", duration, {
        expires: durationCookieExpiry.toUTCString()
      });
      expiration.setTime(expiration.getTime() + duration * 1000);
      return expiration;
    };
    $rootScope.userSession = function(uid, sessionKey, expiration) {
      if (sessionKey) {
        if ($cookies.getObject("app.client.data.loggedInUser")) {
          $cookies.remove("app.client.data.loggedInUser");
        }
        $cookies.putObject(
          "app.client.data.loggedInUser",
          { uid: uid, key: sessionKey },
          {
            expires: expiration.toUTCString()
          }
        );
      } else {
        return $cookies.getObject("app.client.data.loggedInUser");
      }
    };

    // user object login/logout
    $rootScope.loggedInUser = null;
    $rootScope.user = function(onSuccess, onFail) {
      if ($rootScope.loggedInUser) {
        if (onSuccess) {
          onSuccess($rootScope.loggedInUser);
        }
        return $rootScope.loggedInUser;
      } else {
        var cookie = $rootScope.userSession();
        if (cookie) {
          $.get("api/user/" + cookie.uid, {
            sessionKey: cookie.key
          })
            .done(function(userdata) {
              $rootScope.loggedInUser = userdata;
              if (onSuccess) {
                onSuccess($rootScope.loggedInUser);
              }
            })
            .fail(function(xhr, textStatus, error) {
              if (onFail) {
                onFail(true);
              }
            });
        } else if (onFail) {
          onFail(false);
        }
      }
    };
    $rootScope.logoutUser = function() {
      if ($cookies.getObject("app.client.data.loggedInUser")) {
        $cookies.remove("app.client.data.loggedInUser");
      }
      if ($rootScope.loggedInUser) {
        $.post("api/user/" + $rootScope.loggedInUser.uid + "/logout");
        $rootScope.loggedInUser = null;
        $window.location.href = "/";
      }
    };

    // sources
    $rootScope.tempSourceList = [];
    $rootScope.sources = function(onSuccess, onFail) {
      $.get("api/source/list", {})
        .done(function(data) {
          $rootScope.tempSourceList.length = 0;
          data.forEach(source => $rootScope.tempSourceList.push(source));
          onSuccess($rootScope.tempSourceList);
        })
        .fail(function(xhr, textStatus, error) {
          if (!!onFail) {
            onFail(xhr, textStatus, error);
          }
        });
    };
    $rootScope.getSource = sourceid => {
      var foundSource = null;
      $rootScope.tempSourceList.forEach(source => {
        if (source.id == sourceid) {
          foundSource = source;
        }
      });
      return foundSource;
    };

    // util functions for email and password validation
    $rootScope.emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    $rootScope.validateEmail = function(email) {
      return $rootScope.emailPattern.test(String(email).toLowerCase());
    };
    $rootScope.validatePassword = function(password, passwordconfirm) {
      if (password == "") {
        return "You must enter a password.";
      } else if (password.length < 8) {
        return new Array(
          "Your password must be at least 8 characters long.",
          "This is to help protect your files from unauthorised access."
        );
      } else if (password != passwordconfirm) {
        return "Your passwords do not match.";
      } else {
        return null;
      }
    };

    // view feature for displaying popups
    $rootScope.showPopup = function(type, title, details, options) {
      var view = "app.client.popup.";
      switch (type.toLowerCase()) {
        case "error":
          view += "error.html";
          if (!!!details) {
            details = "Please report this!";
          }
          break;
        case "select":
          view += "select.html";
          break;
        case "input":
          view += "input.html";
          break;
        case "file-choose":
          view += "file_choose.html";
          break;
        default:
          view += "info.html";
          break;
      }
      $rootScope.popup = {
        popupView: view,
        title: title,
        details: details,
        close: () => {
          $rootScope.popup = null;
        }
      };
      if (!!options) {
        $rootScope.popup = Object.assign($rootScope.popup, options);
      }
    };

    $rootScope.transferAudioToRoot = () => {
      var audioTime = $cookies.getObject("app.client.data.audioTime");
      if (!!audioTime) {
        $rootScope.audio = {
          src: audioTime.src,
          startTime: audioTime.time,
          forcePause: audioTime.forcePause,
          playlist: audioTime.playlist,
          started: false
        };
        $rootScope.$$postDigest(() => {
          var navAudio = document.getElementById("navAudio");
          navAudio.onplay = () => {
            if (!$rootScope.audio.started) {
              navAudio.currentTime = $rootScope.audio.startTime;
              $rootScope.audio.started = true;
              navAudio.onplay = null;
              navAudio.ontimeupdate = () => {
                $cookies.putObject(
                  "app.client.data.audioTime",
                  {
                    src: $rootScope.audio.src,
                    time: navAudio.currentTime,
                    playlist: $rootScope.audio.playlist
                  },
                  { expires: $rootScope.userSessionExpiration().toUTCString() }
                );
              };
            }
          };
          navAudio.onpause = () => {
            $cookies.putObject(
              "app.client.data.audioTime",
              {
                src: $rootScope.audio.src,
                time: navAudio.currentTime,
                playlist: $rootScope.audio.playlist,
                forcePause: true
              },
              { expires: $rootScope.userSessionExpiration().toUTCString() }
            );
          };
          if (!!$rootScope.audio.playlist) {
            navAudio.onended = () => {
              while (
                !!!$rootScope.audio.playlist[0] &&
                $rootScope.audio.playlist.length > 0
              ) {
                $rootScope.audio.playlist.splice(0, 1);
              }
              if ($rootScope.audio.playlist.length > 0) {
                $rootScope.audio.src = $rootScope.audio.playlist[0];
                $rootScope.audio.playlist.splice(0, 1);
                $rootScope.$$postDigest(() => {
                  navAudio.src = $rootScope.audio.src;
                  navAudio.play();
                });
                $rootScope.$apply();
              } else {
                $cookies.remove("app.client.data.audioTime");
              }
            };
          }
          if (!$rootScope.audio.forcePause) {
            navAudio.play();
          }
        });
      }
    };
  });

  // client.controller("previewPdfCtrl", function($scope, $rootScope) {});

  return client;
});
