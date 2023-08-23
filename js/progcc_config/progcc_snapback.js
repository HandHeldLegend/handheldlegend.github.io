function snapback_place_values(data)
{
    var lxe = document.getElementById("lx_snapback");
    var lye = document.getElementById("ly_snapback");
    var rxe = document.getElementById("rx_snapback");
    var rye = document.getElementById("ry_snapback");

    var lx = data.getUint8(1);
    var ly = data.getUint8(2);
    var rx = data.getUint8(3);
    var ry = data.getUint8(4);

    console.log("Got snapback values.");
    console.log(data);

    lxe.value = lx;
    lye.value = ly;
    rxe.value = rx;
    rye.value = ry;

    document.getElementById("lx_snapbackText").innerText = String(lx);
    document.getElementById("ly_snapbackText").innerText = String(ly);
    document.getElementById("rx_snapbackText").innerText = String(rx);
    document.getElementById("ry_snapbackText").innerText = String(ry);
}

async function snapback_get_values()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SNAPBACK_GET]);
    await device.transferOut(2, dataOut);
}

async function snapback_set_value(axis, value)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SNAPBACK_SET, axis, value]);
    await device.transferOut(2, dataOut);
}

var t_data = [0,0];  

function snapback_visualizer_plot(data)
{

    // DEBUG
    console.log("Got snapback plot.");
    console.log(data);
    var interval = (data[2] << 24) | (data[3] << 16) | (data[4] << 8) | (data[5]);
    console.log("Interval: " + interval.toString());


    var svg = document.getElementById('waveform-output');

    var h = svg.getBoundingClientRect().height;
    var w = svg.getBoundingClientRect().width;

    // Remove all existing child nodes
    while (svg.firstChild) {
        svg.firstChild.remove();
    }

    // Function to create a line
    function createLine(y, color) {
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', y);
        line.setAttribute('x2', w);
        line.setAttribute('y2', y);
        line.style.stroke = color;
        line.style.strokeWidth = '1';
        svg.appendChild(line);
    }

    // Create center line (50%)
    createLine(h * 0.5, 'blue');

    // Create upper and lower lines (18% above and below center)
    createLine(h * (0.5+0.09), 'red');  // Above
    createLine(h * (0.5-0.09), 'red');  // Below

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.style.fill = 'none';
    line.style.stroke = 'black';
    
    var points = "";
    var s = 0;
    data.forEach(function(value, index) {
        if (index>1)
        {
            // Normalize y values to range from 0 to 500 (height of the SVG)
            var normalizedY = (h/255) * value;
            // Normalize x values to fit within the SVG width
            var normalizedX = (w/62) * (index-2);

            points += normalizedX + "," + normalizedY + " ";
        }
    });

    line.setAttribute('points', points);
    
    svg.appendChild(line);
}

snapback_visualizer_plot(t_data);