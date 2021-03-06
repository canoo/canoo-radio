
var _ = require('underscore');

var mpd = require('mpd'),
    cmd = mpd.cmd;


  /**
   * Standardize object interface
   */
  var processKey = function (key) {

    if (key === 'file') {
      return 'id';
    } else if (key === 'Artist') {
      return 'artist';
    } else if (key === 'Title') {
      return 'song';
    } else if (key === 'Album') {
      return 'album';
    } else if (key === 'Time') {
      return 'duration';
    }

    return null;
  };

  var getObjArrayFromMpdResponse = function (msg, key) {

    var result = [];
    var obj = {

    };

    var parts = msg.split('\n');
    // console.log(parts);

    _.each(parts, function (part) {
      var kv = part.split(':');

      if (kv[0] && kv[1]) {

        // this is a new object
        if (kv[0] === key) {
          if (Object.keys(obj).length) {
            result.push(obj);
            obj = { };
          }
        }

        var value = kv[1].replace(' ', '');

        if (!isNaN(value)) {
          value = (+value);
        }

        obj[kv[0]] = value;

        var processed = processKey(kv[0]);
        if (processed) {
          obj[processed] = value;
        }

      }

    });

    if (Object.keys(obj).length) {
      result.push(obj);
      obj = { };
    }

    return result;

  };

  var getObjFromMpdResponse = function (msg) {

    // console.log(msg);

    var obj = {

    };

    var parts = msg.split('\n');

    _.each(parts, function (part) {
      var kv = part.split(':');

      if (kv[0] && kv[1]) {
        var value = kv[1].replace(' ', '');

        if (!isNaN(value)) {
          value = (+value);
        }

        obj[kv[0]] = value;

        var processed = processKey(kv[0]);
        if (processed) {
          obj[processed] = value;
        }
      }

    });

    return obj;
  };

  var mockDb = [
    { id: 'a.mp3', artist: 'a', song: 'a1', duration: 300 },
    { id: 'b.mp3', artist: 'b', song: 'b1', duration: 301 },
    { id: 'c.mp3', artist: 'c', song: 'c1', duration: 302 },
    { id: 'd.mp3', artist: 'd', song: 'd1', duration: 303 },
    { id: 'current.mp3', artist: 'current', song: 'current1', Pos: 4, duration: 304 },
    { id: 'e.mp3', artist: 'e', song: 'e1', duration: 305 },
    { id: 'f.mp3', artist: 'f', song: 'f1', duration: 306 },
    { id: 'g.mp3', artist: 'g', song: 'g1', duration: 307 },
    { id: 'h.mp3', artist: 'h', song: 'h1', duration: 308 },
    { id: 'i.mp3', artist: 'i', song: 'i1', duration: 309 }
  ];

/**
 * A wrapper over mpd that returns domain specific json objects rather than plain text command ouput
 */
