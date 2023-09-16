// Use these to filter devices
const ID_NINTENDO = 0x057E;
const ID_ADAPTER = 0x0337;

device = null;

const listen = async () => {
    if (device != null) {
        try {
            var result = await device.transferIn(2, 37);
            console.log(result.data);
        }
        catch (err) {

        }
    };}

async function connectButton() {

    var devices = await navigator.usb.getDevices({ filters: [{ vendorId: ID_NINTENDO, productId: ID_ADAPTER }] });

    if (devices[0]) {
        console.log("Already got device.");
        device = devices[0];
    }
    else {
        console.log("Need device permission or not found.");
        // Request permission to access the ProGCC
        device = await navigator.usb.requestDevice({ filters: [{ vendorId: ID_NINTENDO, productId: ID_ADAPTER }] });
    }

    try {
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        var output = new Uint8Array([0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00]);

        await device.transferOut(1, output);

        var result = await device.transferIn(2, 37);
        console.log(result.data);

        var result = await device.transferIn(2, 37);
        console.log(result.data);
        
        /*
        listen_id = setInterval(() => {

            try {
                listen();
            }
            catch (err) {

            }
        }, 8);*/
    }
    catch (error) {
        window.alert("Please connect a valid device.");
    }

}