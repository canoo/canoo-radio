var express = require('express');
var morgan = require('morgan');
var Promise = require('bluebird');
var _ = require('underscore');

var cors = require('./lib/cors.js');
var logger = require('./lib/logger.js').logger;
var mpdWrapper = require('./lib/mpd-wrapper')('localhost', 6600, logger);
var dbWrapper = require('./lib/db-wrapper')(logger);

var mpd = Promise.promisifyAll(mpdWrapper);
var db = Promise.promisifyAll(dbWrapper);

var app = express();

app.use(morgan('dev'));

app.use(cors.allowAll);

//
// playlist
//

app.get('/api/playlist/played', function (req, res, next) {

  mpd.getPlayedSongsAsync(10)
    .then(function (playlist) {

      // console.log(playlist);

      Promise.map(playlist, function (song) {

        return db.getVotesForSongAsync(song.id)
          .then(function (sum) {
            song.votes = sum;
          });

      }).then(function () {
        res.send(playlist);
      });

    })
    .catch(function (err) {
      next(err);
    });

});

app.get('/api/playlist/upcoming', function (req, res, next) {

  mpd.getUpcomingSongsAsync()
    .then(function (playlist) {

      Promise.map(playlist, function (song) {

        return db.getVotesForSongAsync(song.id)
          .then(function (sum) {
            song.votes = sum;
          });

      }).then(function () {
        res.send(playlist);
      });

    })
    .catch(function (err) {
      next(err);
    });

})

app.get('/api/playlist/current', function (req, res, next) {

  /*
  var playlist = {
      id : '/var/mp3/current.mp3',
      artist : 'Current',
      song: 'current',
      album: 'album',
      votes: 2
  };
  */

  mpd.getCurrentSongAsync()
    .then(function (song) {

      return db.getVotesForSongAsync(song.id)
        .then(function (sum) {
          song.votes = sum;
          res.send(song);
        });
    })
    .catch(function (err) {
      next(err);
    });

});

/**
 * TODO: add user checks
 */
app.get('/api/playlist/add', function (req, res, next) {

  var data = req.query;
  console.log(data);

  mpd.addSongToPlaylistAsync(data.songId)
    .then(function () {
      res.status(200).send();
    })
    .catch(function (err) {
      next(err);
    });

});


//
// user
//

app.get('/api/user/:id', function (req, res, next) {

  db.getUserAsync(req.params.id)
    .then(function (user) {

      if (user) {

        user.votes = {};

        db.getUserVotesAsync(user._id)
          .then(function (votes) {
            _.each(votes, function (vote) {
              user.votes.vote.songId = value;
            })

            res.send(user);
          });

      } else {

        var u = {
          _id: req.params.id
        }

        db.addUserAsync(u)
          .then(function (inserted) {
            inserted.votes = {};
            res.send(inserted);
          });
      }

    })
    .catch(function (err) {
      next(err);
    });

  /*
  var user = {
    id: req.params.id,
    votes : {
      "01 Welcome.mp3" : 1,
      "04 Pretty Fly (For a White Guy).mp3" : 1,
      "05 The Kids Aren't Alright.mp3" : -1
    }
  };

  res.send(user);
  */

});

//
// vote
//

app.get('/api/vote/up', function (req, res, next) {

    var data = req.body;

    console.log(data);

    res.status(200).send();

});


app.get('/api/vote/down', function (req, res, next) {

    var data = req.body;

    console.log(data);

    res.status(200).send();

});

app.get('/api/vote/clear', function (req, res, next) {

    var data = req.body;

    console.log(data);

    res.status(200).send();

});

//
// music db
//

app.get('/api/db/search', function (req, res) {

    console.log(req.query);

    /*
    if(req.query.query !== "") {
        res.send([songs[0]]);
    } else {
        res.send(songs);
    }
    */

    res.status(200).send();

});

//
// player
//

app.get('/api/player/play', function (req, res) {

  mpd.playAsync()
    .then(function () {
      res.status(200).send();
    })
    .catch(function (err) {
      next(err);
    });

});

app.get('/api/player/stop', function (req, res) {

  mpd.stopAsync()
    .then(function () {
      res.status(200).send();
    })
    .catch(function (err) {
      next(err);
    });

});

app.get('/api/player/next', function (req, res) {

  mpd.nextAsync()
    .then(function () {
      res.status(200).send();
    })
    .catch(function (err) {
      next(err);
    });

});


// api takes top precedence
app.use(express.static(__dirname + '/public'));

app.use(function (err, req, res, next) {

    logger.error(err + '');
    res.header('Error', err);
    res.status(500).send();

});

var init = function () {
  var app_http = app.listen(8000);
}

exports.init = init;

if (!module.parent)
{
  init();
};
