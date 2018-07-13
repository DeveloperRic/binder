var client = angular.module("client", [
  "ngRoute",
  "ngCookies",
  "ui.bootstrap.contextMenu"
]);

const USER_SESSION_EXPIRATION_SECONDS = 3600;
// REMEMBER TO ADD COOKIE WARNING!

client.config(function($locationProvider, $routeProvider) {
  $locationProvider.html5Mode(true);
  $routeProvider
    .when("/", {
      templateUrl: "app.client.stage.index.html",
      controller: "welcomeCtrl"
    })
    .when("/login", {
      templateUrl: "app.client.stage.login.html",
      controller: "loginCtrl"
    })
    .when("/connect", {
      templateUrl: "app.client.stage.connect.html",
      controller: "connectCtrl"
    })
    .when("/connect/onedrive", {
      templateUrl: "app.client.stage.connect.onedrive.html",
      controller: "connectOnedriveCtrl"
    })
    .when("/dashboard", {
      templateUrl: "app.client.stage.dashboard.html",
      controller: "dashboardCtrl"
    })
    .otherwise({
      template: "<h1>Error 404</h1><p>The requested page was not found</p>"
    });
});

client.run(function($rootScope, $cookies, $httpParamSerializer) {
  $rootScope.navButtons = [
    {
      url: "connect/onedrive",
      text: "Onedrive callback"
    },
    {
      url: "connect?forceUpdate=true",
      text: "Back to connect"
    },
    {
      url:
        "/connect?" +
        $httpParamSerializer({
          forceUpdate: true,
          updateSources: ["onedrive"]
        }),
      text: "Connect onedrive"
    }
  ];
  $rootScope.userSessionExpiration = function() {
    var expiration = new Date();
    expiration.setTime(
      expiration.getTime() + USER_SESSION_EXPIRATION_SECONDS * 1000
    );
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
        $.get("api/user/getuser", {
          uid: cookie.uid,
          sessionKey: cookie.key
        })
          .done(function(userdata) {
            $rootScope.loggedInUser = userdata;
            if (onSuccess) {
              onSuccess($rootScope.loggedInUser);
            }
          })
          .fail(function(xhr, status, error) {
            if (onFail) {
              onFail(true);
            }
          });
      } else if (onFail) {
        onFail(false);
      }
    }
  };
  $rootScope.emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  $rootScope.validateEmail = function(email) {
    return $rootScope.emailPattern.test(String(email).toLowerCase());
  };
  $rootScope.sources = [];
  $rootScope.getSource = sourceid => {
    var foundSource = null;
    $rootScope.sources.forEach(source => {
      if (source.id == sourceid) {
        foundSource = source;
      }
    });
    return foundSource;
  };
  $rootScope.extendGDriveScope = function() {
    $.put("api/source/gdrive/extendscope", {
      uid: $rootScope.user.uid
    })
      .done(function(userdata) {
        $rootScope.user = userdata;
        $location.url(
          "/connect?" +
            $httpParamSerializer({
              forceUpdate: true,
              updateSources: ["gdrive"]
            })
        );
        $location.replace();
      })
      .fail(function(xhr, status, error) {
        console.log(
          "Failed to extend user " +
            $rootScope.user.uid +
            "'s gdrive scope!\n" +
            xhr.responseText
        );
      });
  };
  $rootScope.beginExternalConnect = function() {};
  $rootScope.notifyExternalConnectCompleted = function() {};
});

$(document).ready(function() {
  $("a").on("click", function(event) {
    if (this.hash !== "") {
      event.preventDefault();
      var hash = this.hash;

      $("html, body").animate(
        {
          scrollTop: $(hash).offset().top
        },
        600,
        function() {
          window.location.hash = hash;
        }
      );
    }
  });
});

client.controller("welcomeCtrl", function($scope, $rootScope, $window) {
  // lets assume that no cookies have been stored (for now)
  // var encrptedUsername = $cookieStore.get("username");
  // console.log(encrptedUsername);
  $rootScope.user(
    () => {
      $window.location.href = "/dashboard";
    },
    loggedInBefore => {
      if (loggedInBefore) {
        $window.location.href = "/login";
      }
    }
  );

  $scope.userFound = false;
  $scope.email = "a@a.bv";
  $scope.password = "abc";
  $scope.passwordconfirm = "abc";
  $scope.error = {
    exists: false,
    message: ""
  };
  $scope.postError = function(message) {
    $scope.error.exists = true;
    $scope.error.message = message;
  };
  $scope.createAccount = function() {
    $scope.error.exists = false;
    if (!$rootScope.validateEmail($scope.email)) {
      $scope.postError("Your email address is in the wrong format.");
      return;
    }
    if ($scope.password != $scope.passwordconfirm) {
      $scope.postError("Your passwords don't match.");
      return;
    }
    $.post("api/user/newuser", {
      email: $scope.email,
      password: $scope.password
    })
      .done(function(userdata) {
        $rootScope.user = userdata;
        $window.location.href = "/connect";
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.postError("That email address is already being used.");
      });
  };
  $scope.login = function() {
    $window.location.href = "/login";
  };
});

