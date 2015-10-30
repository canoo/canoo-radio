var angular = require('angular');
var Chance = require('chance'),
    chance = new Chance();

var app = angular.module('canooradio', []);

app.config = {
    url: "/api",
    serverBaseUrl: "http://localhost:8080/"
};


app.controller('RadioController', function($scope, $http, $interval){

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

    $scope.searchKeyPress = function(keyEvent) {
        if (keyEvent.which === 13) {
            $scope.searchSongs($scope.searchInput);
        }
    };

    $scope.searchSongs = function (searchString, maxResults) {

        if (searchString === '') {

            $http.get(app.config.serverBaseUrl + '/music/random?limit=25').then(
                function successCB(response) {
                    $scope.music = response.data;
                },
                httpErrorCb
            );

        } else {
            $http.get(app.config.serverBaseUrl + "/music/search?query=" + searchString).then(
                function successCB(response) {
                    $scope.music = response.data;
                },
                httpErrorCb
            );
        }


    };

    $scope.addToPlaylist = function (song) {
        $http.get(app.config.serverBaseUrl + "/playlist/add?fileName=" + song.id).then(
            function successCB() {
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

        //
        // if you click on your previous vote you want to clear it
        //

        if (previousVote === indication) {

            $http.get(app.config.serverBaseUrl + "/vote/clear?filename=" + song.id + "&userId=" + $scope.userId).then(
                function successCB() {
                    delete $scope.user.votes[song.id];

                    angular.forEach($scope.playlists.played, function (value, index) {
                        if (song.id === value.id) {
                            if (indication < 0) {
                                value.votes += 1;
                            } else if (indication > 0) {
                                value.votes -= 1;
                            }
                        }
                    });
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

            angular.forEach($scope.playlists.played, function (value, index) {

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
        // figure out which vote action to do
        //

        var url = '';

        if (indication > 0) {
            url = app.config.serverBaseUrl + "/vote/up";
        } else if (indication < 0) {
            url = app.config.serverBaseUrl + "/vote/down";
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

        $scope.notification.alertClass = '';

        if (type === 'error') {
            $scope.notification.alertClass += 'alert-danger';
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
        var message = response.data.path + ' ' + response.data.status + ' ' + response.data.error;
        postNotification('error', message);
    };

    var successUserData = function (response) {

        $scope.user = response.data;
        console.log($scope.user);

        igniteRadioData();
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
            $http.get(app.config.serverBaseUrl + "/user/" + $scope.userId).then(successUserData, httpErrorCb);
        } else {
            igniteRadioData();
        }

    };

    var igniteRadioData = function () {

        pollPlaylists();
        $scope.searchSongs("", 25);

        $interval(pollPlaylists, 5000);
    };


    /**
     * Poll playlist data
     */
    var pollPlaylists = function () {

        $http.get(app.config.serverBaseUrl + "/playlist/played").then(
            function successCB(response) {
                $scope.playlists.played = response.data;
            },
            httpErrorCb
        );

        $http.get(app.config.serverBaseUrl + "/playlist/upcoming").then(
            function successCB(response) {
                $scope.playlists.upcoming = response.data;
            },
            httpErrorCb
        );

        $http.get(app.config.serverBaseUrl + "/playlist/current").then(
            function successCB(response) {
                $scope.current = response.data;
            },
            httpErrorCb
        );
    };

    igniteRadio();
});

app.run(function () {

});