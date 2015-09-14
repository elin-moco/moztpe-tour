'use strict';

var SCAN_INTERVAL = 3000;
var POSITION_COLOR = '#E66000';
var POSITION_BG_COLOR = 'rgba(230, 96, 0, 0.1)';
var MOZILLIAN_COLOR = '#C13832';
var BEACON_COLOR = 'rgba(0, 149, 221, 0.3)';
var ACTIVE_BEACON_COLOR = 'rgba(0, 83, 159, 0.6)';
var AVG_SIZE = 4;
var beacons = {};
var beaconPositions = {
  0: [300, 220],
  1: [1100, 120],
  2: [660, 500],
  3: [340, 960],
  4: [1120, 960],
  5: [640, 1160],
  6: [340, 1460],
  7: [630, 1800],
  8: [1300, 1240],
  9: [1700, 1100],
  10: [2060, 760],
  11: [1700, 460],
  12: [2520, 500],
  13: [2520, 930],
  '14': [2050, 1320],
  //'78:a5:04:88:26:4d': [2050, 1320],
  'd4:f5:13:78:f8:5e': [1980, 1560],  //Space TL
  'd4:f5:13:78:85:68': [2520, 1500],  //Space TR
  'f4:b8:5e:c5:55:82': [2490, 1970],  //Space BR
  'd4:f5:13:78:87:38': [2170, 1900],  //Space BL
  'd4:f5:13:78:92:d8': [2320, 2300],  //Lounge
  'd4:f5:13:78:e7:2a': [1820, 2300]   //Snacks
};
var currentPosition;
var wakeLock;

var navigate = document.getElementById('navigate');
var cvs = document.querySelector('#tracker');
var ctx = cvs.getContext('2d');
var pixelPerMm = 1;
// in meters
var DISTANCE_BETWEEN_BEACONS = 3.00;

window.onresize = () => {
  cvs.width = document.documentElement.scrollWidth;
  cvs.height = document.documentElement.scrollHeight;
  drawSomething();
};

function getNearestBeacons() {
  var beaconArray = [];
  for (var i in beacons) {
    beaconArray.push(beacons[i]);
  }
  beaconArray.sort(function(a, b) {
    var timeDiff = b.lastUpdate - a.lastUpdate;
    if (0 === timeDiff) {
      return a.avgDistance - b.avgDistance;
    }
    else {
      return timeDiff;
    }
  });
  return beaconArray.slice(0, 3);
}

function addBeacon(beacon) {
  if (beaconPositions.hasOwnProperty(beacon.address)) {
    beacon.lastUpdate = parseInt(new Date().getTime() / SCAN_INTERVAL);
    beacons[beacon.address] = beacon;
    drawSomething();
  }
}

//addBeacon({uuid: 15, distance: 2});
//addBeacon({uuid: 16, avgDistance: 2, deviation: 1});
//addBeacon({uuid: 17, avgDistance: 2, deviation: 1});
//addBeacon({uuid: 18, avgDistance: 5, deviation: 1});
//addBeacon({uuid: 19, avgDistance: 6, deviation: 1});


function drawSomething() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  ctx.lineWidth = 1;
  for (var uuid in beaconPositions) {
    var pos = beaconPositions[uuid];
    if (pos) {
      drawBeacon(BEACON_COLOR, pos[0], pos[1]);
    }
  }

  var coords = [];
  var nearbyBeacons = getNearestBeacons();
  console.log(nearbyBeacons);

  for (var beacon of getNearestBeacons()) {
    pos = beaconPositions[beacon.address];
    if (pos) {
      var radius = beacon.avgDistance * pixelPerMm * 100;
      drawBeacon(ACTIVE_BEACON_COLOR, pos[0], pos[1], radius);
      coords.push({x: pos[0], y: pos[1], r: radius, d: beacon.deviation});
    }
  }

  if (coords.length >= 3) {
    var position = trilateration(coords);

    drawPosition(position);
  }
}

