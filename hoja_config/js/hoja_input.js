let circle_stick_center_l = document.getElementById('circle-analog-pointer-l').style;
let circle_stick_center_r = document.getElementById('circle-analog-pointer-r').style;

let octo_stick_center_l = document.getElementById('octo-analog-pointer-l').style;
let octo_angle_l = document.getElementById('octagon-angle-text-l');

let octo_stick_center_r = document.getElementById('octo-analog-pointer-r').style;
let octo_angle_r = document.getElementById('octagon-angle-text-r');

let op = 'translate(-50%, -50%)';

const buttonMapping = {
    0: 'A',
    1: 'X',
    2: 'B',
    3: 'Y',
    4: 'RSL',
    5: 'RSR',
    9: 'PLUS',
    11: 'RA',
    12: 'HOME',
    14: 'R',
    15: 'RT',
    16: 'LEFT',
    17: 'DOWN',
    18: 'UP',
    19: 'RIGHT',
    20: 'LSL',
    21: 'LSR',
    24: 'MINUS',
    26: 'LA',
    29: 'CAPTURE',
    30: 'L',
    31: 'LT'  
}

function calculateAngle(x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let theta = Math.atan2(dy, dx); // This gives the angle in radians
    theta *= 180 / Math.PI; // Convert radians to degrees
    //theta-=90;
    theta = 180-theta;

    // If we want the angle to be between 0 and 360
    theta %= 360;

    // Round to two decimal places
    theta = Math.round(theta);

    return theta;
}

function rumble(length) {
    if (gp.connected && gp != null) {
        gp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: length,
            weakMagnitude: 1.0,
            strongMagnitude: 1.0,
        });
    }
}

var octo_scaler = 1;
var got_scale = false;

var octoele = document.getElementById("leftocto-stick-ui");
var octocompstyle = window.getComputedStyle(octoele);

function isNumberBetween(number, lowerBound, upperBound) {
    return number >= lowerBound && number <= upperBound;
  }

function input_process_data(data) {

    if(!got_scale)
    {
        console.log("height is " + octocompstyle.height);
        got_scale = true
    }

    var height = parseFloat(octocompstyle.height);
    var octo_scaler = height/270;


    var lx = (data.getUint8(1)-128) * octo_scaler;
    var ly = (data.getUint8(2)-128) * -octo_scaler;
    var rx = (data.getUint8(3)-128) * octo_scaler;
    var ry = (data.getUint8(4)-128) * -octo_scaler;

    
    var la = calculateAngle(lx, ly, 0, 0);
    var ra = calculateAngle(rx, ry, 0, 0);

    if(isNumberBetween(data.getUint8(1), 120, 136) && isNumberBetween(data.getUint8(2), 120, 136)) la = 0;
    if(isNumberBetween(data.getUint8(3), 120, 136) && isNumberBetween(data.getUint8(4), 120, 136)) ra = 0;

    var lnp = op + 'translate(' + lx.toString() + 'px,' + ly.toString() + 'px)';
    var rnp = op + 'translate(' + rx.toString() + 'px,' + ry.toString() + 'px)';
    circle_stick_center_l.transform = lnp;
    circle_stick_center_r.transform = rnp;

    octo_stick_center_l.transform = lnp;
    octo_angle_l.value = la.toString();

    octo_stick_center_r.transform = rnp;
    octo_angle_r.value = ra.toString();
}
