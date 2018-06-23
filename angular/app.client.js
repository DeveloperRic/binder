var client = angular.module("client", ["ui.bootstrap.contextMenu"]);
client.run(function($rootScope, $location) {
  $rootScope.appStage = {
    welcome: {
      id: "welcome",
      focused: false,
      onStart: () => {},
      onFinish: () => {}
    },
    login: {
      id: "login",
      focused: false,
      onStart: () => {},
      onFinish: () => {}
    },
    connect: {
      id: "connect",
      focused: false,
      onStart: () => {},
      onFinish: () => {}
    },
    dashboard: {
      id: "dashboard",
      focused: false,
      onStart: () => {},
      onFinish: () => {}
    }
  };
  $rootScope.switchStage = function(next, args) {
    var nextStage;
    for (const i in $rootScope.appStage) {
      if ($rootScope.appStage.hasOwnProperty(i)) {
        var stage = $rootScope.appStage[i];
        if (stage.focused) {
          stage.focused = false;
          stage.onFinish(args);
        }
        if (stage.id == next) {
          nextStage = stage;
        }
      }
    }
    nextStage.focused = true;
    // $location.path(next);
    // if (args) {
    //   $location.search(JSON.stringify(args));
    // } else {
    //   $location.search({});
    // }
    // $location.replace();
    if (args) {
      nextStage.onStart(args);
    } else {
      nextStage.onStart({});
    }
  };
  $rootScope.user = null;
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
});

