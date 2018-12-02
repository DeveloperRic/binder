"use strict";

define(["app.client"], function(client) {
  client.controller("filesCtrl", function(
    $scope,
    $rootScope,
    $routeParams,
    $location,
    $window,
    $httpParamSerializer,
    $interval,
    $cookies,
    $route
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
          $scope.sorting.updateSortCookie();
        } else {
          $scope.sorting.toggleCriteria(criteria);
        }
        $scope.openFolderCallback();
      },
      updateSortCookie: function() {
        var sortOrderCookie = [];
        $scope.sorting.orderBy.forEach(method => {
          sortOrderCookie.push({
            text: method.text,
            descending: method.descending
          });
        });
        $cookies.putObject("app.client.data.files.orderBy", sortOrderCookie);
      }
    };
    $scope.requestStatus = {
      loadingChildren: true,
      errorLoading: false,
      searching: false,
      setStatus: function(status) {
        for (let key in $scope.requestStatus) {
          if (key != "setStatus") {
            $scope.requestStatus[key] = key == status;
          }
        }
      }
    };
    $scope.files = [];
    $scope.currentFolderSourceName = "Files";
    $scope.currentFolderSource = "all";
    $scope.unifySourceFile = function(sourceId, fileDat) {
      var file = {
        id: fileDat.id,
        isFolder: false,
        source: sourceId,
        dat: fileDat,
        parentId: null
      };
      switch (sourceId) {
        case "gdrive":
          file.isFolder =
            fileDat.mimeType == "application/vnd.google-apps.folder";
          file.parentId = fileDat.parents[0];
          break;

        case "onedrive":
          file.isFolder = fileDat.folder ? true : false;
          file.parentId = fileDat.parentReference;
          break;

        case "dropbox":
          file.id = fileDat.path_display;
          file.isFolder = fileDat[".tag"] == "folder";
          break;
      }
      return file;
    };
    $scope.getFileParents = function(sourceId, fileId, keys) {
      $.get("api/source/" + sourceId + "/" + fileId + "/get_metadata", {
        uid: $rootScope.user().uid,
        keys: keys
      }).done(parent => {
        var getNextParent = function(id) {
          $.get("api/source/" + sourceId + "/" + id + "/get_metadata", {
            uid: $rootScope.user().uid,
            keys: keys
          }).done(parent => {
            if (sourceId == "onedrive" && !parent.parentReference.id) {
              parent.name = "My OneDrive";
            }
            $scope.pageStack.splice(
              0,
              0,
              $scope.unifySourceFile(sourceId, parent)
            );
            $scope.$apply();
          });
          $scope.getFileParents(sourceId, id, keys);
        };

        if (sourceId == "gdrive" && parent.parents) {
          parent.parents.forEach(parentId => {
            getNextParent(parentId);
          });
        } else if (sourceId == "onedrive" && parent.parentReference.id) {
          getNextParent(parent.parentReference.id);
        }
      });
    };
    $scope.openFolderCallback = () => {};
    $scope.openFolder = function(
      sourceId,
      folderId,
      replace,
      batchRequest,
      doNotClear
    ) {
      if ($location.path() != "/files") {
        $location.path("/files");
      }
      $scope.requestStatus.setStatus("loadingChildren");
      if (sourceId == "all") {
        $rootScope.sources(
          sources => {
            if (!doNotClear) {
              $scope.files.length = 0;
            }
            sources.forEach(source => {
              if ($scope.user.connectedSources.includes(source.id)) {
                $scope.openFolder(source.id, folderId, replace, true);
              }
            });
            $location.search("sourceId", null);
            $location.search("folderId", null);
            $scope.$apply();
          },
          () => {
            $scope.requestStatus.setStatus("errorLoading");
            $rootScope.showPopup("error", "Couldn't load sources");
            $scope.$apply();
          }
        );
        return;
      }
      $scope.currentFolder = folderId;
      $scope.currentFolderSource = batchRequest ? "all" : sourceId;
      var folderIndex = 0;
      if (folderId != "root") {
        if (!doNotClear) {
          $scope.files.length = 0;
        }
        $location.search({
          sourceId: sourceId,
          folderId: folderId
        });
      }
      if (replace) {
        $location.replace();
      }
      var requestFolderUrl = "/" + folderId;
      var requestParams = {
        uid: $rootScope.user().uid,
        pageToken: $scope.nextPageToken,
        params: {
          orderBy: $scope.sorting.orderByStr(sourceId)
        }
      };
      if (sourceId == "dropbox") {
        requestFolderUrl = "";
        requestParams = Object.assign(requestParams, {
          folderPath: folderId
        });
      }
      var qualifyStartIndex = $scope.files.length;
      $.get(
        "api/source/" + sourceId + requestFolderUrl + "/files",
        requestParams
      )
        .done(function(res) {
          $scope.nextPageToken = res.nextPageToken;
          var list = res.files;
          list.forEach(file => {
            var fileWrapper = $scope.unifySourceFile(file.source, file.dat);
            // sort the files by folder for sources that don't enable that kind of sorting
            if (sourceId != "gdrive" || $scope.currentFolderSource == "all") {
              if (fileWrapper.isFolder) {
                $scope.files.splice(folderIndex, 0, fileWrapper);
                folderIndex++;
              } else {
                $scope.files.push(fileWrapper);
              }
            } else {
              $scope.files.push(fileWrapper);
            }
          });
          $scope.openFolderCallback = () => {
            $scope.openFolder(
              $scope.currentFolderSource,
              $scope.currentFolder,
              true,
              batchRequest,
              true
            );
          };
          if (sourceId == "dropbox" && $scope.files.length > 0) {
            $scope.pageStack.length = 0;
            var path = $scope.files[0].id + "";
            if (path.lastIndexOf("/") > 0) {
              var pageNames = path
                .substr(1, path.lastIndexOf("/") - 1)
                .split("/");
              var updatedPath = "";
              for (let i in pageNames) {
                updatedPath += "/" + pageNames[i];
                $scope.pageStack.push(
                  $scope.unifySourceFile(sourceId, {
                    ".tag": "folder",
                    path_display: updatedPath,
                    name: pageNames[i]
                  })
                );
              }
            }
          }
          $scope.requestStatus.setStatus("");
          $scope.$apply();
          $scope.qualifyFileList(sourceId, qualifyStartIndex);
        })
        .fail(function(xhr, textStatus, error) {
          $scope.requestStatus.setStatus("errorLoading");
          $scope.$apply();
          console.log(xhr.responseText);
        });
      if (folderId != "root" && sourceId != "dropbox") {
        $scope.pageStack.length = 0;
        var keys = ["name"];
        switch (sourceId) {
          case "gdrive":
            keys.push("parents", "mimeType");
            break;

          case "onedrive":
            keys.push("folder", "parentReference");
            break;
        }
        $.get("api/source/" + sourceId + "/" + folderId + "/get_metadata", {
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
    $scope.qualifyFileList = function(sourceId, qualifyStartIndex) {
      if (!!!qualifyStartIndex) {
        qualifyStartIndex = 0;
      }
      if (sourceId != "dropbox") {
        var index = -1;
        $scope.files.forEach(file => {
          index++;
          if (index >= qualifyStartIndex) {
            if (file.source == "gdrive") {
              $interval(
                () => {
                  $.get("api/source/gdrive/" + file.id + "/get_metadata", {
                    uid: $rootScope.user().uid,
                    keys: ["thumbnailLink"]
                  })
                    .done(function(data) {
                      file.dat = Object.assign(file.dat, data);
                      file = Object.assign(file, {
                        thumbnailLink: data.thumbnailLink
                      });
                      $scope.$apply();
                    })
                    .fail(function(xhr, textStatus, error) {
                      file.thumbnailLinkAlt = "Couldn't get file metadata";
                      console.log(JSON.parse(xhr.responseText));
                    });
                },
                150 * (index + 1),
                1
              );
            } else if (file.source == "onedrive") {
              $.get(
                "api/source/onedrive/" + file.id + "/collection/thumbnails",
                {
                  uid: $rootScope.user().uid
                }
              )
                .done(function(data) {
                  file.dat = Object.assign(file.dat, {
                    thumbnails: data.value
                  });
                  // add another switch if a different source also separates collection calls
                  if (data.value) {
                    try {
                      file = Object.assign(file, {
                        thumbnailLink: data.value[0].large.url
                      });
                      $scope.$apply();
                    } catch (error) {}
                  }
                })
                .fail(function(xhr, textStatus, error) {
                  file.thumbnailLinkAlt = "Couldn't get file thumbnail";
                  console.log(JSON.parse(xhr.responseText));
                });

              $.get("api/source/onedrive/" + file.id + "/get_metadata", {
                uid: $rootScope.user().uid,
                keys: ["@microsoft.graph.downloadUrl"]
              })
                .done(function(data) {
                  file.dat = Object.assign(file.dat, data);
                  file = Object.assign(file, {
                    streamURL: data["@microsoft.graph.downloadUrl"]
                  });
                  $scope.$apply();
                })
                .fail(function(xhr, textStatus, error) {
                  console.log(JSON.parse(xhr.responseText));
                });
            }
          }
        });
      } else {
        var filePaths = [];
        $scope.files.forEach(file => {
          if (file.source == "dropbox") {
            filePaths.push(file.id);
          }
        });
        if (filePaths.length > 0) {
          $.get("/api/source/dropbox/thumbnails", {
            uid: $rootScope.user().uid,
            filePaths: filePaths
          })
            .done(function(entries) {
              entries.forEach(entry => {
                if (entry[".tag"] != "failure") {
                  var metadata = $scope.unifySourceFile(
                    "dropbox",
                    entry.metadata
                  );
                  for (let i in $scope.files) {
                    if (
                      $scope.files[i].source == "dropbox" &&
                      $scope.files[i].id == metadata.id
                    ) {
                      $scope.files[i] = Object.assign(
                        $scope.files[i],
                        Object.assign(metadata, {
                          thumbnailLink:
                            "data:image/gif;base64," + entry.thumbnail
                        })
                      );
                      break;
                    }
                  }
                }
              });
              $scope.$apply();
            })
            .fail(function(xhr, textStatus, error) {
              $scope.files.forEach(file => {
                if (file.source == "dropbox") {
                  file.thumbnailLinkAlt = "Couldn't get file thumbnail";
                }
              });
              console.log(JSON.parse(xhr.responseText));
            });
        }
        $scope.files.forEach(file => {
          if (file.source == "dropbox" && !file.isFolder) {
            file = Object.assign(file, {
              versionNumber: "Unknown",
              lastModified: file.dat.server_modified,
              lastModifiedBy: "Unknown"
            });
            $.get("/api/source/dropbox/preview", {
              uid: $rootScope.user().uid,
              filePath: file.id
            }).done(function(preview) {
              file = Object.assign(file, {
                preview: preview
              });
              $scope.$apply();
            });
            $.get("/api/source/dropbox/content", {
              uid: $rootScope.user().uid,
              filePath: file.id
            })
              .done(function(response) {
                if (response[".tag"] != "failure") {
                  var metadata = $scope.unifySourceFile(
                    "dropbox",
                    response.metadata
                  );
                  file = Object.assign(
                    file,
                    Object.assign(metadata, {
                      streamURL: response.link
                    })
                  );
                  file.dat = Object.assign(file.dat, {
                    audio: new RegExp(/\.(mp3|wav|aac)$/i).test(
                      file.dat.path_lower
                    )
                  });
                  $scope.$apply();
                }
              })
              .fail(function(xhr, textStatus, error) {
                console.log(JSON.parse(xhr.responseText));
              });
          }
        });
      }
    };
    $rootScope.searching = {
      searchQuery: "",
      search: function(query, sourceId, doNotClear) {
        query = query.replace("'", "").replace('"', "");
        if ($location.path() != "/files/search") {
          $location
            .path("/files/search")
            .search({ q: query, sourceId: sourceId });
          return;
        } else {
          $location.search({ q: query, sourceId: sourceId });
          $location.replace();
        }
        $scope.searching.insideSearch = true;
        $rootScope.searching.searchQuery = query;
        $rootScope.searching.searchSource = sourceId;
        $scope.currentFolderSourceName = "Search results";
        var qualifyStartIndex = $scope.files.length;
        if (!!!$scope.nextSearchTokens) {
          $scope.nextSearchTokens = {};
        }
        $scope.requestStatus.setStatus("searching");
        var sourcesToComplete = 0;
        var sourcesCompleted = 0;
        var checkSearchComplete = () => {
          sourcesCompleted++;
          if (sourcesCompleted >= sourcesToComplete) {
            $scope.requestStatus.setStatus("");
          }
        };
        $rootScope.sources(
          sources => {
            if (!doNotClear) {
              $scope.files.length = 0;
            }
            sources.forEach(source => {
              if (!!!sourceId || source.id == sourceId) {
                if ($scope.user.connectedSources.includes(source.id)) {
                  if (!!sourceId) {
                    $scope.currentFolderSourceName +=
                      " in " +
                      source.name +
                      " (click to search in all sources)";
                  }
                  if (!$scope.requestStatus.searching) {
                    $scope.requestStatus.setStatus("searching");
                  }
                  sourcesToComplete++;
                  $.get("api/source/" + source.id + "/search", {
                    uid: $rootScope.user().uid,
                    query: query,
                    pageToken: $scope.nextSearchTokens[source.id],
                    params: {
                      orderBy: $scope.sorting.orderByStr(source.id)
                    }
                  })
                    .done(function(res) {
                      $scope.nextSearchTokens = Object.assign(
                        $scope.nextSearchTokens,
                        { [source.id]: res.nextPageToken }
                      );
                      var list = res.files;
                      list.forEach(file => {
                        $scope.files.push(
                          $scope.unifySourceFile(file.source, file.dat)
                        );
                      });
                      $scope.openFolderCallback = () => {
                        $rootScope.searching.search(
                          $rootScope.searching.searchQuery,
                          sourceId,
                          true
                        );
                      };
                      checkSearchComplete();
                      $scope.$apply();
                      $scope.qualifyFileList(source.id);
                    })
                    .fail(function(xhr, textStatus, error) {
                      $scope.requestStatus.setStatus("errorLoading");
                      $scope.$apply();
                      console.log(xhr.responseText);
                    });
                } else {
                  $scope.requestStatus.setStatus("errorLoading");
                  $scope.$apply();
                }
              }
            });
          },
          () => {
            $scope.requestStatus.setStatus("errorLoading");
            $rootScope.showPopup("error", "Couldn't load sources");
            $scope.$apply();
          }
        );
      }
    };

    $rootScope.user(
      user => {
        if (user.connectedSources.length == 0) {
          $location.url("/dashboard");
          $location.replace();
        }
        $scope.user = user;
        $.get("api/user/" + user.uid + "/navigation").done(navigation => {
          $rootScope.navButtons = navigation;
          try {
            $scope.$apply();
          } catch (error) {}
        });
        var sortOrder = $cookies.getObject("app.client.data.files.orderBy");
        if (sortOrder) {
          sortOrder.forEach(method => {
            for (let i in $scope.sorting.availableMethods) {
              if ($scope.sorting.availableMethods[i].text == method.text) {
                $scope.sorting.availableMethods[i].enabled = true;
                $scope.sorting.availableMethods[i].descending =
                  method.descending;
                break;
              }
            }
          });
        }
        $scope.sorting.availableMethods.forEach(method => {
          if (method.enabled) {
            $scope.sorting.orderBy.push(method);
          }
        });
        if ($routeParams.folderId) {
          $scope.openFolder($routeParams.sourceId, $routeParams.folderId, true);
          $rootScope.sources(
            sources => {
              for (let i in sources) {
                if (sources[i].id == $routeParams.sourceId) {
                  $scope.currentFolderSourceName = sources[i].name;
                  $scope.$apply();
                  break;
                }
              }
            },
            () => {}
          );
        } else if ($location.path() == "/files/search") {
          if ($routeParams.q) {
            $rootScope.searching.search($routeParams.q, $routeParams.sourceId);
          } else {
            $rootScope.showPopup("input", "Search", "find files everywhere", {
              type: "text",
              placeholder: "What're you looking for?",
              newValue: "",
              checkComplete: q => {
                return q;
              },
              close: q => {
                $rootScope.popup = null;
                if (!!q) {
                  $rootScope.searching.search(q);
                }
              }
            });
            $scope.requestStatus.setStatus("");
          }
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
        $scope.openFolder(file.source, file.id);
      } else {
        $scope.openFile(file);
      }
    };
    $scope.openFile = function(file, openInNewTab) {
      var target;
      if (!!$cookies.get("app.client.data.openFileInNewTab")) {
        if ($cookies.get("app.client.data.openFileInNewTab") == "true") {
          target = "_blank";
        } else {
          target = "_self";
        }
      } else if (!openInNewTab) {
        $rootScope.showPopup("select", "How do you want to open files?", null, {
          detailsArray: [
            "Opening files in the same tab will force Binder to reload the current page.",
            " This action will set a cookie on your browser. Make sure Binder is allowed to set cookies."
          ],
          options: ["Open in current tab", "Open in new tab"],
          selectedOption: -1,
          selectOption: i => {
            $rootScope.popup.selectedOption = i;
          },
          close: done => {
            if (done) {
              var cookieExpiry = new Date();
              cookieExpiry.setFullYear(
                cookieExpiry.getFullYear() + 1,
                cookieExpiry.getMonth() + 1
              );
              $cookies.put(
                "app.client.data.openFileInNewTab",
                $rootScope.popup.selectedOption == 1,
                { expires: cookieExpiry.toUTCString() }
              );
              $scope.openFile(file, openInNewTab);
            }
            $rootScope.popup = null;
          }
        });
        return;
      }
      target = !!openInNewTab ? "_blank" : target;
      switch (file.source) {
        case "gdrive":
          $window.open(file.dat.webViewLink, target);
          break;
        case "onedrive":
          $window.open(file.dat.webUrl, target);
          break;
        case "dropbox":
          $rootScope.showPopup(
            "info",
            "Dropbox does not allow you to view files online from an external source.\n",
            "However, you can still download the file by right-clicking and selecting 'Download'."
          );
          break;
      }
    };
    function fileContextMenuItemHTML(icon, text) {
      return (
        "<span class='context-menu-item'><i class='material-icons'>" +
        icon +
        "</i>" +
        text +
        "</span>"
      );
    }
    $scope.fileContextMenu = function(file) {
      var menu = [
        {
          html: fileContextMenuItemHTML("picture_in_picture", "Preview"),
          displayed: false, // !file.isFolder
          click: function($itemScope, $event, modelValue, text, $li) {
            $rootScope.showPopup(
              "info",
              "Preview isn't available yet",
              "Don't worry, it's currently under development :)"
            );
            //$scope.previewFile(file);
          }
        },
        {
          html: fileContextMenuItemHTML("explore", "Explore"),
          displayed: file.isFolder,
          click: function() {
            $scope.onFileClick(file);
          }
        },
        {
          html: fileContextMenuItemHTML("open_in_new", "Open in new tab"),
          displayed: !file.isFolder,
          click: function() {
            $scope.openFile(file, true);
          }
        },
        {
          html: fileContextMenuItemHTML("info_outline", "Info"),
          displayed: !file.isFolder,
          click: function() {
            $scope.showFileDetails(file);
          }
        },
        {
          html: fileContextMenuItemHTML("forward", "Move"),
          displayed: false,
          click: function() {
            $scope.moveFile(file);
          }
        },
        {
          html: fileContextMenuItemHTML("label", "Rename"),
          click: function() {
            $scope.renameFile(file);
          }
        },
        {
          html: fileContextMenuItemHTML("file_download", "Download"),
          click: function() {
            $scope.downloadFile(file);
          }
        }
      ];
      var audioRegex = new RegExp(/\.(mp3|wav|aac)$/i);
      if (audioRegex.test(file.id) || audioRegex.test(file.name)) {
        menu.splice(0, 1, {
          html: fileContextMenuItemHTML("play_arrow", "Play"),
          click: function() {
            $scope.showFileDetails(file);
          }
        });
      }
      return menu;
    };
    $scope.detailsFile = null;
    $scope.postAudioToRoot = file => {
      var generatePlaylist = () => {
        var playlist = [];
        var foundFile = false;
        for (let i in $scope.files) {
          if (playlist.length >= 10) {
            break;
          }
          if ($scope.files[i].id == file.id) {
            foundFile = true;
          } else if (foundFile) {
            playlist.push($scope.files[i].streamURL);
          }
        }
        return playlist;
      };
      $scope.$$postDigest(() => {
        var fileInfoAudio = document.getElementById("fileInfoAudio");
        fileInfoAudio.onplay = () => {
          $rootScope.audio = null;
          $rootScope.$apply();
        };
        fileInfoAudio.ontimeupdate = () => {
          var expirationDate = new Date();
          expirationDate.setTime(expirationDate.getTime() + 3600000);
          $cookies.putObject(
            "app.client.data.audioTime",
            {
              src: file.streamURL,
              time: fileInfoAudio.currentTime,
              playlist: generatePlaylist()
            },
            { expires: expirationDate.toUTCString() }
          );
        };
        fileInfoAudio.onended = () => {
          $rootScope.transferAudioToRoot();
          $rootScope.$apply();
        };
      });
    };
    $scope.showFileDetails = function(detailsFile) {
      $scope.detailsFile = detailsFile;

      $rootScope.audio = null;
      $cookies.remove("app.client.data.audioTime");

      if (detailsFile.source != "dropbox") {
        var keys = ["description", "size"];
        var collections = [];
        switch (detailsFile.source) {
          case "gdrive":
            keys.push(
              "starred",
              "version",
              "modifiedTime",
              "lastModifyingUser",
              "webContentLink"
            );
            break;
          case "onedrive":
            keys.push("malware", "audio", "@microsoft.graph.downloadUrl");
            collections.push("versions");
            break;
        }
        $.get(
          "api/source/" +
            detailsFile.source +
            "/" +
            detailsFile.id +
            "/get_metadata",
          {
            uid: $rootScope.user().uid,
            keys: keys
          }
        )
          .done(function(data) {
            $scope.detailsFile.dat = Object.assign(
              $scope.detailsFile.dat,
              data
            );
            switch (detailsFile.source) {
              case "gdrive":
                $scope.detailsFile = Object.assign($scope.detailsFile, {
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
            if (!!$scope.detailsFile.dat.audio) {
              $scope.postAudioToRoot($scope.detailsFile);
            }
            $scope.$apply();
          })
          .fail(function(xhr, textStatus, error) {
            $scope.detailsFile.thumbnailLinkAlt = "Couldn't get file metadata";
            console.log(JSON.parse(xhr.responseText));
          });

        if (detailsFile.source == "onedrive") {
          collections.forEach(collection => {
            $.get(
              "api/source/onedrive/" +
                detailsFile.id +
                "/collection/" +
                collection,
              {
                uid: $rootScope.user().uid
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
                    if (collection == "versions") {
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
              .fail(function(xhr, textStatus, error) {
                $scope.detailsFile.thumbnailLinkAlt =
                  "Couldn't get file metadata";
                console.log(JSON.parse(xhr.responseText));
              });
          });
        }
      } else if (detailsFile.streamURL) {
        $interval(
          () => {
            $scope.postAudioToRoot(detailsFile);
          },
          1000,
          1
        );
      }
    };
    $scope.closeFileDetailsPane = function() {
      $scope.detailsFile = null;
      $rootScope.audio = null;
      $cookies.remove("app.client.data.audioTime");
    };
    $scope.onMainPaneClick = function() {
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
      $scope.errorUpdatingFile = false;
      $scope.updatingFile = true;
      $.post("api/source/gdrive/" + file.id + "/update_metadata", {
        uid: $rootScope.user().uid,
        fileId: file.id,
        metadata: {
          starred: !file.dat.starred
        }
      })
        .done(function(data) {
          file.dat = Object.assign(file.dat, data);
          $scope.updatingFile = false;
          $scope.$apply();
        })
        .fail(function(xhr, textStatus, error) {
          $scope.errorUpdatingFile = true;
          $scope.$apply();
          console.log(JSON.parse(xhr.responseText));
        });
    };
    $scope.renameFile = function(file) {
      $rootScope.showPopup(
        "input",
        "Rename file (" + file.dat.name + ")",
        null,
        {
          type: "text",
          placeholder: "Type a new name in here",
          newValue: file.dat.name,
          checkComplete: newName => {
            return newName;
          },
          close: newName => {
            $rootScope.popup = null;
            if (!!newName) {
              renameFile(file, newName);
            }
          }
        }
      );
    };
    function renameFile(file, newName) {
      $scope.errorUpdatingFile = false;
      $scope.updatingFile = true;
      console.log(newName);
      var requestUrl =
        "api/source/" + file.source + "/" + file.id + "/update_metadata";
      if (file.source == "dropbox") {
        requestUrl = "api/source/dropbox/update_metadata";
        if (file.dat.path_display.lastIndexOf("/") > 0) {
          newName =
            file.dat.path_display.substr(
              0,
              file.dat.path_display.lastIndexOf("/")
            ) +
            "/" +
            newName;
        } else {
          newName = "/" + newName;
        }
      }
      console.log(newName);
      $.post(requestUrl, {
        uid: $rootScope.user().uid,
        filePath: file.id,
        metadata: {
          name: newName
        }
      })
        .done(function(data) {
          file.dat = Object.assign(file.dat, data);
          $scope.updatingFile = false;
          $scope.$apply();
        })
        .fail(function(xhr, textStatus, error) {
          $scope.errorUpdatingFile = true;
          $scope.$apply();
          console.log(xhr.responseText);
        });
    }
    $scope.moveFile = function(file) {
      var popupFiles = [];
      $scope.files.forEach(file => {
        if (file.isFolder) {
          popupFiles.push(file);
        }
      });
      $rootScope.showPopup("file-choose", "Choose a new location", null, {
        files: {
          hasBack: $scope.pageStack.length > 0,
          list: popupFiles
        },
        pageIndex: 0,
        navigate: i => {
          $rootScope.popup.pageIndex += i < 0 ? -1 : 1;
          var sourceId = file.id;
          var folderId;
          if (i == -1) {
            folderId = file.parentId;
          } else {
            folderId = $rootScope.popup.files.list[i].id;
          }
          var requestFolderUrl = "/" + folderId;
          var requestParams = {
            uid: $rootScope.user().uid,
            pageToken: $scope.nextPageToken,
            params: {
              orderBy: $scope.sorting.orderByStr(sourceId)
            }
          };
          if (sourceId == "dropbox") {
            requestFolderUrl = "";
            requestParams = Object.assign(requestParams, {
              folderPath: folderId
            });
          }
          $.get(
            "api/source/" + sourceId + requestFolderUrl + "/files",
            requestParams
          )
            .done(function(res) {
              var list = res.files;
              list.forEach(file => {
                var fileWrapper = $scope.unifySourceFile(file.source, file.dat);
                // sort the files by folder for sources that don't enable that kind of sorting
                if (sourceId != "gdrive") {
                  if (fileWrapper.isFolder) {
                    $scope.files.splice(folderIndex, 0, fileWrapper);
                    folderIndex++;
                  } else {
                    $scope.files.push(fileWrapper);
                  }
                } else {
                  $scope.files.push(fileWrapper);
                }
              });
              $scope.$apply();
            })
            .fail(function(xhr, textStatus, error) {
              console.log(xhr.responseText);
            });
        },
        close: selectedFile => {
          $rootScope.popup = null;
          if (!!selectedFile) {
            // moveFile(file, newParent);
          }
        }
      });
    };
    function moveFile(file, newName) {
      $scope.errorUpdatingFile = false;
      $scope.updatingFile = true;
      console.log(newName);
      var requestUrl =
        "api/source/" + file.source + "/" + file.id + "/update_metadata";
      if (file.source == "dropbox") {
        requestUrl = "api/source/dropbox/update_metadata";
        if (file.dat.path_display.lastIndexOf("/") > 0) {
          newName =
            file.dat.path_display.substr(
              0,
              file.dat.path_display.lastIndexOf("/")
            ) +
            "/" +
            newName;
        } else {
          newName = "/" + newName;
        }
      }
      console.log(newName);
      $.post(requestUrl, {
        uid: $rootScope.user().uid,
        filePath: file.id,
        metadata: {
          name: newName
        }
      })
        .done(function(data) {
          file.dat = Object.assign(file.dat, data);
          $scope.updatingFile = false;
          $scope.$apply();
        })
        .fail(function(xhr, textStatus, error) {
          $scope.errorUpdatingFile = true;
          $scope.$apply();
          console.log(xhr.responseText);
        });
    }
    $scope.downloadFile = function(file) {
      switch (file.source) {
        case "gdrive":
          $.post("api/source/get_metadata", {
            uid: $rootScope.user().uid,
            fileId: file.id,
            keys: ["webContentLink"]
          })
            .done(function(data) {
              $window.open(JSON.parse(data).webContentLink, "_blank");
            })
            .fail(function(xhr, textStatus, error) {
              $rootScope.showPopup("error", "Couldn't get download link");
              console.log(JSON.parse(xhr.responseText));
            });
          break;
        case "onedrive":
          if (!!file.streamURL) {
            $window.open(file.streamURL);
          } else {
            $.get("api/source/onedrive/" + file.id + "/get_metadata", {
              uid: $rootScope.user().uid,
              keys: ["malware", "@microsoft.graph.downloadUrl"]
            })
              .done(function(data) {
                file.dat = Object.assign(file.dat, data);
                if (!data.malware) {
                  file = Object.assign(file, {
                    streamURL: data["@microsoft.graph.downloadUrl"]
                  });
                  $window.open(file.streamURL);
                } else {
                  $rootScope.showPopup(
                    "info",
                    "You may not download this file from Binder because it was found to contain malware."
                  );
                }
              })
              .fail(function(xhr, textStatus, error) {
                $scope.detailsFile.thumbnailLinkAlt =
                  "Couldn't get file metadata";
                console.log(JSON.parse(xhr.responseText));
              });
          }
          break;
        case "dropbox":
          if (!file.isFolder) {
            $window.open(file.streamURL);
          } else {
            $rootScope.showPopup(
              "info",
              "Cannot download Dropbox folders",
              "Dropbox doesn't allow external apps to download entire folders. If you believe this is in error, please contact support."
            );
          }
          break;
      }
    };
    $scope.previewFile = function(file) {
      console.log(file);
      var submitPreview = () => {
        var preview = {
          type: file.dat.name.substr(file.dat.name.lastIndexOf(".") + 1),
          file: file,
          test: "html/testPdf.pdf",
          supported: false,
          loading: false,
          onLoad: () => {
            $rootScope.title = file.dat.name;
          },
          close: () => {
            $rootScope.preview = null;
            $rootScope.title = $route.current.title;
          }
        };
        var supportedTypes = ["pdf", "docx"];
        preview.supported = supportedTypes.includes(preview.type);
        // if (file.source == "dropbox") {
        //   delete preview.src;
        //   preview.data = file.streamURL;
        // }
        $rootScope.preview = preview;
        if (preview.type == "docx" && !!!file.preview) {
          // $rootScope.preview.loading = true;
          // $.get("api/util/docx-to-html", { url: file.streamURL })
          //   .done(data => {
          //     $rootScope.preview = Object.assign(preview, {
          //       html: data
          //     });
          //     $rootScope.preview.loading = false;
          //     console.log($rootScope.preview);
          //     $scope.$apply();
          //   })
          //   .fail((xhr, textStatus, error) => {
          //     $rootScope.preview.loading = false;
          //     $rootScope.showPopup(
          //       "error",
          //       "Error while trying to generate preview",
          //       xhr.responseText,
          //       {
          //         close: () => {
          //           $rootScope.popup = null;
          //           $rootScope.preview.close();
          //         }
          //       }
          //     );
          //     $scope.$apply();
          //     console.log(xhr.responseText);
          //   });
        } else {
          $rootScope.preview.type = "pdf";
        }
      };
      if (!!!file.streamURL) {
        if (file.source != "dropbox") {
          var keys = [];
          if (file.source == "gdrive") {
            keys.push("webContentLink");
          } else if (file.source == "onedrive") {
            keys.push("@microsoft.graph.downloadUrl");
          }
          $.get("api/source/" + file.source + "/" + file.id + "/get_metadata", {
            uid: $rootScope.user().uid,
            keys: keys
          })
            .done(function(data) {
              switch (file.source) {
                case "gdrive":
                  file = Object.assign(file, {
                    streamURL: data.webContentLink
                  });
                  break;
                case "onedrive":
                  if (!data.malware) {
                    file = Object.assign(file, {
                      streamURL: data["@microsoft.graph.downloadUrl"]
                    });
                  }
                  break;
              }
              submitPreview();
              $scope.$apply();
            })
            .fail(function(xhr, textStatus, error) {
              $rootScope.showPopup(
                "error",
                "Couldn't get file preview",
                xhr.responseText
              );
              $scope.$apply();
              console.log(JSON.parse(xhr.responseText));
            });
        } else {
          $rootScope.showPopup(
            "error",
            "Preview window opened too early",
            "Please try again in a few seconds."
          );
        }
      } else {
        submitPreview();
      }
    };
    $scope.nextPageInView = function($inview) {
      var loadUntilOutOfView;
      var callCount = 0;
      var tokenExists = () => {
        if (callCount >= 5) {
          return false;
        }
        if (!!$scope.nextPageToken) {
          return true;
        } else if (!!$scope.nextSearchTokens) {
          for (let key in $scope.nextSearchTokens) {
            if (!!$scope.nextSearchTokens[key]) {
              return true;
            }
          }
        }
        return false;
      };
      if ($inview) {
        if (tokenExists()) {
          loadUntilOutOfView = $interval(() => {
            if (tokenExists()) {
              callCount++;
              $scope.openFolderCallback();
            } else {
              $interval.cancel(loadUntilOutOfView);
            }
          }, 2000);
        }
      } else if (!!loadUntilOutOfView) {
        $interval.cancel(loadUntilOutOfView);
      }
    };
  });
});