function trilateration(coords) {
  let [b1, b2, b3] = coords;
  var i1 = intersection(b1.x, b1.y, b1.r, b2.x, b2.y, b2.r);
  var i2 = intersection(b2.x, b2.y, b2.r, b3.x, b3.y, b3.r);
  var i3 = intersection(b1.x, b1.y, b1.r, b3.x, b3.y, b3.r);
  var intersections = [];
  intersections.push(getClosest(i1, [i2, i3]));
  intersections.push(getClosest(i2, [i1, i3]));
  intersections.push(getClosest(i3, [i1, i2]));

  var avg = intersections.reduce((curr, is) => {
    let [x, y] = is;
    curr.x += x;
    curr.y += y;
    return curr;
  }, {x: 0, y: 0});

  var pos = {};
  pos.x = avg.x / intersections.length;
  pos.y = avg.y / intersections.length;
  //pos.r = getDistance([pos.x, pos.y], intersections[0]);
  pos.r = b1.d + b2.d + b3.d / 3 * pixelPerMm * 100;
  return pos;
}

function getDistance(p1, p2) {
  return Math.sqrt((p2[0] -= p1[0]) * p2[0] + (p2[1] -= p1[1]) * p2[1]);
}

function getClosest(curr, others) {
  // 1 choice?
  if (!curr[2]) return [curr[0], curr[1]];

  others = others.reduce(function(c, v) {
    if (v[2]) {
      c.push([v[0], v[2]]);
      c.push([v[1], v[3]]);
    }
    else {
      c.push([v[0], v[1]]);
    }
    return c;
  }, []);

  var avg = others.reduce(function(c, v) {
    c.x += v[0];
    c.y += v[1];
    return c;
  }, {x: 0, y: 0});

  var otherX = avg.x / others.length;
  var otherY = avg.y / others.length;

  let [x1, x2, y1, y2] = curr;

  if (Math.abs(x1 - otherX) + Math.abs(y1 - otherY) <
    Math.abs(x2 - otherX) + Math.abs(y2 - otherY)) {
    return [x1, y1];
  }
  else {
    return [x2, y2];
  }
}

function scrollToPosition(position) {
  window.scrollTo(position.x, position.y);
}