client.controller("loginCtrl", function(
  $scope,
  $rootScope,
  $routeParams,
  $window
) {
  if ($routeParams.fromWelcome) {
    $scope.canReturn = true;
    $scope.return = function() {
      $rootScope.switchStage("welcome");
    };
  }

  $scope.canReturn = false;

  $scope.email = "a@d.min";
  $scope.password = "admin";
  $scope.error = {
    exists: false,
    message: ""
  };
  $scope.postError = function(message) {
    $scope.error.exists = true;
    $scope.error.message = message;
  };
  $scope.login = function() {
    $scope.error.exists = false;
    if (!$rootScope.validateEmail($scope.email)) {
      $scope.postError("Your email address is in the wrong format.");
      return;
    }
    var expiration = $rootScope.userSessionExpiration();
    $.post("api/user/loginuser", {
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
      .fail(function(xhr, status, error) {
        $scope.postError("Incorrect username or password.");
        $scope.$apply();
      });
  };
});

client.controller("connectCtrl", function(
  $scope,
  $rootScope,
  $routeParams,
  $http,
  $window
) {
  $rootScope.user(
    user => {
      if (user.connectedSources.length > 0 && !$routeParams.forceUpdate) {
        $window.location.href = "/dashboard";
        $rootScope.$apply();
        return;
      }
      $.get("api/source/listsources", {})
        .done(function(data) {
          $rootScope.sources = JSON.parse(data);
          $rootScope.sources.forEach(source => {
            $scope.sourceConnected[source.id] = user.connectedSources.includes(
              source.id
            );
          });
          $scope.hasConnected = user.connectedSources.length > 0;
          if ($routeParams.updateSources) {
            $routeParams.updateSources.forEach(source => {
              $scope.sourceConnected[source] = false;
            });
          }
          $rootScope.$apply();
        })
        .fail(function(xhr, status, error) {
          $window.alert("Couldn't load sources.");
        });
    },
    () => {
      $window.location.href = "/login";
    }
  );

  $scope.redirectReady = false;
  $scope.redirectURL = "";
  $scope.selected = null;
  $scope.onSelect = function(sourceid) {
    $scope.selected = $rootScope.getSource(sourceid);
    $http
      .post("api/source/beginconnect", {
        sourceid: sourceid,
        uid: $rootScope.user().uid
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
          $window.alert("(" + error.status + ") -> " + error.data);
        }
      );
  };
  $rootScope.beginExternalConnect = $scope.onSelect;
  $scope.onRedirect = () => {
    if ($scope.selected.id != "onedrive") {
      $window.open($scope.redirectURL);
      $scope.responseReady = true;
    } else {
      $window.open($scope.redirectURL, "_self");
    }
  };
  $scope.responseReady = false;
  $scope.authcode = "";
  $scope.onResponse = () => {
    $http
      .post("api/source/finishconnect", {
        sourceid: $scope.selected.id,
        uid: $rootScope.user().uid,
        code: $scope.authcode
      })
      .then(
        response => {
          $rootScope.user = response.data;
          $scope.onConnect($scope.selected.id);
        },
        error => {
          $window.alert("(" + error.status + ") -> " + error.data);
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
  $rootScope.notifyExternalConnectCompleted = $scope.onConnect;
  $scope.sourceConnected = {
    gdrive: false,
    onedrive: false,
    onedrive365: false
  };
  $scope.onContinue = function() {
    $window.location.href = "/dashboard";
  };
});

client.controller("connectOnedriveCtrl", function(
  $scope,
  $rootScope,
  $window,
  $http,
  $routeParams,
  $location,
  $httpParamSerializer
) {
  $scope.resultPending = true;
  $scope.isConnected = false;

  $rootScope.user(
    user => {
      if ($routeParams.code) {
        $http
          .post("api/source/finishconnect", {
            sourceid: "onedrive",
            uid: user.uid,
            code: $routeParams.code
          })
          .then(
            response => {
              $rootScope.loggedInUser = response.data;
              $scope.resultPending = false;
              $scope.isConnected = true;
              $rootScope.notifyExternalConnectCompleted("onedrive");
            },
            error => {
              $scope.resultPending = false;
              $window.alert("(" + error.status + ") -> " + error.data);
            }
          );
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
    $location.url("/connect?" + $httpParamSerializer({ forceUpdate: true }));
    $location.replace();
  };
  $scope.onFail = function() {
    $location.url(
      "/connect?" +
        $httpParamSerializer({ forceUpdate: true, updateSources: "onedrive" })
    );
    $location.replace();
  };
});

client.controller("dashboardCtrl", function(
  $scope,
  $rootScope,
  $routeParams,
  $location,
  $window,
  $httpParamSerializer
) {
  $scope.files = [];
  $scope.currentFolderSource = "all";
  $scope.openFolder = function(sourceId, folderId, replace) {
    $.post("api/source/" + sourceId + "/startfilelist", {
      uid: $rootScope.user().uid,
      folderId: folderId
    })
      .done(function(list) {
        if (folderId != "root") {
          $scope.files.length = 0;
          $location.search({ sourceId: sourceId, folderId: folderId });
          if (replace) {
            $location.replace();
          }
          $scope.currentFolderSource = sourceId;
        }

        let tempFiles = [];
        list.forEach(file => {
          var fileDat = {
            isFolder: false,
            source: file.source,
            dat: file.dat
          };
          switch (file.source) {
            case "gdrive":
              fileDat.isFolder =
                file.dat.mimeType == "application/vnd.google-apps.folder";
              break;

            case "onedrive":
              fileDat.isFolder = file.dat.folder;
              break;
          }
          if (fileDat.isFolder) {
            $scope.files.push(fileDat);
          } else {
            tempFiles.push(fileDat);
          }
        });
        tempFiles.forEach(file => $scope.files.push(file));
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $window.alert("Couldn't load " + sourceId + " files");
        console.log(xhr.responseText);
      });
  };

  $rootScope.user(
    user => {
      if (user.connectedSources.length == 0) {
        $location.url("/connect");
        $location.replace();
        $scope.$apply();
      }
      $scope.user = user;
      if ($routeParams.folderId) {
        $scope.openFolder($routeParams.sourceId, $routeParams.folderId, true);
      } else {
        $scope.openFolder("gdrive", "root");
        $scope.openFolder("onedrive", "root");
      }
    },
    () => {
      $location.url(
        "/login?" + $httpParamSerializer({ callback: $location.url() })
      );
      $location.replace();
    }
  );

  $scope.onFileClick = function(file) {
    if (file.isFolder) {
      $scope.openFolder(file.source, file.dat.id);
    } else {
      $window.open(file.dat.webViewLink, "_self");
    }
  };
  $scope.fileContextMenu = function(file) {
    return [
      {
        text: "Preview",
        displayed: !file.isFolder,
        click: function($itemScope, $event, modelValue, text, $li) {
          $window.alert("Feature disabled for now");
        }
      },
      {
        text: "Explore",
        displayed: file.isFolder,
        click: function($itemScope, $event, modelValue, text, $li) {
          $scope.openFolder(file.dat.id);
        }
      },
      {
        text: "Open file",
        displayed: !file.isFolder,
        click: function($itemScope, $event, modelValue, text, $li) {
          $window.open(file.dat.webViewLink, "_self");
        }
      },
      {
        text: "Details",
        displayed: !file.isFolder,
        click: function($itemScope, $event, modelValue, text, $li) {
          $scope.showFileDetails($scope.files[$itemScope.$index]);
        }
      },
      {
        text: "Download",
        displayed: file.isFolder,
        click: function() {
          $.post("api/source/getfilemetadata", {
            uid: $rootScope.user().uid,
            fileId: file.dat.id,
            keys: ["webContentLink"]
          })
            .done(function(data) {
              $window.open(JSON.parse(data).webContentLink, "_blank");
            })
            .fail(function(xhr, status, error) {
              $window.alert("Couldn't get download link");
              console.log(JSON.parse(xhr.responseText));
            });
        }
      }
    ];
  };
  $scope.detailsFile = null;
  $scope.showFileDetails = function(detailsFile) {
    $scope.detailsFile = detailsFile;
    document.getElementById("fileDetailsPane").classList.remove("hide");

    $.post("api/source/getfilemetadata", {
      uid: $rootScope.user().uid,
      fileId: detailsFile.dat.id,
      keys: [
        "thumbnailLink",
        "description",
        "starred",
        "version",
        "size",
        "modifiedTime",
        "lastModifyingUser"
      ]
    })
      .done(function(data) {
        $scope.detailsFile.dat = $.extend($scope.detailsFile.dat, data);
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file thumbnail.";
        console.log(JSON.parse(xhr.responseText));
      });
  };
  $scope.onMainPaneClick = function() {
    $scope.detailsFile = null;
    document.getElementById("fileDetailsPane").classList.add("hide");
  };
  $scope.formatFileSize = function(size) {
    return size + " bytes";
  };
  $scope.formatFileModifiedTime = function(datetime) {
    if (datetime) {
      return new Date(datetime).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
  };
  $scope.toggleFileStarred = function(file) {
    $.post("api/source/updatefilemetadata", {
      uid: $rootScope.user().uid,
      fileId: file.dat.id,
      metadata: {
        starred: true
      }
    })
      .done(function(data) {
        file.dat = $.extend(file.dat, data);
        $scope.$apply();
        console.log(file.dat.starred);
      })
      .fail(function(xhr, status, error) {
        console.log(JSON.parse(xhr.responseText));
      });
  };
});
