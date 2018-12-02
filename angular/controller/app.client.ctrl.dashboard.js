"use strict";

define(["app.client"], function(client) {
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
    $scope.tiles = [];
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
            var index = -1;
            sources.forEach(source => {
              index++;
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
              $scope.tiles.push({ type: "files", source: source });
            });
            // sources.forEach(source => {
            //   if (user.connectedSources.includes(source.id)) {
            //     $scope.tiles.push({
            //       type: "upload",
            //       source: source
            //     });
            //   }
            // });
            sources.forEach(source => {
              if (user.connectedSources.includes(source.id)) {
                $scope.tiles.push({
                  type: "search",
                  source: source
                });
              }
            });
            $scope.requestStatus.setStatus("");
            $scope.$apply();
          },
          () => {
            $scope.requestStatus.setStatus("errorLoading");
            $rootScope.showPopup("error", "Couldn't load sources");
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
});
