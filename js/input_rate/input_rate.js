const totalSamples = 100;
var timestamps = new Array(totalSamples);
var sampleCount = 0;

let lastCallTimestamp;

function timeSinceLastCall() {
    let currentTimestamp = performance.now();
    let elapsedTime;
    
    if (lastCallTimestamp) {
        elapsedTime = (currentTimestamp - lastCallTimestamp) * 1000; // Convert milliseconds to microseconds
    } else {
        elapsedTime = "This is the first function call!";
    }
    
    lastCallTimestamp = currentTimestamp;

    return elapsedTime;
}

function addSample(time)
{
    if(sampleCount >= totalSamples)
    {
        var first = timestamps.shift();
    }
    else
    {
        sampleCount+=1;
    }
    timestamps.push(time);
    var sum = timestamps.reduce((total, currentValue) => total + currentValue, 0);
    return (sum/timestamps.length);
}

function poll()
{
    gp = navigator.getGamepads()[0];
    if (gp != null)
    {
        var lx = gp.axes[0] * 5.5;
        var ly = gp.axes[1] * 5.5;

        var t = addSample(timeSinceLastCall());
        console.log(t);
    }  
}

setInterval(() => {
    poll();
}, 0.25);

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