var client = angular.module("client", [
  "ngRoute",
  "ngCookies",
  "ui.bootstrap.contextMenu"
]);

const USER_SESSION_EXPIRATION_SECONDS = 3600;
// REMEMBER TO ADD COOKIE WARNING!
// focused routeparam to bring a file back into view when using browser history

client.config(function($locationProvider, $routeProvider) {
  $locationProvider.html5Mode(true);
  $routeProvider
    .when("/welcome", {
      templateUrl: "app.client.stage.welcome.html",
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
    .when("/connect/:sourceId", {
      templateUrl: "app.client.stage.connect.callback.html",
      controller: "connectCallbackCtrl"
    })
    .when("/dashboard", {
      templateUrl: "app.client.stage.dashboard.html",
      controller: "dashboardCtrl"
    })
    .when("/files", {
      templateUrl: "app.client.stage.files.html",
      controller: "filesCtrl"
    })
    .when("/files/search", {
      templateUrl: "app.client.stage.files.html",
      controller: "filesCtrl"
    })
    .when("/account", {
      templateUrl: "app.client.stage.account.html",
      controller: "accountCtrl"
    })
    .otherwise({
      template: "<h1>Error 404</h1><p>The requested page was not found</p>"
    });
});

client.run(function(
  $rootScope,
  $cookies,
  $location,
  $window,
  $httpParamSerializer
) {
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
        $.get("api/user/" + cookie.uid, {
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
  $rootScope.tempSourceList = [];
  $rootScope.sources = function(onSuccess, onFail) {
    $.get("api/source/list", {})
      .done(function(data) {
        $rootScope.tempSourceList.length = 0;
        data.forEach(source => $rootScope.tempSourceList.push(source));
        onSuccess($rootScope.tempSourceList);
      })
      .fail(function(xhr, status, error) {
        onFail(xhr, status, error);
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
  $rootScope.extendGDriveScope = function() {
    $.post("api/source/gdrive/extendscope", {
      uid: $rootScope.user().uid
    })
      .done(function(userdata) {
        $rootScope.loggedInUser = userdata;
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

  $rootScope.hideNavBar = true;

  $scope.userFound = false;
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
      $scope.postError("Your email address is in the wrong format.");
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
  $scope.createAccount = function() {
    $scope.error.exists = false;
    $scope.emailInvalid = false;
    $scope.passwordInvalid = false;
    if (!$rootScope.validateEmail($scope.email)) {
      $scope.emailInvalid = true;
      $scope.postError("Your email address is in the wrong format.");
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
    var expiration = $rootScope.userSessionExpiration();
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
      .fail(function(xhr, status, error) {
        $scope.postError("That email address is already being used.");
        $scope.$apply();
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
  $window,
  $interval
) {
  if ($routeParams.fromWelcome) {
    $scope.canReturn = true;
    $scope.return = function() {
      $rootScope.switchStage("welcome");
    };
  }

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
      $scope.postError("Your email address is in the wrong format.");
    }
  };
  $scope.login = function() {
    $scope.error.exists = false;
    if (!$rootScope.validateEmail($scope.email)) {
      $scope.postError("Your email address is in the wrong format.");
      return;
    }
    if ($scope.password == "") {
      return;
    }
    var expiration = $rootScope.userSessionExpiration();
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
      .fail(function(xhr, status, error) {
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
            $scope.sourceConnected[source.id] = user.connectedSources.includes(
              source.id
            );
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
          $window.alert("Couldn't load sources.");
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
          $window.alert("(" + error.status + ") -> " + error.data);
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
          .fail((xhr, status, error) => {
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
      $location.url("/connect?" + $httpParamSerializer({ forceUpdate: true }));
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

client.controller("dashboardCtrl", function(
  $scope,
  $rootScope,
  $location,
  $httpParamSerializer
) {
  $scope.requestStatus = {
    loadingSources: true,
    errorLoading: false,
    setStatus: function(status) {
      for (let key in $scope.requestStatus) {
        if (key != "setStatus") {
          $scope.requestStatus[key] = key == status;
        }
      }
    }
  };
  $rootScope.searching = {
    searchQuery: "",
    search: function(query) {
      $location.path("/files/search").search({ q: query });
    }
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
          $scope.styles = {};
          sources.forEach(source => {
            $scope.styles[source.id] = {
              "background-color": "initial"
            };
            switch (source.id) {
              case "gdrive":
                $scope.styles[source.id]["background-color"] = "#34A853";
                break;
              case "onedrive":
                $scope.styles[source.id]["background-color"] = "#094AB2";
                break;
              case "dropbox":
                $scope.styles[source.id]["background-color"] = "#0061FF";
                break;
            }
          });
          $scope.requestStatus.setStatus("");
          $scope.$apply();
        },
        () => {
          // TODO: message on sources load failure.
          $scope.requestStatus.setStatus("errorLoading");
          console.log("Failed to get source list");
          $scope.$apply();
        }
      );
    },
    () => {
      $location.url(
        "/login?" + $httpParamSerializer({ callback: $location.url() })
      );
      $location.replace();
    }
  );
});

client.controller("filesCtrl", function(
  $scope,
  $rootScope,
  $routeParams,
  $location,
  $window,
  $httpParamSerializer,
  $interval,
  $cookies
) {
  $scope.pageStack = [];
  $scope.sorting = {
    drawerOpen: false,
    toggleDrawer: function($event) {
      $event.stopPropagation();
      $scope.sorting.drawerOpen = !$scope.sorting.drawerOpen;
    },
    availableMethods: [
      {
        text: "Folder",
        gdrive: "folder",
        enabled: true,
        descending: false
      },
      {
        text: "Name",
        all: "name",
        enabled: true,
        descending: false
      },
      {
        text: "Modified Time",
        gdrive: "modifiedByMeTime",
        onedrive: "lastModifiedDateTime",
        enabled: false,
        descending: false
      },
      {
        text: "Size",
        gdrive: "quotaBytesUsed",
        onedrive: "size",
        enabled: false,
        descending: false
      }
    ],
    orderBy: [],
    criteriaClickCallback: () => {},
    orderByStr: function(sourceId) {
      var realOrderBy = [];
      $scope.sorting.orderBy.forEach(method => {
        if (!(sourceId == "onedrive" && realOrderBy.length > 0)) {
          if (method.all) {
            realOrderBy.push(method.all);
          } else if (method[sourceId]) {
            realOrderBy.push(method[sourceId]);
          }
        }
      });
      return realOrderBy.join(",");
    },
    toggleCriteria: function(criteria) {
      criteria.enabled = !criteria.enabled;
      if (criteria.enabled && !$scope.sorting.orderBy.includes(criteria)) {
        $scope.sorting.orderBy.push(criteria);
      } else if ($scope.sorting.orderBy.includes(criteria)) {
        $scope.sorting.orderBy.splice(
          $scope.sorting.orderBy.indexOf(criteria),
          1
        );
      }
    },
    onCriteriaClick: function(criteria) {
      if (criteria.enabled) {
        if (criteria.descending) {
          $scope.sorting.toggleCriteria(criteria);
        }
        criteria.descending = !criteria.descending;
        $scope.sorting.updateSortCookie();
      } else {
        $scope.sorting.toggleCriteria(criteria);
      }
      $scope.sorting.criteriaClickCallback();
    },
    updateSortCookie: function() {
      var sortOrderCookie = [];
      $scope.sorting.orderBy.forEach(method => {
        sortOrderCookie.push({
          text: method.text,
          descending: method.descending
        });
      });
      $cookies.putObject("app.client.data.files.orderBy", sortOrderCookie);
    }
  };
  $scope.requestStatus = {
    loadingChildren: true,
    errorLoading: false,
    searching: false,
    setStatus: function(status) {
      for (let key in $scope.requestStatus) {
        if (key != "setStatus") {
          $scope.requestStatus[key] = key == status;
        }
      }
    }
  };
  $scope.files = [];
  $scope.currentFolderSourceName = "Files";
  $scope.currentFolderSource = "all";
  $scope.unifySourceFile = function(sourceId, fileDat) {
    var file = {
      id: fileDat.id,
      isFolder: false,
      source: sourceId,
      dat: fileDat
    };
    switch (sourceId) {
      case "gdrive":
        file.isFolder =
          fileDat.mimeType == "application/vnd.google-apps.folder";
        break;

      case "onedrive":
        file.isFolder = fileDat.folder ? true : false;
        break;

      case "dropbox":
        file.id = fileDat.path_display;
        file.isFolder = fileDat[".tag"] == "folder";
        break;
    }
    return file;
  };
  $scope.getFileParents = function(sourceId, fileId, keys) {
    $.get("api/source/" + sourceId + "/" + fileId + "/get_metadata", {
      uid: $rootScope.user().uid,
      keys: keys
    }).done(parent => {
      var getNextParent = function(id) {
        $.get("api/source/" + sourceId + "/" + id + "/get_metadata", {
          uid: $rootScope.user().uid,
          keys: keys
        }).done(parent => {
          if (sourceId == "onedrive" && !parent.parentReference.id) {
            parent.name = "My OneDrive";
          }
          $scope.pageStack.splice(
            0,
            0,
            $scope.unifySourceFile(sourceId, parent)
          );
          $scope.$apply();
        });
        $scope.getFileParents(sourceId, id, keys);
      };

      if (sourceId == "gdrive" && parent.parents) {
        parent.parents.forEach(parentId => {
          getNextParent(parentId);
        });
      } else if (sourceId == "onedrive" && parent.parentReference.id) {
        getNextParent(parent.parentReference.id);
      }
    });
  };
  $scope.openFolder = function(sourceId, folderId, replace, batchRequest) {
    $scope.requestStatus.setStatus("loadingChildren");
    if (sourceId == "all") {
      $rootScope.sources(
        sources => {
          $scope.files.length = 0;
          sources.forEach(source => {
            if ($scope.user.connectedSources.includes(source.id)) {
              $scope.openFolder(source.id, folderId, replace, true);
            }
          });
          $location.search("sourceId", null);
          $location.search("folderId", null);
          $scope.$apply();
        },
        () => {
          // TODO: message on sources load failure.
          $scope.requestStatus.setStatus("errorLoading");
          console.log("Failed to get source list");
          $scope.$apply();
        }
      );
      return;
    }
    $scope.currentFolder = folderId;
    $scope.currentFolderSource = batchRequest ? "all" : sourceId;
    var folderIndex = 0;
    if (folderId != "root") {
      $scope.files.length = 0;
      $location.search({
        sourceId: sourceId,
        folderId: folderId
      });
    }
    if (replace) {
      $location.replace();
    }
    var requestFolderUrl = "/" + folderId;
    var requestParams = {
      uid: $rootScope.user().uid,
      params: {
        orderBy: $scope.sorting.orderByStr(sourceId)
      }
    };
    if (sourceId == "dropbox") {
      requestFolderUrl = "";
      requestParams = Object.assign(requestParams, { folderPath: folderId });
    }
    $.get("api/source/" + sourceId + requestFolderUrl + "/files", requestParams)
      .done(function(list) {
        list.forEach(file => {
          var fileWrapper = $scope.unifySourceFile(file.source, file.dat);
          // sort the files by folder for sources that don't enable that kind of sorting
          if (sourceId != "gdrive" || $scope.currentFolderSource == "all") {
            if (fileWrapper.isFolder) {
              $scope.files.splice(folderIndex, 0, fileWrapper);
              folderIndex++;
            } else {
              $scope.files.push(fileWrapper);
            }
          } else {
            $scope.files.push(fileWrapper);
          }
        });
        $scope.sorting.criteriaClickCallback = () => {
          $scope.openFolder(
            $scope.currentFolderSource,
            $scope.currentFolder,
            true,
            batchRequest
          );
        };
        if (sourceId == "dropbox" && $scope.files.length > 0) {
          $scope.pageStack.length = 0;
          var path = $scope.files[0].id + "";
          if (path.lastIndexOf("/") > 0) {
            var pageNames = path
              .substr(1, path.lastIndexOf("/") - 1)
              .split("/");
            var updatedPath = "";
            for (let i in pageNames) {
              updatedPath += "/" + pageNames[i];
              $scope.pageStack.push(
                $scope.unifySourceFile(sourceId, {
                  ".tag": "folder",
                  path_display: updatedPath,
                  name: pageNames[i]
                })
              );
            }
          }
        }
        $scope.requestStatus.setStatus("");
        $scope.$apply();
        $scope.qualifyFileList(sourceId);
      })
      .fail(function(xhr, status, error) {
        $scope.requestStatus.setStatus("errorLoading");
        $scope.$apply();
        console.log(xhr.responseText);
      });
    if (folderId != "root" && sourceId != "dropbox") {
      $scope.pageStack.length = 0;
      var keys = ["name"];
      switch (sourceId) {
        case "gdrive":
          keys.push("parents", "mimeType");
          break;

        case "onedrive":
          keys.push("folder", "parentReference");
          break;
      }
      $.get("api/source/" + sourceId + "/" + folderId + "/get_metadata", {
        uid: $rootScope.user().uid,
        keys: keys
      }).done(currentFolder => {
        if (sourceId == "onedrive" && folderId == "root") {
          currentFolder.name = "OneDrive";
        }
        $scope.pageStack.splice(
          0,
          0,
          $scope.unifySourceFile(sourceId, currentFolder)
        );
        $scope.getFileParents(sourceId, folderId, keys);
      });
    }
  };
  $scope.qualifyFileList = function(sourceId) {
    if (sourceId != "dropbox") {
      var index = -1;
      $scope.files.forEach(file => {
        index++;
        if (file.source == "gdrive") {
          $interval(
            () => {
              $.get("api/source/gdrive/" + file.id + "/get_metadata", {
                uid: $rootScope.user().uid,
                keys: ["thumbnailLink"]
              })
                .done(function(data) {
                  file.dat = Object.assign(file.dat, data);
                  file = Object.assign(file, {
                    thumbnailLink: data.thumbnailLink
                  });
                  $scope.$apply();
                })
                .fail(function(xhr, status, error) {
                  file.thumbnailLinkAlt = "Couldn't get file metadata";
                  console.log(JSON.parse(xhr.responseText));
                });
            },
            150 * (index + 1),
            1
          );
        } else if (file.source == "onedrive") {
          $.get("api/source/onedrive/" + file.id + "/collection/thumbnails", {
            uid: $rootScope.user().uid
          })
            .done(function(data) {
              file.dat = Object.assign(file.dat, {
                thumbnails: data.value
              });
              // add another switch if a different source also separates collection calls
              if (data.value) {
                try {
                  file = Object.assign(file, {
                    thumbnailLink: data.value[0].large.url
                  });
                  $scope.$apply();
                } catch (error) {}
              }
            })
            .fail(function(xhr, status, error) {
              file.thumbnailLinkAlt = "Couldn't get file thumbnail";
              console.log(JSON.parse(xhr.responseText));
            });
        }
      });
    } else {
      var filePaths = [];
      $scope.files.forEach(file => {
        if (file.source == "dropbox") {
          filePaths.push(file.id);
        }
      });
      if (filePaths.length > 0) {
        $.get("/api/source/dropbox/thumbnails", {
          uid: $rootScope.user().uid,
          filePaths: filePaths
        })
          .done(function(entries) {
            entries.forEach(entry => {
              if (entry[".tag"] != "failure") {
                var metadata = $scope.unifySourceFile(
                  "dropbox",
                  entry.metadata
                );
                for (let i in $scope.files) {
                  if (
                    $scope.files[i].source == "dropbox" &&
                    $scope.files[i].id == metadata.id
                  ) {
                    $scope.files[i] = Object.assign(
                      $scope.files[i],
                      Object.assign(metadata, {
                        thumbnailLink:
                          "data:image/gif;base64," + entry.thumbnail
                      })
                    );
                    break;
                  }
                }
              }
            });
            $scope.$apply();
          })
          .fail(function(xhr, status, error) {
            $scope.files.forEach(file => {
              if (file.source == "dropbox") {
                file.thumbnailLinkAlt = "Couldn't get file thumbnail";
              }
            });
            console.log(JSON.parse(xhr.responseText));
          });
      }
      $scope.files.forEach(file => {
        if (file.source == "dropbox" && !file.isFolder) {
          file = Object.assign(file, {
            versionNumber: "Unknown",
            lastModified: file.dat.server_modified,
            lastModifiedBy: "Unknown"
          });
          $.get("/api/source/dropbox/preview", {
            uid: $rootScope.user().uid,
            filePath: file.id
          }).done(function(preview) {
            file = Object.assign(file, {
              preview: preview
            });
            $scope.$apply();
          });
          $.get("/api/source/dropbox/content", {
            uid: $rootScope.user().uid,
            filePath: file.id
          })
            .done(function(response) {
              if (response[".tag"] != "failure") {
                var metadata = $scope.unifySourceFile(
                  "dropbox",
                  response.metadata
                );
                file = Object.assign(
                  file,
                  Object.assign(metadata, {
                    streamURL: response.link
                  })
                );
                file.dat = Object.assign(file.dat, {
                  audio: new RegExp("[.mp3]?[.wav]?[.aac]?$").test(
                    file.dat.path_lower
                  )
                });
                $scope.$apply();
              }
            })
            .fail(function(xhr, status, error) {
              console.log(JSON.parse(xhr.responseText));
            });
        }
      });
    }
  };
  $rootScope.searching = {
    searchQuery: "",
    search: function(query) {
      query = query.replace("'", "");
      if ($location.path() != "/files/search") {
        $location.path("/files/search").search({ q: query });
        return;
      } else {
        $location.search({ q: query });
        $location.replace();
      }
      $rootScope.searching.searchQuery = query;
      $scope.currentFolderSourceName = "Search results";
      $scope.requestStatus.setStatus("searching");
      $rootScope.sources(
        sources => {
          $scope.files.length = 0;
          sources.forEach(source => {
            if ($scope.user.connectedSources.includes(source.id)) {
              $.get("api/source/" + source.id + "/search", {
                uid: $rootScope.user().uid,
                query: query,
                params: {
                  orderBy: $scope.sorting.orderByStr(source.id)
                }
              })
                .done(function(list) {
                  list.forEach(file => {
                    $scope.files.push(
                      $scope.unifySourceFile(file.source, file.dat)
                    );
                  });
                  $scope.sorting.criteriaClickCallback = () => {
                    $rootScope.searching.search(
                      $rootScope.searching.searchQuery
                    );
                  };
                  $scope.requestStatus.setStatus("");
                  $scope.$apply();
                  $scope.qualifyFileList(source.id);
                })
                .fail(function(xhr, status, error) {
                  $scope.requestStatus.setStatus("errorLoading");
                  $scope.$apply();
                  console.log(xhr.responseText);
                });
            }
          });
        },
        () => {
          // TODO: message on sources load failure.
          $scope.requestStatus.setStatus("errorLoading");
          console.log("Failed to get source list");
          $scope.$apply();
        }
      );
    }
  };

  $rootScope.user(
    user => {
      if (user.connectedSources.length == 0) {
        $location.url("/dashboard");
        $location.replace();
      }
      $scope.user = user;
      $.get("api/user/" + user.uid + "/navigation").done(navigation => {
        $rootScope.navButtons = navigation;
        try {
          $scope.$apply();
        } catch (error) {}
      });
      var sortOrder = $cookies.getObject("app.client.data.files.orderBy");
      if (sortOrder) {
        sortOrder.forEach(method => {
          for (let i in $scope.sorting.availableMethods) {
            if ($scope.sorting.availableMethods[i].text == method.text) {
              $scope.sorting.availableMethods[i].enabled = true;
              $scope.sorting.availableMethods[i].descending = method.descending;
              break;
            }
          }
        });
      }
      $scope.sorting.availableMethods.forEach(method => {
        if (method.enabled) {
          $scope.sorting.orderBy.push(method);
        }
      });
      if ($routeParams.folderId) {
        $scope.openFolder($routeParams.sourceId, $routeParams.folderId, true);
        $rootScope.sources(
          sources => {
            for (let i in sources) {
              if (sources[i].id == $routeParams.sourceId) {
                $scope.currentFolderSourceName = sources[i].name;
                $scope.$apply();
                break;
              }
            }
          },
          () => {}
        );
      } else if ($location.path() == "/files/search") {
        $rootScope.searching.search($routeParams.q);
      } else {
        $scope.openFolder("all", "root");
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
      $scope.openFolder(file.source, file.id);
    } else {
      $scope.openFile(file);
    }
  };
  $scope.openFile = function(file, openInNewTab) {
    var target = openInNewTab ? "_blank" : "_self";
    switch (file.source) {
      case "gdrive":
        $window.open(file.dat.webViewLink, target);
        break;
      case "onedrive":
        $window.open(file.dat.webUrl, target);
        break;
      case "dropbox":
        $window.alert(
          "Dropbox does not allow you to view files online from a external source.\n" +
            "However, you can still download the file by right-clicking and selecting 'Download'"
        );
        break;
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
        click: function() {
          $scope.onFileClick(file);
        }
      },
      {
        text: "Open in new tab",
        displayed: !file.isFolder,
        click: function() {
          $scope.openFile(file, true);
        }
      },
      {
        text: "Details",
        displayed: !file.isFolder,
        click: function($itemScope) {
          $scope.showFileDetails($scope.files[$itemScope.$index]);
        }
      },
      {
        text: "Download",
        click: function($itemScope) {
          $scope.downloadFile($scope.files[$itemScope.$index]);
        }
      }
    ];
  };
  $scope.detailsFile = null;
  $scope.showFileDetails = function(detailsFile) {
    console.log(detailsFile);
    $scope.detailsFile = detailsFile;
    document.getElementById("fileDetailsPane").classList.remove("ng-hide");

    var keys = ["description", "size"];
    var collections = [];
    switch (detailsFile.source) {
      case "gdrive":
        keys.push(
          "starred",
          "version",
          "modifiedTime",
          "lastModifyingUser",
          "webContentLink"
        );
        break;
      case "onedrive":
        keys.push("malware", "audio", "@microsoft.graph.downloadUrl");
        collections.push("versions");
        break;
    }
    $.get(
      "api/source/" +
        detailsFile.source +
        "/" +
        detailsFile.id +
        "/get_metadata",
      {
        uid: $rootScope.user().uid,
        keys: keys
      }
    )
      .done(function(data) {
        $scope.detailsFile.dat = Object.assign($scope.detailsFile.dat, data);
        switch (detailsFile.source) {
          case "gdrive":
            $scope.detailsFile = Object.assign($scope.detailsFile, {
              versionNumber: data.version,
              lastModified: data.modifiedTime,
              lastModifiedBy: data.lastModifyingUser.displayName,
              streamURL: data.webContentLink
            });
            $scope.detailsFile.dat = Object.assign($scope.detailsFile.dat, {
              audio: $scope.detailsFile.dat.mimeType.startsWith("audio")
            });
            break;
          case "onedrive":
            if (!data.malware) {
              $scope.detailsFile = Object.assign($scope.detailsFile, {
                streamURL: data["@microsoft.graph.downloadUrl"]
              });
            }
        }
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file metadata";
        console.log(JSON.parse(xhr.responseText));
      });

    if (detailsFile.source == "onedrive") {
      collections.forEach(collection => {
        $.get(
          "api/source/onedrive/" + detailsFile.id + "/collection/" + collection,
          {
            uid: $rootScope.user().uid
          }
        )
          .done(function(data) {
            var wrapper = {};
            wrapper[collection] = data.value;
            $scope.detailsFile.dat = Object.assign(
              $scope.detailsFile.dat,
              wrapper
            );
            // add another switch if a different source also separates collection calls
            if (data.value) {
              try {
                if (collection == "versions") {
                  $scope.detailsFile = Object.assign($scope.detailsFile, {
                    versionNumber: data.value.length,
                    lastModified: data.value[0].lastModifiedDateTime,
                    lastModifiedBy:
                      data.value[0].lastModifiedBy.user.displayName
                  });
                }
              } catch (error) {}
            }
            $scope.$apply();
          })
          .fail(function(xhr, status, error) {
            $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file metadata";
            console.log(JSON.parse(xhr.responseText));
          });
      });
    }
  };
  $scope.onMainPaneClick = function() {
    $scope.detailsFile = null;
    document.getElementById("fileDetailsPane").classList.add("ng-hide");
    $scope.sorting.drawerOpen = false;
  };
  $scope.formatFileSize = function(size) {
    if (size) {
      if (size >= Math.pow(1024, 3)) {
        return Math.floor(size / Math.pow(1024, 3)) + " GB";
      } else if (size >= Math.pow(1024, 2)) {
        return Math.floor(size / Math.pow(1024, 2)) + " MB";
      } else if (size >= 1024) {
        return Math.floor(size / 1024) + " KB";
      } else {
        return size + " bytes";
      }
    } else {
      return "Unknown";
    }
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
    $.post("api/source/gdrive/" + file.id + "/update_metadata", {
      uid: $rootScope.user().uid,
      fileId: file.id,
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
  $scope.downloadFile = function(file) {
    switch (file.source) {
      case "gdrive":
        $.post("api/source/get_metadata", {
          uid: $rootScope.user().uid,
          fileId: file.id,
          keys: ["webContentLink"]
        })
          .done(function(data) {
            $window.open(JSON.parse(data).webContentLink, "_blank");
          })
          .fail(function(xhr, status, error) {
            $window.alert("Couldn't get download link");
            console.log(JSON.parse(xhr.responseText));
          });
        break;
      case "onedrive":
        if (!!file.streamURL) {
          $window.open(file.streamURL);
        } else {
          $.get("api/source/onedrive/" + file.id + "/get_metadata", {
            uid: $rootScope.user().uid,
            keys: ["malware", "@microsoft.graph.downloadUrl"]
          })
            .done(function(data) {
              file.dat = Object.assign(file.dat, data);
              if (data.malware) {
                file = Object.assign(file, {
                  streamURL: data["@microsoft.graph.downloadUrl"]
                });
                $window.open(file.streamURL);
              } else {
                $window.alert(
                  "You may not download this file from Binder because it was found to contain malware."
                );
              }
            })
            .fail(function(xhr, status, error) {
              $scope.detailsFile.thumbnailLinkAlt =
                "Couldn't get file metadata";
              console.log(JSON.parse(xhr.responseText));
            });
        }
        break;
      case "dropbox":
        if (!file.isFolder) {
          $window.open(file.streamURL);
        } else {
          $window.alert("Cannot download Dropbox folders");
        }
        break;
    }
  };
});

client.controller("accountCtrl", function(
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
  $scope.toggleSource = function(source) {
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
        .fail(function(xhr, status, error) {
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
              $window.alert(source.name + " is already connected");
            }
          },
          error => {
            $window.alert("(" + error.status + ") -> " + error.data);
          }
        );
    }
  };
  $scope.setAccessLevel = function(newAccessLevel) {
    if ($rootScope.user().accessLevel != newAccessLevel) {
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
            $window.alert(
              "The following sources could not be updated:\n\n" +
                res.failedSources.join(", ")
            );
          }
        })
        .fail(function(xhr, status, error) {
          $window.alert("Binder failed to change your access level settings.");
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
  $scope.updateEmail = function() {
    if ($scope.profile.email != $rootScope.user().email) {
      if ($scope.profile.password == $rootScope.user().password) {
        var oldEmailAddress = $rootScope.user().email;
        $.post("api/user/" + $rootScope.user().uid + "/update_email", {
          email: $scope.profile.email
        }).done(user => {
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
        });
      } else {
        $scope.emailStatus = "Incorrect password";
      }
    } else {
      $scope.emailStatus = "Your email address is unchanged.";
    }
  };
});