function drawPosition(position) {
  if (!currentPosition) {
    scrollToPosition(position);
  }
  currentPosition = position;
  ctx.fillStyle = ctx.strokeStyle = POSITION_COLOR;
  ctx.beginPath();
  ctx.arc(position.x, position.y, 15, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = POSITION_BG_COLOR;
  ctx.beginPath();
  ctx.arc(position.x, position.y, position.r, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawIntersection(data) {
  let [x1, y1] = data;

  ctx.fillStyle = ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.arc(x1, y1, 10, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
}

function line(x, y, endX, endY) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

function drawBeacon(color, x, y, distanceRadius) {
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  if (distanceRadius) {
    ctx.beginPath();
    ctx.arc(x, y, distanceRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.stroke();
  }
}

function intersection(x0, y0, r0, x1, y1, r1) {
  var a, dx, dy, d, h, rx, ry;
  var x2, y2;
  /* dx and dy are the vertical and horizontal distances between
   * the circle centers.
   */
  dx = x1 - x0;
  dy = y1 - y0;
  /* Determine the straight-line distance between the centers. */
  d = Math.sqrt((dy * dy) + (dx * dx));
  /* Check for solvability. */
  if (d > (r0 + r1)) {
    /* no solution. circles do not intersect. */
    if (y0 === y1) {
      if (x0 < x1) {
        return [(x0 + r0 + x1 - r1) / 2, y0];
      }
      else {
        return [(x0 - r0 + x1 + r1) / 2, y0];
      }
    }
    else if (x0 === x1) {
      if (y0 < y1) {
        return [x0, (y0 + r0 + y1 - r1) / 2];
      }
      else {
        return [x0, (y0 - r0 + y1 - r1) / 2];
      }
    }
    else {
      return [(x0 + r0 * Math.cos(Math.PI * 0.75) +
      x1 + r1 * Math.cos(Math.PI * -0.25)) / 2,
        (y0 + r0 * Math.sin(Math.PI * 0.75) +
        y1 + r1 * Math.sin(Math.PI * -0.25)) / 2];
    }

    return false;
  }
  if (d < Math.abs(r0 - r1)) {
    /* no solution. one circle is contained in the other */
    if (r0 < r1) {
      return [x0, y0];
    }
    else {
      return [x1, y1];
    }
  }
  /* 'point 2' is the point where the line through the circle
   * intersection points crosses the line between the circle
   * centers.
   */
  /* Determine the distance from point 0 to point 2. */
  a = ((r0 * r0) - (r1 * r1) + (d * d)) / (2.0 * d);
  /* Determine the coordinates of point 2. */
  x2 = x0 + (dx * a / d);
  y2 = y0 + (dy * a / d);
  /* Determine the distance from point 2 to either of the
   * intersection points.
   */
  h = Math.sqrt((r0 * r0) - (a * a));
  /* Now determine the offsets of the intersection points from
   * point 2.
   */
  rx = -dy * (h / d);
  ry = dx * (h / d);
  /* Determine the absolute intersection points. */
  var xi = x2 + rx;
  var xi_prime = x2 - rx;
  var yi = y2 + ry;
  var yi_prime = y2 - ry;
  return [xi, xi_prime, yi, yi_prime];
}


var measurement = {};

function gotBeacon(record, rssi) {
  var beacon = {
    uuid: record.uuid,
    type: 'beacon',
    name: record.name,
    address: record.address,
    major: record.major,
    minor: record.minor,
    rssi: rssi,
    txPower: record.txPower,
    distance: calculateDistance(record.txPower, rssi)
  };

  measurement[record.address] = measurement[record.address] || [];
  measurement[record.address] =
    measurement[record.address].slice(
      Math.max(measurement[record.address].length - AVG_SIZE, 0),
      measurement[record.address].length);

  measurement[record.address].push(beacon.distance);

  var avg = measurement[record.address].reduce((curr, val) => {
      curr += val;
      return curr;
    }, 0) / measurement[record.address].length;

  var sd = Math.sqrt(measurement[record.address].reduce((curr, val) => {
      curr += Math.pow(val - avg, 2);
      return curr;
    }, 0) / measurement[record.address].length);

  beacon.avgDistance = avg;
  beacon.deviation = sd;

  console.log(beacon);
  addBeacon(beacon);
}

var positioning = false;
var scanning = false;
var connection = null;
function startPositioning() {
  console.log('startPositioning');
  positioning = true;
  scanBeacons();
  wakeLock = window.navigator.requestWakeLock('screen');
}

function stopPositioning() {
  console.log('stopPositioning');
  positioning = false;
  navigator.mozBluetooth.defaultAdapter.stopLeScan(connection);
  scanning = false;
  wakeLock.unlock();
}

function scanBeacons() {
  if (scanning && !positioning) {
    return;
  }
  scanning = true;
  navigator.mozBluetooth.defaultAdapter.startLeScan([]).then(handle => {
    //console.log('Start LE scan', handle);
    connection = handle;
    handle.ondevicefound = e=> {
      //console.log('device found!', e.device);
      try {
        var record = parseScanRecord(e.device, e.scanRecord);
        if (record) {
          //console.log('beacon record: ', record);
          gotBeacon(record, e.rssi);
        }
      } catch (err) {
        console.error(err);
      }
    };

    setTimeout(function() {
      navigator.mozBluetooth.defaultAdapter.stopLeScan(handle);
      setTimeout(() => {
        scanBeacons();
      }, 100);
    }, SCAN_INTERVAL);

  }, err => {
    console.error('Start LE Scan failed', err);
    setTimeout(scanBeacons, 2000);
  });
}
if (navigator.mozBluetooth) {
  navigator.mozBluetooth.addEventListener('attributechanged', function(e) {
    if (e.attrs[0] !== 'defaultAdapter' || !navigator.mozBluetooth.defaultAdapter)
      return;

    startPositioning();
  });

  if (!!navigator.mozBluetooth.defaultAdapter) {
    startPositioning();
  }
}

function calculateDistance(txPower, rssi) {
  if (rssi === 0) {
    return -1.0;
  }
  var ratio = rssi * 1.0 / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  }
  else {
    //return (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
    return (0.89976) * Math.pow(ratio, 6.3095) + 0.111;
  }
}

function parseScanRecord(device, scanRecord) {
  var view = new Uint8Array(scanRecord);

  // Company ID does not have fixed length, so find out where to start by
  // finding 0x02, 0x15 in byes 4..8
  for (var start = 4; start < 8; start++) {
    if (view[start] === 0x02 && view[start + 1] === 0x15) {
      break;
    }
  }

  if (start === 8) {
    //console.log('invalid');
    return;
  }

  // Now UUID is the next 16 bytes right after 0x15
  start += 2;
  var uuid = bytesToHex(view.slice(start, start + 16));

  // major / minor are two bytes each
  start += 16;
  var major = (view[start] & 0xff) * 0x100 + (view[start + 1] & 0xff);

  start += 2;
  var minor = (view[start] & 0xff) * 0x100 + (view[start + 1] & 0xff);

  start += 2;
  var txPower = view[start] - 0x100;
  //var txPower = -73; // 1 meter distance

  return {
    uuid: uuid, major: major, minor: minor, txPower: txPower,
    name: device.name, address: device.address
  };
}

var hexArray = '0123456789ABCDEF'.split('');

function bytesToHex(bytes) {
  var hex = [];
  for (var j = 0; j < bytes.length; j++) {
    var v = bytes[j] & 0xff;
    hex[j * 2] = hexArray[v >>> 4];
    hex[j * 2 + 1] = hexArray[v & 0x0f];
  }
  return hex.join('');
}

if (navigator.hasOwnProperty('mozId')) {
  var login = null;
  navigator.mozId.watch({
    wantIssuer: 'firefox-accounts',
    onlogin: function(assertion) {
      console.log('Login FxA!', assertion);
      // You must implement the server functionality implied here - see https://github.com/mozilla/browserid-verifier
      verifyAssertion(assertion).then(
        (result) => {
          console.log('Assertion verified', result);
          if (result.hasOwnProperty('idpClaims')) {
            login = result.idpClaims['fxa-verifiedEmail'];
          }
          console.log('Login: ', login);
        }
      );
    },
    onlogout: function() {
      console.log('Logout FxA!', assertion);
      login = null;
    },
    onready: function(r) {
      console.log('FxA ready!', r);
    },
    onerror: function(error) {
      alert('FxA complains that: ' + error);
    }
  });

}

function loginFxA() {
  if (null == loggedInUser && !loggingIn) {
    navigator.mozId.request({
      oncancel: function() {
        console.log('User killed dialog.');
      }
    });
  }
}

function verifyAssertion(assertion) {
  return new Promise(function(resolve) {
    var xhr = new XMLHttpRequest({mozSystem: true});
    xhr.open('POST', 'https://verifier.accounts.firefox.com/v2');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        resolve(JSON.parse(xhr.responseText));
      }
    };
    xhr.send(JSON.stringify({
      assertion: assertion,
      audience: window.location.origin
    }));
  });
}

//var avatar = new Avatar(document.getElementById('me'), {
//  'useGravatar': true,
//  'allowGravatarFallback': true,
//  'email': 'elin@mozilla.com',
//  'initials': 'elin'
//});

navigate.addEventListener('click', function() {
  if (positioning) {
    this.classList.remove('on');
    stopPositioning();
    currentPosition = null;
  } else {
    this.classList.add('on');
    startPositioning();
  }
});

window.onresize();
