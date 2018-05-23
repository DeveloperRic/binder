client.controller("loginCtrl", function($scope, $rootScope) {
  $scope.stage = $rootScope.appStage.login;

  $scope.username = "";
  $scope.password = "";
  $scope.error = error;
  $scope.login = function() {
    $.post("api/getuser", {
      username: $scope.username,
      password: $scope.password
    })
      .done(function(data) {
        $rootScope.user = new User(data.username, data.password);
        $rootScope.switchStage("connect");
      })
      .fail(function(xhr, status, error) {
        console.log(status + " : " + error);
      });
  };
});

var error = {
  exists: false,
  message: ""
};

var postError = function(message) {
  error.exists = true;
  error.message = message;
};
