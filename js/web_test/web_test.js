let device;

// Add an event listener to the Connect button
const connectButton = document.getElementById('connectButton');
async function clickButton()
{
  addEventListener("connect", (event) => {
    console.log("Device connected.");
  });

  // Request permission to access the gamepad
  device = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });

  await device.open();
};