var mpdWrapper = function (env, host, port, logger) {

  var self = {

  };

  var client = null;
  var isMock = false;

  var executeObjCmd = function (command, cb) {

    client.sendCommand(cmd(command, []), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        var obj = getObjFromMpdResponse(msg);
        cb(null, obj);
      } catch (ex) {
        cb(ex);
      }

    });
  };

  self.getStatus = function (cb) {

    if (isMock) {

      cb(null, {
        volume: -1,
        repeat: 0,
        random: 0,
        single: 0,
        consume: 0,
        playlist: 2,
        playlistlength: 1,
        mixrampdb: 0,
        state: 'play',
        song: 0,
        songid: 1,
        time: 5,
        elapsed: 4.748,
        bitrate: 192,
        audio: 44100
      });

      return;
    }

    executeObjCmd('status', cb);

  };

  self.getCurrentSong = function (cb) {

    if (isMock) {
      cb(null, mockDb[4]);
      return;
    }

    executeObjCmd('currentsong', cb);
  };

  self.play = function (cb) {

    if (isMock) {
      return cb(null, null);
    }

    executeObjCmd('play', cb);
  };

  self.clear = function (cb) {

    if (isMock) {
      return cb(null, null);
    }

    executeObjCmd('clear', cb);
  };

  self.playPosition = function (position, cb) {

    if (isMock) {
      return cb(null, null);
    }

    client.sendCommand(cmd('play', [position]), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        var obj = getObjFromMpdResponse(msg);
        cb(null, obj);
      } catch (ex) {
        cb(ex);
      }

    });

  };

  self.stop = function (cb) {

    if (isMock) {
      return cb(null, null);
    }

    executeObjCmd('stop', cb);
  };

  self.next = function (cb) {

    if (isMock) {
      return cb(null, null);
    }

    executeObjCmd('next', cb);
  };

  self.getCurrentPlaylistInfo = function (cb) {

    if (isMock) {
      return cb(null, mockDb);
    }

    client.sendCommand(cmd("playlistinfo", []), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        cb(null, getObjArrayFromMpdResponse(msg, 'file'));
      } catch (ex) {
        cb(ex);
      }

    });
  };

  self.search = function (term, cb) {

    if (isMock) {
      return cb(null, [mockDb[0], mockDb[1]]);
    }

    client.sendCommand(cmd("search", ['any', term]), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        cb(null, getObjArrayFromMpdResponse(msg, 'file'));
      } catch (ex) {
        cb(ex);
      }

    });
  };

  self.findById = function (id, cb) {
    if (isMock) {
      var song = {
        id: id,
        file: id,
        artist: 'snoop',
        song: 'dawg'
      };

      return cb(null, [song]);
    }

    client.sendCommand(cmd("find", ['file', id]), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        cb(null, getObjArrayFromMpdResponse(msg, 'file'));
      } catch (ex) {
        cb(ex);
      }

    });
  }

  self.getAllSongs = function (cb) {

    if (isMock) {
      return cb(null, mockDb);
    }

    client.sendCommand(cmd("listallinfo", []), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        cb(null, getObjArrayFromMpdResponse(msg, 'file'));
      } catch (ex) {
        cb(ex);
      }

    });
  };

  self.updateDb = function (cb) {

    if (isMock) {
      return cb(null, {updating_db: 42});
    }

    executeObjCmd('update', cb);
  };

  self.addSongToPlaylist = function (filePath, cb) {

    if (isMock) {
      mockDb.push({id: filePath});
      return cb(null, null);
    }

    client.sendCommand(cmd("add", [filePath]), function (err, msg) {
      if (err) {
        return cb(err);
      }

      try {
        cb(null, getObjFromMpdResponse(msg));
      } catch (ex) {
        cb(ex);
      }

    });
  };

  self.getUpcomingSongs = function (cb) {

    self.getCurrentSong(function (err, song) {

      if (err) {
        return cb(err);
      }

      self.getCurrentPlaylistInfo(function (err, playlist) {

        if (err) {
          return cb(err);
        }

        if (song && song.hasOwnProperty('Pos')) {

          if (playlist.length === 1) {
            cb(null, []);
          } else {
            cb(null, playlist.slice(song.Pos + 1));
          }
        } else {
          cb(null, playlist);
        }

      });

    });

  };

  self.getPlayedSongs = function (num, cb) {

    self.getCurrentSong(function (err, song) {

      if (err) {
        return cb(err);
      }

      self.getCurrentPlaylistInfo(function (err, playlist) {

        if (err) {
          return cb(err);
        }

        // console.log(playlist);

        if (song && song.Pos) {
          var playedSongs = playlist.slice(0, song.Pos);
          var limited = playedSongs.slice(-num);
          cb(null, limited);
        } else {
          cb(null, []);
        }

      });

    });

  };

  self.startPlaybackAtEnd = function (cb) {

    self.getCurrentPlaylistInfo(function (err, playlist) {

      if (err) {
        return cb(err);
      }

      if (playlist.length > 0) {
        self.playPosition(playlist[playlist.length - 1].Pos, cb);
      } else {
        cb(null, null);
      }

    });
  }

  var initialize = function () {

    if (env === 'test') {
      isMock = true;
    } else {

      client = mpd.connect({
        port: port,
        host: host,
      });

      client.on('ready', function() {
        logger.info("mpd connected to " + host + ":" + port);
      });

    }
  };

  initialize();

  return self;

};



/*
client.on('system', function(name) {
  console.log("update", name);
});

client.on('system-player', function() {
  client.sendCommand(cmd("status", []), function(err, msg) {
    if (err) throw err;
    console.log(msg);
  });
});
*/



module.exports = mpdWrapper;
