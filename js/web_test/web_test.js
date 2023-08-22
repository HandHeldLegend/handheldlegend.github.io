let device;
var gp;
let output = document.getElementById("out");

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

setInterval(() => {
  poll();
}, 8);

var max_x = 0;
var tracking = false;
const THRESHOLD = 30;
var inc = 0;

function poll()
{
    gp = navigator.getGamepads()[0];
    if (gp != null)
    {
        var lx = gp.axes[0] * 100;
        var ly = gp.axes[1] * 100;
        var rx = gp.axes[2] * 100;
        var ry = gp.axes[3] * 100;

        if( (ry>THRESHOLD) && !tracking)
        {
          max_x = THRESHOLD;
          tracking = true;
        }
        else if (tracking)
        {
          if(ry>max_x)
          {
            max_x = ry;
          }

          if (ry<THRESHOLD)
          {
            inc++;
            output.innerText = inc.toString() + ": " + max_x.toString();
            tracking = false;
          }
        }
    }  
}

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