client.controller("clientCtrl", function($scope, $rootScope, $location) {
  $scope.navButtons = [
    {
      url: "test.html",
      text: "Test Page"
    }
  ];
  if ($location.path() == "") {
    $rootScope.switchStage("welcome");
  } else {
    if ($location.search()) {
      $rootScope.switchStage($location.path().replace("/", ""));
    } else {
      $rootScope.switchStage($location.path().replace("/", ""));
    }
  }
  $scope.extendGDriveScope = function() {
    $.put("api/source/gdrive/extendscope", {
      uid: $rootScope.user.uid
    })
      .done(function(userdata) {
        $rootScope.user = userdata;
        $rootScope.switchStage("connect", {
          forceUpdate: true,
          updateSources: ["gdrive"]
        });
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

client.controller("welcomeCtrl", function($scope, $rootScope) {
  $scope.stage = $rootScope.appStage.welcome;
  $scope.stage.onStart = function() {
    // lets assume that no cookies have been stored (for now)
    // var encrptedUsername = $cookieStore.get("username");
    // console.log(encrptedUsername);
  };

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
        $rootScope.switchStage("connect");
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.postError("That email address is already being used.");
      });
  };
  $scope.login = function() {
    $rootScope.switchStage("login", {
      fromWelcome: true,
      email: $scope.email,
      password: $scope.password
    });
  };
});

client.controller("loginCtrl", function($scope, $rootScope) {
  $scope.stage = $rootScope.appStage.login;
  $scope.stage.onStart = function(args) {
    if (args.fromWelcome) {
      $scope.canReturn = true;
      $scope.return = function() {
        $rootScope.switchStage("welcome");
      };
      // $scope.email = args.email;
      // $scope.password = args.password;
    }
  };

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
    $.post("api/user/getuser", {
      email: $scope.email,
      password: $scope.password
    })
      .done(function(data) {
        $rootScope.user = data;
        $rootScope.switchStage("connect");
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.postError("Incorrect username or password.");
        $scope.$apply();
      });
  };
});

client.controller("connectCtrl", [
  "$scope",
  "$rootScope",
  "$http",
  "$window",
  function($scope, $rootScope, $http, $window) {
    $scope.stage = $rootScope.appStage.connect;
    $scope.stage.onStart = function(args) {
      if ($rootScope.user.connectedSources.length > 0 && !args.forceUpdate) {
        $rootScope.switchStage("dashboard");
        $rootScope.$apply();
        return;
      }
      $.get("api/source/listsources", {})
        .done(function(data) {
          $rootScope.sources = JSON.parse(data);
          $rootScope.sources.forEach(source => {
            $scope.sourceConnected[
              source
            ] = $rootScope.user.connectedSources.includes(source);
          });
          if (args.updateSources) {
            args.updateSources.forEach(source => {
              $scope.sourceConnected[source] = false;
            });
          }
          $rootScope.$apply();
        })
        .fail(function(xhr, status, error) {
          $window.alert("Couldn't load sources.");
        });
    };
    $scope.redirectReady = false;
    $scope.redirectURL = "";
    $scope.selected = null;
    $scope.onSelect = function(sourceid) {
      $scope.selected = $rootScope.getSource(sourceid);
      $http
        .post("api/source/beginconnect", {
          sourceid: sourceid,
          uid: $rootScope.user.uid
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
      $window.open($scope.redirectURL);
      $scope.responseReady = true;
    };
    $scope.responseReady = false;
    $scope.authcode = "";
    $scope.onResponse = () => {
      $http
        .post("api/source/finishconnect", {
          sourceid: $scope.selected.id,
          uid: $rootScope.user.uid,
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
    $scope.sourceConnected = {
      gdrive: false,
      onedrive: false,
      onedrive365: false
    };
    $scope.onContinue = function() {
      $rootScope.switchStage("dashboard");
    };
  }
]);

client.controller("dashboardCtrl", function($scope, $rootScope, $window) {
  $scope.stage = $rootScope.appStage.dashboard;
  $scope.stage.onStart = args => {
    if (args.pageStack) {
      $scope.pageStack = args.pageStack;
      $scope.openFolder($scope.pageStack.pop().id);
    } else {
      $scope.openFolder("root");
    }
  };
  $scope.files = [];
  $scope.pageStack = [];
  $scope.openFolder = function(folderId) {
    $.post("api/source/startfilelist", {
      uid: $rootScope.user.uid,
      folderId: folderId
    })
      .done(function(data) {
        $scope.pageStack.push({
          source: "gdrive",
          id: folderId
        });
        $scope.canReturn = $scope.pageStack.length > 1;

        var list = JSON.parse(data);
        $scope.files.length = 0;
        let tempFiles = [];
        list.forEach(file => {
          if (file.mimeType == "application/vnd.google-apps.folder") {
            $scope.files.push({
              isFolder: true,
              dat: file
            });
          } else {
            tempFiles.push({
              isFolder: false,
              dat: file
            });
          }
        });
        tempFiles.forEach(file => $scope.files.push(file));
        $scope.$apply();
      })
      .fail(function(xhr, status, error) {
        $window.alert("Couldn't load files");
        console.log(xhr.responseText);
      });
  };
  $scope.canReturn = false;
  $scope.return = function() {
    $scope.pageStack.pop();
    $scope.openFolder($scope.pageStack.pop().id);
    $scope.canReturn = $scope.pageStack.length > 1;
  };
  $scope.onFileClick = function(file) {
    if (file.isFolder) {
      $scope.openFolder(file.dat.id);
    } else {
      $window.open(file.dat.webViewLink, "_blank");
    }
  };
  $scope.onFileRightClick = function(file) {
    if (file.isFolder) {
      $scope.openFolder(file.dat.id);
    } else {
      $window.open(file.dat.webViewLink, "_blank");
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
        click: function($itemScope, $event, modelValue, text, $li) {
          $window.open(file.dat.webViewLink, "_blank");
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
        displayed: !file.isFolder,
        click: function() {
          $.post("api/source/getfilemetadata", {
            uid: $rootScope.user.uid,
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
      uid: $rootScope.user.uid,
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
        $scope.detailsFile.dat = $.extend(
          $scope.detailsFile.dat,
          JSON.parse(data)
        );
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
      uid: $rootScope.user.uid,
      fileId: file.dat.id,
      metadata: {
        starred: true
      }
    })
      .done(function(data) {
        file.dat = $.extend(
          file.dat,
          JSON.parse(data)
        );
        $scope.$apply();
        console.log(file.dat.starred);
      })
      .fail(function(xhr, status, error) {
        console.log(JSON.parse(xhr.responseText));
      });
  };
});
