var client = angular.module("client", []);
client.run(function($rootScope) {
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
    nextStage.onStart(args);
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
  $rootScope.folders = [];
  $rootScope.files = [];
});

client.controller("clientCtrl", function($scope, $rootScope) {
  $scope.navButtons = [
    {
      url: "test.html",
      text: "Test Page"
    }
  ];
  $rootScope.switchStage("welcome");
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
    $rootScope.switchStage("login", { fromWelcome: true });
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
    $scope.stage.onStart = function() {
      if ($rootScope.user.connectedSources.length > 0) {
        $rootScope.switchStage("dashboard");
        $rootScope.$apply();
        return;
      }
      $.get("api/source/listsources", {})
        .done(function(data) {
          $rootScope.sources = JSON.parse(data);
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
            if (response.status == 201) {
              $scope.onConnect();
            }
          },
          error => {
            $window.alert("(" + error.status + ") -> " + error.data);
          }
        );
    };
    $scope.onConnect = function() {
      console.log("Connected! Yayyy");
      $scope.responseReady = false;
      $scope.authcode = "";
      $scope.redirectReady = false;
    };
    $scope.sourceConnected = function(sourceid) {
      return $rootScope.user.connectedSources.includes(sourceid);
    };
    $scope.hasConnected = function() {
      return (
        $rootScope.user != null && $rootScope.user.connectedSources.length > 0
      );
    };
    $scope.onContinue = function() {
      $rootScope.switchStage("dashboard");
    };
  }
]);

client.controller("dashboardCtrl", function($scope, $rootScope, $window) {
  $scope.stage = $rootScope.appStage.dashboard;
  $scope.ctrl = "Hiiiiiiii";
  $scope.stage.onStart = () => {
    // $rootScope.folders = [
    //   "CUHacking 2019 Positions",
    //   "Everything You Need To Know At A MLH Event",
    //   "All ideas and notes from Idea Growr (text)",
    //   "My Resume [Software Eng].pdf",
    //   "Executive Positions and Directorships",
    //   "PSYC 1001 Ch5 - Consciousness.docx",
    //   "OLAITAN_VICTOR_PSYC1001R.docxabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
    //   "OLAITAN_VICTOR GRADED.docx",
    //   "CGSC1001 Quiz 3 Review.docx",
    //   "CGSC1001 Lec 12 - Evolutionary Psychology.docx"
    // ];
    // $scope.$apply();
    $.post("api/source/startfolderlist", {
      uid: $rootScope.user.uid
    })
      .done(function(data) {
        var list = JSON.parse(data);
        list.forEach(folder => {
          $rootScope.folders.push(folder);
        });
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $window.alert("Couldn't load folders");
        console.log(error);
      });
    $.post("api/source/startfilelist", {
      uid: $rootScope.user.uid
    })
      .done(function(data) {
        var list = JSON.parse(data);
        list.forEach(file => {
          $rootScope.files.push(file);
        });
        console.log(list[5]);
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $window.alert("Couldn't load files");
        console.log(error);
      });
  };
});
