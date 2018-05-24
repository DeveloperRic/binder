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
    }
  };
  $rootScope.switchStage = function(next, args) {
    for (const i in $rootScope.appStage) {
      if ($rootScope.appStage.hasOwnProperty(i)) {
        const stage = $rootScope.appStage[i];
        if (stage.focused) {
          stage.focused = false;
          stage.onFinish(args);
        }
        if (stage.id == next) {
          stage.focused = true;
          stage.onStart(args);
        }
      }
    }
  };
  $rootScope.user = null;
  $rootScope.emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  $rootScope.validateEmail = function(email) {
    return $rootScope.emailPattern.test(String(email).toLowerCase());
  };
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
    $.post("api/newuser", {
      email: $scope.email,
      password: $scope.password
    })
      .done(function(userdata) {
        $rootScope.user = User.fromJSON(userdata);
        $rootScope.switchStage("connect");
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.postError("Oops! Something went wrong, please try again.");
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
    error.exists = true;
    error.message = message;
  };
  $scope.login = function() {
    $scope.error.exists = false;
    if (!$rootScope.validateEmail($scope.email)) {
      $scope.postError("Your email address is in the wrong format.");
      return;
    }
    $.post("api/getuser", {
      email: $scope.email,
      password: $scope.password
    })
      .done(function(data) {
        $rootScope.user = new User(data.email, data.password);
        $rootScope.switchStage("connect");
        $rootScope.$apply();
      })
      .fail(function(xhr, status, error) {
        $scope.postError("Invalid username or password!");
      });
  };
});
