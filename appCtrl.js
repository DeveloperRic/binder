app.controller("appCtrl", function($scope) {
  $scope.people = [{
      firstname: "Victor"
    },
    {
      firstname: "Paul"
    },
    {
      firstname: "Emma"
    },
    {
      firstname: "Femi"
    }
  ];
  $scope.sources = sources;
  $scope.navButtons = navButtons;
});

app.controller("loginController", function($scope) {

});

$(document).ready(function() {
  $("a").on('click', function(event) {
    if (this.hash !== "") {
      event.preventDefault();
      var hash = this.hash;

      $('html, body').animate({
        scrollTop: $(hash).offset().top
      }, 600, function() {
        window.location.hash = hash;
      });
    }
  });
});
