var app = angular.module("landing", ["ngCookies"]);

app.controller("landingCtrl", function($scope, $interval) {
  $scope.headlines = [
    ["Ever wanted to view all your online files", "at the same time", "?"],
    ["Simplify your workflow by organising your files."],
    ["Find that old vacation photo with ", "just 1 search"],
    ["Transfer new email attachments to your drive in seconds."],
    ["Keep your precious files safe everywhere ", "without doing a thing"],
    ["Notes all over the place? Use Binder to bring them together."]
  ];
  $scope.headlineIndex = Math.floor(
    Math.random() * ($scope.headlines.length + 1)
  );
  $interval(() => {
    if ($scope.headlineIndex == $scope.headlines.length - 1) {
      $scope.headlineIndex = 0;
    } else {
      $scope.headlineIndex++;
    }
  }, 4500);
});

$(window).on("scroll", function() {
  if ($(window).scrollTop() > 10) {
    $("nav").addClass("nav-scroll");
  } else {
    $("nav").removeClass("nav-scroll");
  }
});
