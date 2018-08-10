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
    .when("/connect/onedrive", {
      templateUrl: "app.client.stage.connect.onedrive.html",
      controller: "connectOnedriveCtrl"
    })
    .when("/dashboard", {
      templateUrl: "app.client.stage.dashboard.html",
      controller: "dashboardCtrl"
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
  $rootScope.staticNavButtons = [
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
      $.post("api/user/logoutuser", { uid: $rootScope.loggedInUser });
      $rootScope.loggedInUser = null;
      $window.location.href = "/login";
    }
  };
  $rootScope.emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  $rootScope.validateEmail = function(email) {
    return $rootScope.emailPattern.test(String(email).toLowerCase());
  };
  $rootScope.tempSourceList = [];
  $rootScope.sources = function(onSuccess, onFail) {
    $.get("api/source/listsources", {})
      .done(function(data) {
        $rootScope.tempSourceList = data;
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
  $scope.email = "";
  $scope.password = "";
  $scope.passwordconfirm = "";
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
    var expiration = $rootScope.userSessionExpiration();
    $.post("api/user/newuser", {
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
      .post("api/source/" + sourceId + "/beginconnect", {
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
  $rootScope.beginExternalConnect = $scope.onSelect;
  $scope.onRedirect = () => {
    if ($scope.selected.id != "onedrive") {
      $window.open($scope.redirectURL);
      $scope.responseReady = true;
    } else {
      $cookies.put("app.client.data.callback", "/connect?forceUpdate=true");
      $window.open($scope.redirectURL, "_self");
    }
  };
  $scope.responseReady = false;
  $scope.authcode = "";
  $scope.onResponse = () => {
    $http
      .post("api/source/" + $scope.selected.id + "/finishconnect", {
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
  $rootScope.notifyExternalConnectCompleted = $scope.onConnect;
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

client.controller("connectOnedriveCtrl", function(
  $scope,
  $rootScope,
  $routeParams,
  $location,
  $cookies,
  $httpParamSerializer
) {
  $scope.resultPending = true;
  $scope.isConnected = false;

  $rootScope.user(
    user => {
      if ($routeParams.code) {
        $.post("api/source/onedrive/finishconnect", {
          uid: user.uid,
          code: $routeParams.code
        })
          .done(data => {
            $rootScope.loggedInUser = data;
            $scope.resultPending = false;
            $scope.isConnected = true;
            $rootScope.notifyExternalConnectCompleted("onedrive");
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
    var callback = $cookies.get("app.client.data.callback");
    if (callback) {
      $cookies.remove("app.client.data.callback");
      $location.url(callback);
    } else {
      $location.url("/connect?" + $httpParamSerializer({ forceUpdate: true }));
    }
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
      } else {
        $scope.sorting.toggleCriteria(criteria);
      }
      $scope.openFolder($scope.currentFolderSource, $scope.currentFolder, true);
    },
    sortFiles: function() {
      var files = [];
      var tempFiles = [];
      $scope.files.forEach(file => {
        if (file.isFolder) {
          files.push(file);
        } else {
          tempFiles.push(file);
        }
      });
      tempFiles.forEach(file => files.push(file));
      // ^^^ fix this redundancy!
      $scope.files.length = 0;
      files.forEach(file => $scope.files.push(file));
    }
  };
  $scope.files = [];
  $scope.currentFolderSource = "all";
  $scope.unifySourceFile = function(sourceId, fileDat) {
    var file = {
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
    }
    return file;
  };
  $scope.getFileParents = function(sourceId, fileId, keys) {
    $.get("api/source/" + sourceId + "/" + fileId + "/getfilemetadata", {
      uid: $rootScope.user().uid,
      keys: keys
    }).done(parent => {
      function func(id) {
        $.get("api/source/" + sourceId + "/" + id + "/getfilemetadata", {
          uid: $rootScope.user().uid,
          keys: keys
        }).done(parent => {
          if (sourceId == "onedrive" && !parent.parentReference.id) {
            parent.name = "OneDrive";
          }
          $scope.pageStack.splice(
            0,
            0,
            $scope.unifySourceFile(sourceId, parent)
          );
          $scope.$apply();
        });
        $scope.getFileParents(sourceId, id, keys);
      }

      if (sourceId == "gdrive" && parent.parents) {
        parent.parents.forEach(parentId => {
          func(parentId);
        });
      } else if (sourceId == "onedrive" && parent.parentReference.id) {
        func(parent.parentReference.id);
      }
    });
  };
  $scope.openFolder = function(sourceId, folderId, replace) {
    if (sourceId == "all") {
      $rootScope.sources(
        sources => {
          $scope.files.length = 0;
          sources.forEach(source => {
            if ($scope.user.connectedSources.includes(source.id)) {
              $scope.openFolder(source.id, folderId, replace);
            }
          });
          $scope.currentFolderSource = "all";
        },
        () => {
          // TODO: message on sources load failure.
        }
      );
      return;
    }
    $scope.currentFolder = folderId;
    $scope.currentFolderSource = sourceId;
    if (folderId != "root") {
      $scope.files.length = 0;
      $location.search({
        sourceId: sourceId,
        folderId: folderId
      });
    } else {
      $location.search("sourceId", null);
      $location.search("folderId", null);
    }
    if (replace) {
      $location.replace();
    }
    $.get("api/source/" + sourceId + "/" + folderId + "/listfiles", {
      uid: $rootScope.user().uid,
      params: {
        orderBy: $scope.sorting.orderByStr(sourceId)
      }
    })
      .done(function(list) {
        // TODO show a label when no files are returned (i.e. empty folder)
        list.forEach(file => {
          $scope.files.push($scope.unifySourceFile(file.source, file.dat));
        });
        $scope.sorting.sortFiles();
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $window.alert("Couldn't load " + sourceId + " files");
        console.log(xhr.responseText);
      });
    $scope.pageStack.length = 0;
    if (folderId != "root") {
      var keys = ["name"];
      switch (sourceId) {
        case "gdrive":
          keys.push("parents", "mimeType");
          break;

        case "onedrive":
          keys.push("folder", "parentReference");
          break;
      }
      $.get("api/source/" + sourceId + "/" + folderId + "/getfilemetadata", {
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

  $rootScope.user(
    user => {
      if (user.connectedSources.length == 0) {
        $location.url("/connect");
        $location.replace();
      }
      $scope.user = user;
      $.get("api/user/" + user.uid + "/navigation").done(navigation => {
        $rootScope.navButtons = navigation;
        $scope.$apply();
      });
      $scope.sorting.availableMethods.forEach(method => {
        if (method.enabled) {
          $scope.sorting.orderBy.push(method);
        }
      });
      if ($routeParams.folderId) {
        $scope.openFolder($routeParams.sourceId, $routeParams.folderId, true);
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
      $scope.openFolder(file.source, file.dat.id);
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
          $scope.onFileClick(file);
        }
      },
      {
        text: "Open in new tab",
        displayed: !file.isFolder,
        click: function($itemScope, $event, modelValue, text, $li) {
          $scope.openFile(file, true);
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
    document.getElementById("fileDetailsPane").classList.remove("ng-hide");

    var keys = ["description", "size"];
    var collections = [];
    switch (detailsFile.source) {
      case "gdrive":
        keys.push(
          "thumbnailLink",
          "starred",
          "version",
          "modifiedTime",
          "lastModifyingUser",
          "webContentLink"
        );
        break;
      case "onedrive":
        keys.push("malware", "audio", "@microsoft.graph.downloadUrl");
        collections.push("thumbnails", "versions");
        break;
    }
    $.get(
      "api/source/" +
        detailsFile.source +
        "/" +
        detailsFile.dat.id +
        "/getfilemetadata",
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
              thumbnailLink: data.thumbnailLink,
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
        $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file metadata.";
        console.log(JSON.parse(xhr.responseText));
      });

    if (detailsFile.source == "onedrive") {
      collections.forEach(collection => {
        $.get(
          "api/source/" +
            detailsFile.source +
            "/" +
            detailsFile.dat.id +
            "/getfilecollection",
          {
            uid: $rootScope.user().uid,
            collection: collection
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
                if (collection == "thumbnails") {
                  $scope.detailsFile = Object.assign($scope.detailsFile, {
                    thumbnailLink: data.value[0].large.url
                  });
                } else if (collection == "versions") {
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
            $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file metadata.";
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
        .post("api/source/" + source.id + "/beginconnect", {
          uid: $rootScope.user().uid,
          forceUpdate: false
        })
        .then(
          response => {
            if (response.status == 206) {
              if (source.id == "gdrive") {
                $location.url(
                  "/connect?" +
                    $httpParamSerializer({
                      callback: $location.url(),
                      forceUpdate: true,
                      updateSources: ["gdrive"]
                    })
                );
                $location.replace();
              } else {
                $cookies.put("app.client.data.callback", $location.url());
                $window.open(response.data, "_self");
              }
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
      $.post("api/user/" + $rootScope.user().uid + "/setaccesslevel", {
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
    $.post("api/user/" + $rootScope.user().uid + "/update/profile", {
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
        $.post("api/user/" + $rootScope.user().uid + "/update/email", {
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
        $scope.$apply();
      }
    } else {
      $scope.emailStatus = "Your email address is unchanged.";
      $scope.$apply();
    }
  };
});
