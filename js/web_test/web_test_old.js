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
const THRESHOLD = 50;
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
          max_x = ry;
          tracking = true;
        }
        else if (tracking)
        {
          if(ry>max_x)
          {
            max_x = ry;
          }

          if (ry<=THRESHOLD)
          {
            inc++;
            output.innerText = inc.toString() + ": " + max_x.toString();
            tracking = false;
          }
        }
    }  
}

var countdown = 0;
var ellapsed = 0;
var lastTime = 0;

var last_x = 0;
var last_y = 0;

var largest_time = 0;
var avg = 0;
var overflowed = 0;

/*
function poll()
{
    gp = navigator.getGamepads()[0];
    if (gp != null)
    {
        var p = gp.buttons[0].pressed;
        if (p && !tracking)
        {
          tracking = true;
          countdown = 1000;
          largest_time = 0;
          avg = 8;
          overflowed = 0;
          lastTime = Date.now();
          output.innerText = "Tracking...: ";
        }
        else if (countdown>0)
        {
          var lx = gp.axes[0] * 100;
          var ly = gp.axes[1] * 100;
          
          if ( (lx != last_x) || (ly != last_y))
          {
            var t = Date.now();
            ellapsed = t - lastTime;
            if (ellapsed > largest_time)
            {
              largest_time = ellapsed;
            }
            if(ellapsed>16)
            {
              overflowed++;
            }
            avg += ellapsed;
            avg *= 0.5;
            lastTime = t;
            countdown--;

            last_x = lx;
            last_y = ly;
          }

          if (countdown == 0)
          {
            tracking = false;
            output.innerText = "Largest Latency: " + largest_time.toString() + "\nAvg: " + avg.toString() + 
            "\nTimes we went over 16ms: " + overflowed.toString();
          }
        }
    }  
}*/

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