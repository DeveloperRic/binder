var app = angular.module("landing", ["ngCookies"]);

$(window).on("scroll", function() {
  if ($(window).scrollTop() > 10) {
    $("nav").addClass("nav-scroll");
  } else {
    $("nav").removeClass("nav-scroll");
  }
});