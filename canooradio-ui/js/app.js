/*global require */
'use strict';

var angular = require('angular');

var Chance = require('chance'),
    chance = new Chance();

var app =
    angular.module('canooradio', [require('ng-file-upload')])
        .config(function($locationProvider) {
            /*
            // use the HTML5 History API
            $locationProvider.html5Mode({
                enabled: false,
                requireBase: false
            });
            */
        });

app.custom = {
    url: "/api",
    serverBaseUrl: (window.location.hostname === 'localhost' ? '/api' : '')
};


app.controller('RadioController',
    ['$scope', '$http', '$interval', 'Upload', function($scope, $http, $interval, Upload) {

    $scope.userId = '';

    $scope.searchInput = "";

    $scope.playlists = {
        upcoming: [],
        played: []
    };

    $scope.current = {
        artist: 'Artist',
        song: 'Song',
        votes: 0,
        id: 1
    };

    $scope.user = {
        votes: {

        }
    };

    $scope.music = [];
    $scope.charts = [];

    // a poor attempt to try and get the browser to slide down when a song is added
    // but it's pointless given that the list refreshes on poll anyways
    $scope.songAdded = '';

    $scope.notification = {
        alertClass : '',
        message: '',
        timeout: null
    };

    $scope.closeNotification = function () {

        if ($scope.notification.timeout) {
            clearTimeout($scope.notification.timeout);
        }

        $scope.notification.message = '';
        $scope.notification.alertClass = '';
    };

    $scope.isAnimated = function (song) {
        var cssClass = '';

        if (song.isAdded) {
            cssClass = 'animated fadeInDown';
        }

        return cssClass;
    };

    // upload on file select or drop
    $scope.upload = function (file) {
        if (file.size === 0) {
            postNotification('error', "File is empty");
            return;
        }

        Upload.upload({
            url: app.custom.serverBaseUrl + '/music/upload',
            data: {file: file}
        }).then(function (resp) {

            postNotification('success', "Successfully uploaded your song");
            updateMusicBrowser();

            console.log(resp);
        }, function (resp) {
            console.log('Error status: ' + resp.status);
            postNotification('error', "Error uploading file. Code: " + resp.status);
        }, function (evt) {
            console.log(evt);
            var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
            // console.log('progress: ' + progressPercentage + '% ' + evt.config.data.file.name);
        });
    };

    $scope.searchKeyPress = function(keyEvent) {
        if (keyEvent.which === 13) {
            $scope.searchSongs($scope.searchInput);
        }
    };

    $scope.searchSongs = function (searchString, maxResults) {

        if (searchString === '') {

            updateMusicBrowser();

        } else {
            $http.get(app.custom.serverBaseUrl + "/music/search?query=" + searchString).then(
                function successCB(response) {
                    $scope.music = response.data;
                },
                httpErrorCb
            );
        }


    };

    $scope.addToPlaylist = function (song) {
        $http.get(app.custom.serverBaseUrl + "/playlist/add?userId="+$scope.userId+"&fileName=" + song.id).then(
            function successCB() {
                $scope.songAdded = 'animated slideInDown';
                song.isAdded = true;
                $scope.playlists.upcoming.push(song);
            },
            httpErrorCb
        );
    };

    $scope.isNotQueued = function (songId) {
        var isNotQueued = true;

        angular.forEach($scope.playlists.upcoming, function (value, index) {
            if (songId === value.id) {
                isNotQueued = false;
            }
        });

        if ($scope.current.id === songId) {
            isNotQueued = false;
        }

        return isNotQueued;
    };

    /**
     * Determine if the vote indicator icon is set or not
     *
     * @param song
     * @param indication
     * @returns {string}
     */
    $scope.votedCss = function (song, indication) {

        var cssClass = 'vote';

        if ($scope.user.votes.hasOwnProperty(song.id)) {
            if (indication > 0 && $scope.user.votes[song.id] > 0) {
                cssClass = 'voted';
            } else if (indication < 0 && $scope.user.votes[song.id] < 0) {
                cssClass = 'voted';
            }
        }

        return cssClass;
    };

    /**
     * Re-implementing stackoverflow voting :)
     *
     * TODO: update charts in realtime as well
     *
     * @param {String}  song        the song object
     * @param {Integer} indication  in the absence of an enum class, a +1 indicates and up vote and a -1 indicates a down vote
     */
    $scope.vote = function (song, indication) {

        if (!$scope.userId) {
            return;
        }

        var previousVote = 0;

        if ($scope.user.votes.hasOwnProperty(song.id)) {
            previousVote = $scope.user.votes[song.id];
        }

        var clearVoteInPlaylist = function (playlist, song) {

            angular.forEach(playlist, function (value, index) {
                if (song.id === value.id) {
                    if (indication < 0) {
                        value.votes += 1;
                    } else if (indication > 0) {
                        value.votes -= 1;
                    }
                }
            });
        };

        var updateVoteInPlaylist = function (playlist, song, indication, previousVote) {

            angular.forEach(playlist, function (value, index) {

                if (song.id === value.id) {

                    if (indication > 0) {

                        var increment = 1;

                        if (previousVote < 0) {
                            increment += 1;
                        }

                        value.votes += increment;

                    } else if (indication < 0) {

                        var decrement = 1;

                        if (previousVote > 0) {
                            decrement += 1;
                        }

                        value.votes -= decrement;
                    }
                }

            });
        };

        //
        // if you click on your previous vote you want to clear it
        //

        if (previousVote === indication) {

            $http.get(app.custom.serverBaseUrl + "/vote/clear?filename=" + song.id + "&userId=" + $scope.userId).then(
                function successCB() {
                    delete $scope.user.votes[song.id];
                    clearVoteInPlaylist($scope.playlists.played, song);
                    clearVoteInPlaylist($scope.playlists.upcoming, song);
                },
                httpErrorCb
            );

            return;
        }

        //
        // this callback is run after voting
        // - update user votes
        // - loop through played songs and update their counts
        //

        var cb = function () {

            $scope.user.votes[song.id] = indication;

            updateVoteInPlaylist($scope.playlists.played, song, indication, previousVote);
            updateVoteInPlaylist($scope.playlists.upcoming, song, indication, previousVote);
        };

        //
        // figure out which vote action to do
        //

        var url = '';

        if (indication > 0) {
            url = app.custom.serverBaseUrl + "/vote/up";
        } else if (indication < 0) {
            url = app.custom.serverBaseUrl + "/vote/down";
        }

        url += "?filename=" + song.id + "&userId=" + $scope.userId;

        $http.get(url).then(cb, httpErrorCb);

    };

    //
    // private functions, consider refactoring to services
    //

    var postNotification = function (type, message) {

        if ($scope.notification.timeout) {
            clearTimeout($scope.notification.timeout);
        }

        $scope.notification.alertClass = 'animated flipInX ';

        if (type === 'error') {
            $scope.notification.alertClass += 'alert-danger';
        } else if (type === 'success') {
            $scope.notification.alertClass += 'alert-success';
        } else {
            $scope.notification.alertClass += 'alert-info';
        }

        $scope.notification.message = message;

        $scope.notification.timeout = setTimeout(function () {
            $scope.notification.message = '';
            $scope.notification.alertClass = '';
        }, 5000);
    };

    var httpErrorCb = function (response) {
        console.log(response);

        var message = 'Something bad happened, please check your internet connection.';

        if (response.data) {

            message = response.data.path + ' ' + response.data.status + ' ' + response.data.error;

            if (response.data.path === '/playlist/add' && response.data.status === 403) {
                message = 'User queue limit reached! Please allow your songs to be played before adding more to the queue.';
            }

        } else {
            message = 'Could not connect to ' + response.config.url;
        }

        postNotification('error', message);
    };

    var successUserData = function (response) {

        $scope.user = response.data;
        console.log($scope.user);

        igniteRadioData();
    };

    var updateMusicBrowser = function () {
        $http.get(app.custom.serverBaseUrl + '/music/random?limit=25').then(
            function successCB(response) {
                $scope.music = response.data;
            },
            httpErrorCb
        );
    };

    var igniteRadio = function () {

        //
        // get userId from localStorage or generate one
        //

        // if (true) {
        if (typeof(Storage) === "undefined") {

            postNotification('error', 'Sorry no localstorage support, voting will be disabled');

        } else {

            $scope.userId = localStorage.getItem('canooradio-userid');

            if (!$scope.userId) {
                $scope.userId = chance.string({
                    pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
                    length: 8
                });
                localStorage.setItem('canooradio-userid', $scope.userId);
            }

            console.log('Hello ' + $scope.userId);
        }

        if ($scope.userId) {
            $http.get(app.custom.serverBaseUrl + "/user/" + $scope.userId).then(successUserData,
            function (response) {
                httpErrorCb(response);
                igniteRadioData();
            });
        } else {
            igniteRadioData();
        }

    };

    var igniteRadioData = function () {

        pollData();
        $scope.searchSongs("", 25);

        $interval(pollData, 5000);
    };


    /**
     * Poll playlist & music data
     */
    var pollData = function () {

        $http.get(app.custom.serverBaseUrl + "/playlist/played").then(
            function successCB(response) {
                $scope.playlists.played = response.data;
            },
            httpErrorCb
        );

        $http.get(app.custom.serverBaseUrl + "/playlist/upcoming").then(
            function successCB(response) {
                $scope.playlists.upcoming = response.data;
            },
            httpErrorCb
        );

        $http.get(app.custom.serverBaseUrl + "/playlist/current").then(
            function successCB(response) {
                if (response.data) {
                    $scope.current = response.data;
                }
            },
            httpErrorCb
        );

        $http.get(app.custom.serverBaseUrl + "/music/charts?limit=25").then(
            function successCB(response) {
                $scope.charts = response.data;
            },
            httpErrorCb
        );
    };

    igniteRadio();
}]);

app.run(function () {

    (function($) {

        $(window).scroll(function() {
            if ($(this).scrollTop() > 100) {
                $('.scrollup').fadeIn();
            } else {
                $('.scrollup').fadeOut();
            }
        });

        $('.scrollup').click(function() {
            $("html, body").animate({scrollTop: 0}, 1000);
            return false;
        });

        $('#relax').click(function() {
            $("html, body").animate({scrollTop: 0}, 1000);
            return false;
        });

        // local scroll
        jQuery('.navbar').localScroll({reset: true, hash: true, offset: {top: 0}, duration: 800, easing: 'easeInOutExpo'});

        if (Modernizr.mq("screen and (max-width:1024px)")) {
            jQuery("body").toggleClass("body");
        } else {
            var s = skrollr.init({
                mobileDeceleration: 1,
                edgeStrategy: 'set',
                forceHeight: true,
                smoothScrolling: true,
                smoothScrollingDuration: 300,
                easing: {
                    WTF: Math.random,
                    inverted: function(p) {
                        return 1 - p;
                    }
                }
            });
        }


    })(jQuery);

});
