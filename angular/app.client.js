var client = angular.module("client", []);
client.run(function($rootScope) {
  $rootScope.appStage = {
    login: {
      id: "login",
      focused: true,
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
  $rootScope.switchStage = function(next) {
    $rootScope.appStage.foreach(stage => {
      if (stage.focused) {
        stage.focused = false;
        stage.onFinish();
      }
      if (stage.id == next) {
        stage.focused = true;
        stage.onStart();
      }
    });
  };
  $rootScope.user = null;
});
client.controller("clientCtrl", function($scope, $rootScope) {
  $scope.navButtons = [
    {
      url: "test.html",
      text: "Test Page"
    }
  ];
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
