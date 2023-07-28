var gp;

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

    // If we want the angle to be between 0 and 360
    if (theta < 0) {
        theta = 360 + theta;
    }

    // Round to two decimal places
    theta = Math.round(theta * 100) / 100;

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

function poll()
{
    gp = navigator.getGamepads()[0];
    if (gp != null)
    {
        var lx = gp.axes[0] * 5.5;
        var ly = gp.axes[1] * 5.5;
        var rx = gp.axes[2] * 5.5;
        var ry = gp.axes[3] * 5.5;

        var la = calculateAngle(lx, ly, 0, 0);
        var ra = calculateAngle(rx, ry, 0, 0);

        var lnp = op + 'translate(' + lx.toString() + 'rem,' + ly.toString() + 'rem)';
        var rnp = op + 'translate(' + rx.toString() + 'rem,' + ry.toString() + 'rem)';
        circle_stick_center_l.transform = lnp;
        circle_stick_center_r.transform = rnp;

        octo_stick_center_l.transform = lnp;
        octo_angle_l.value = la.toString();

        octo_stick_center_r.transform = rnp;
        octo_angle_r.value = ra.toString();

    }  
}

setInterval(() => {
    poll();
}, 8);

window.addEventListener("gamepadconnected", (e) => {

    console.log(
        e.gamepad
    );

    gp = navigator.getGamepads()[0];
    rumble(500);

});

window.addEventListener( "gamepaddisconnected", (e) => {
        console.log("Gamepad disconnected.");
    },
);